const express = require("express");
const router = express.Router();
const axios = require("axios");
const sendMail = require("../utils/sendMail");
const spokenToEmail = require("../utils/spokenToEmail");
const { sanitizeString, sanitizeObject } = require("../utils/sanitize");
const https = require("https");
const agent = new https.Agent({ rejectUnauthorized: false });
const processedWebhookKeys = new Map();
const processingWebhookKeys = new Set();
const WEBHOOK_DEDUPE_TTL_MS = Number(process.env.WEBHOOK_DEDUPE_TTL_MS || 6 * 60 * 60 * 1000);

function clearExpiredProcessedWebhookKeys() {
  const now = Date.now();
  for (const [key, timestamp] of processedWebhookKeys.entries()) {
    if (now - timestamp > WEBHOOK_DEDUPE_TTL_MS) {
      processedWebhookKeys.delete(key);
    }
  }
}

function getWebhookDedupKey(body) {
  const providerCallId = String(body?.telephony_data?.provider_call_id || "").trim();
  const webhookId = String(body?.id || "").trim();
  const toNumber = String(body?.telephony_data?.to_number || "").trim();
  const fromNumber = String(body?.telephony_data?.from_number || "").trim();
  const duration = String(body?.conversation_duration || body?.telephony_data?.duration || "").trim();
  const recordingUrl = String(body?.telephony_data?.recording_url || body?.recording_url || "").trim();

  if (providerCallId) return `provider_call_id:${providerCallId}`;
  if (recordingUrl && toNumber) return `recording:${toNumber}:${recordingUrl}`;
  if (webhookId) return `webhook_id:${webhookId}`;
  if (toNumber && fromNumber && duration) return `fallback:${toNumber}:${fromNumber}:${duration}`;
  return null;
}

function findField(obj, key) {
  if (!obj || typeof obj !== "object") return null;
  if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== "") return obj[key];

  for (const nestedKey in obj) {
    const result = findField(obj[nestedKey], key);
    if (result !== null) return result;
  }

  return null;
}

function findFirstField(obj, keys = []) {
  for (const key of keys) {
    const value = findField(obj, key);
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function findAllFields(obj, key, acc = []) {
  if (!obj || typeof obj !== "object") return acc;
  if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== "") {
    acc.push(obj[key]);
  }
  for (const nestedKey in obj) {
    findAllFields(obj[nestedKey], key, acc);
  }
  return acc;
}

function getSubjectiveValue(subjectiveText = "", fieldKey = "") {
  if (!subjectiveText || !fieldKey) return "";
  const regex = new RegExp(`['"]${fieldKey}['"]\\s*:\\s*['"]([^'"]+)['"]`, "i");
  const match = subjectiveText.match(regex);
  return match?.[1] ? match[1].trim() : "";
}

function getSubjectiveExtraction(extracted = {}) {
  const subjectiveCandidates = findAllFields(extracted, "subjective");
  for (const candidate of subjectiveCandidates) {
    const text = String(candidate || "").trim();
    if (!text) continue;
    const user_name = getSubjectiveValue(text, "user_name");
    const feedback = getSubjectiveValue(text, "feedback");
    const rate = getSubjectiveValue(text, "rate");
    if (user_name || feedback || rate) {
      return { user_name, feedback, rate };
    }
  }
  return { user_name: "", feedback: "", rate: "" };
}

function extractNameFromTranscript(transcript = "") {
  if (!transcript) return "";
  const match = transcript.match(/(?:my\s+name\s+is|मेरा\s+नाम|naam|name\s+is)\s*[:\-]?\s*([a-zA-Z\u0900-\u097F ]{2,40})/i);
  return match?.[1] ? match[1].trim() : "";
}

function extractRateFromTranscript(transcript = "") {
  if (!transcript) return "";

  const patternMatch = transcript.match(/(?:rate|rating|रेटिंग|रेट|i\s+give|main\s+det[ae]\s+hu)\D*([1-9]|10)\b/i);
  if (patternMatch?.[1]) return patternMatch[1];

  const hindiOutOfTenMatch = transcript.match(/दस\s+में\s+से\s+(एक|दो|तीन|चार|पांच|पाँच|छह|सात|आठ|नौ|दस)/i);
  if (hindiOutOfTenMatch?.[1]) {
    const map = {
      एक: "1",
      दो: "2",
      तीन: "3",
      चार: "4",
      पांच: "5",
      "पाँच": "5",
      छह: "6",
      सात: "7",
      आठ: "8",
      नौ: "9",
      दस: "10",
    };
    return map[hindiOutOfTenMatch[1]] || "";
  }

  const lastUserLine = transcript
    .split("\n")
    .filter((line) => /^user\s*:/i.test(line))
    .slice(-3)
    .join(" ");

  const simpleDigitMatch = lastUserLine.match(/\b([1-9]|10)\b/);
  return simpleDigitMatch?.[1] || "";
}

function extractFeedbackFromTranscript(transcript = "") {
  if (!transcript) return "";

  const userLines = transcript
    .split("\n")
    .filter((line) => /^user\s*:/i.test(line))
    .map((line) => line.replace(/^user\s*:\s*/i, "").trim())
    .filter((line) => line.length > 2);

  if (!userLines.length) return "";

  const preferred = userLines.find((line) => /(feedback|experience|service|accha|acha|bad|kharab|satisfied|unsatisfied|issue|problem|thanks)/i.test(line));
  return sanitizeString(preferred || userLines[userLines.length - 1]);
}

router.post("/", async (req, res) => {
  let webhookDedupKey = null;
  let sfCaseCreated = false;
  let sfResponseData = null;

  try {
    // Sanitize incoming payload
    const sanitizedBody = sanitizeObject(req.body);
    console.log("📦 Webhook received payload:", JSON.stringify(sanitizedBody, null, 2));

    clearExpiredProcessedWebhookKeys();
    webhookDedupKey = getWebhookDedupKey(sanitizedBody);

    if (webhookDedupKey && processedWebhookKeys.has(webhookDedupKey)) {
      console.log(`🔁 Duplicate webhook ignored (already processed): ${webhookDedupKey}`);
      return res.status(200).json({
        success: true,
        message: "Duplicate webhook ignored",
        dedupe_key: webhookDedupKey,
      });
    }

    if (webhookDedupKey && processingWebhookKeys.has(webhookDedupKey)) {
      console.log(`⏳ Duplicate webhook ignored (processing in progress): ${webhookDedupKey}`);
      return res.status(202).json({
        success: true,
        message: "Webhook already processing",
        dedupe_key: webhookDedupKey,
      });
    }

    if (webhookDedupKey) {
      processingWebhookKeys.add(webhookDedupKey);
    }

    const extracted = sanitizedBody.extracted_data || {};
    const telephoneData = sanitizedBody.telephony_data || {};
    const rawTranscript = typeof req.body?.transcript === "string" ? req.body.transcript : "";
    const transcriptForExtraction = rawTranscript || sanitizedBody.transcript || findFirstField(extracted, ["transcript", "call_transcript"]) || "";
    const transcriptedData = sanitizeString(transcriptForExtraction);
    let conversationDueration = sanitizedBody.conversation_duration || telephoneData?.duration || 0;

    function formatDuration(seconds) {
      const safeSeconds = Number(seconds) || 0;
      const totalMilliseconds = Math.floor(safeSeconds * 1000);

      const minutes = Math.floor(totalMilliseconds / 60000);
      const remainingAfterMinutes = totalMilliseconds % 60000;

      const secs = Math.floor(remainingAfterMinutes / 1000);
      const milliseconds = remainingAfterMinutes % 1000;

      let result = "";
      if (minutes > 0) result += `${minutes} min `;
      if (secs > 0) result += `${secs} sec `;
      if (milliseconds > 0) result += `${milliseconds} ms`;

      return result.trim() || "0 sec";
    }

    function formatDateTime(date) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");

      return `${year}-${month}-${day} ${hours}:${minutes}:00`;
    }

    // current time
    const now = new Date();
    const schedStartTime = formatDateTime(now);

    // add 6 hours
    const end = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const schedEndTime = formatDateTime(end);

    conversationDueration = formatDuration(conversationDueration);
    const subjectiveExtraction = getSubjectiveExtraction(extracted);

    console.log("🤖 Extracting custom fields directly from Bolna data...");
    let user_name = sanitizeString(
      findFirstField(extracted, ["user_name", "name", "customer_name", "caller_name"]) ||
        subjectiveExtraction.user_name ||
        extractNameFromTranscript(transcriptForExtraction) ||
        "Guest"
    );
    let feedback = sanitizeString(
      findFirstField(extracted, ["feedback", "user_feedback", "issueDesc", "issue", "comment", "comments", "query", "summary"]) ||
        subjectiveExtraction.feedback ||
        extractFeedbackFromTranscript(transcriptForExtraction) ||
        "No feedback"
    );
    let rate = sanitizeString(
      findFirstField(extracted, ["rate", "rating", "score", "sentiment"]) ||
        subjectiveExtraction.rate ||
        extractRateFromTranscript(transcriptForExtraction) ||
        "0"
    );
    let mobile = sanitizeString(telephoneData?.to_number || findFirstField(extracted, ["mobile", "phone", "phone_number"]) || "");

    let email = sanitizeString(findFirstField(extracted, ["email", "email_id", "mail"]));
    if (email) {
      email = spokenToEmail(email);
    }

    console.log(" Final Extracted Fields from Bolna:", {
      user_name,
      feedback,
      rate,
      mobile,
      email,
      transcript_length: transcriptedData.length,
    });

    let recordingURL = sanitizeString(telephoneData?.recording_url || sanitizedBody?.recording_url || findFirstField(extracted, ["recording_url", "recording_link"]) || "");
    let caseType = "Customer Feedback";

    // Fallbacks for older variables so email/whatsapp don't crash
    let predDate = new Date().toLocaleString();
    let fullAddress = sanitizeString(findFirstField(extracted, ["fullAddress", "full_address", "address"]) || "Not Provided");
    let registration_number = sanitizeString(findFirstField(extracted, ["registration_number", "vehicle_number", "reg_number"]) || "Not Provided");
    let issueDesc = feedback;
    let pincode = sanitizeString(findFirstField(extracted, ["pincode", "pin_code", "zip_code"]) || "");
    let technician_visit_date = sanitizeString(findFirstField(extracted, ["technician_visit_date", "service_appointment_date"]) || new Date().toISOString());
    const transcriptForSalesforce = transcriptForExtraction ? String(transcriptForExtraction).slice(0, 31500) : "";
    const caseDescription = [
      `User: ${user_name || "NA"}`,
      `Mobile: ${mobile || "NA"}`,
      `Feedback: ${feedback || "NA"}`,
      `Rate: ${rate || "NA"}`,
      `Recording URL: ${recordingURL || "NA"}`,
      "",
      "Transcript:",
      transcriptForSalesforce || "NA",
    ].join("\n");

    // Step 1 to Create Case in Salesforce

    // Print extracted data before Salesforce API call
    console.log("\n✅ EXTRACTED DATA TO SEND:");
    console.log(
      JSON.stringify(
        {
          Subject: caseType,
          operation: "insert",
          user_name: user_name,
          Mobile: mobile,
          feedback: feedback,
          rate: rate,
          email: email,
          preferred_date: predDate,
          recording_link: recordingURL,
          recording_url: recordingURL,
          transcript: transcriptForSalesforce,
          call_transcript: transcriptForSalesforce,
          conversationDueration: conversationDueration,
          sentiment: rate,
          Description: caseDescription,
          Origin: "Phone",
          Priority: "High",
        },
        null,
        2
      )
    );
    console.log("\n");

    const sfResponse = await axios.post(
      "https://orgfarm-eb022cf662-dev-ed.develop.my.salesforce.com/services/apexrest/caseService",
      {
        Subject: caseType,
        operation: "insert",
        user_name: user_name,
        Mobile: mobile,
        feedback: feedback,
        rate: rate,
        email: email,
        preferred_date: predDate,
        recording_link: recordingURL,
        recording_url: recordingURL,
        transcript: transcriptForSalesforce,
        call_transcript: transcriptForSalesforce,
        conversationDueration: conversationDueration,
        sentiment: rate,
        Description: caseDescription,
        Origin: "Phone",
        Priority: "High",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SF_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          Cookie: "BrowserId=7spVeGDlEfCCMxkfpbgyRg; CookieConsentPolicy=0:1; LSKey-c$CookieConsentPolicy=0:1",
        },
      }
    );

    sfCaseCreated = true;
    sfResponseData = sfResponse.data;

    // Mark as processed immediately after Salesforce case creation.
    // This prevents duplicate case creation on webhook retries when downstream notifications fail.
    if (webhookDedupKey) {
      processedWebhookKeys.set(webhookDedupKey, Date.now());
    }

    console.log("Salesforce Case created:", sfResponse.data);

    const caseId = "SR-" + (sfResponse.data.caseNumber || "PENDING"); // Fallback if no case number
    const issueDescription = issueDesc || "Service Request";
    const registeredAddress = fullAddress || "Address to be updated"; // Fallback address
    const serviceTime = new Date(technician_visit_date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    // step 2 to send email to customer

    const emailHTML = `
  <h2 style="color: #004d40;">Greaves Electric Mobility – Service Update</h2>

  <p>Dear ${user_name},</p>

  <p>We have received your request regarding <b>${issueDescription}</b>.</p>

  <p>
    <b>Case ID:</b> ${caseId}<br/>
  </p>

  <p>
    <b>Registered Address:</b><br/>
    ${registeredAddress}<br/>
    <b>Service Time:</b> ${serviceTime}
  </p>

  <p>
    <b>Registered Phone:</b> ${mobile}<br/>
    <b>Registered Email:</b> ${email}
  </p>

  <p style="margin-top: 30px;">Regards,<br/><b>Greaves Electric Mobility Support Team</b></p>
`;

    // Only send email if we have a valid customer email address
    let emailResponse = { success: true, skipped: true };
    if (email && email.includes("@")) {
      emailResponse = await sendMail({
        to: email,
        subject: `Greaves Electric Mobility – Service Update — Case ${caseId}`,
        html: emailHTML,
      });
    } else {
      console.log("⚠️ Skipping email: No valid customer email address provided");
    }

    // step 3 to send whatsapp message to customer

    const parameters = [`${user_name}`, `${predDate}`, `${registeredAddress}`, `${registration_number}`, `${issueDesc}`];
    const whatsappMobile = mobile.replace(/^(\+91|91)/, "");
    const whatsappPayload = {
      messaging_product: "whatsapp",
      to: "91" + whatsappMobile,
      type: "template",
      template: {
        name: "greaves_service_demo",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: parameters.map((text) => ({ type: "text", text })),
          },
        ],
      },
    };

    const whatsappResponse = await axios.post("https://graph.facebook.com/v22.0/475003915704924/messages", whatsappPayload, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "Accept-Encoding": "identity",
      },
    });
    console.log("WhatsApp message sent:", whatsappResponse.data);

    res.status(200).json({
      success: true,
      message: "Salesforce Case created, and WhatsApp message delivered",
      salesforceResponse: sfResponse.data,
      whatsappResponse: whatsappResponse.data,
      emailResponse,
      schedStartTime: schedStartTime,
      schedEndTime: schedEndTime,
    });
  } catch (error) {
    console.error("❌ Webhook error:", error);

    // Extract meaningful error message
    let errorMessage = error.message;
    let errorDetails = null;

    if (error.response?.data) {
      errorDetails = error.response.data;
    } else if (error.message) {
      errorMessage = error.message;
    }

    // If Salesforce case is already created, avoid retry-triggered duplicate case creation.
    if (sfCaseCreated) {
      return res.status(200).json({
        success: true,
        message: "Salesforce case created, but downstream notification failed",
        salesforceResponse: sfResponseData,
        warning: errorMessage,
        details: errorDetails || null,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      details: errorDetails || null,
      timestamp: new Date().toISOString(),
    });
  } finally {
    if (webhookDedupKey) {
      processingWebhookKeys.delete(webhookDedupKey);
    }
  }
});

module.exports = router;
