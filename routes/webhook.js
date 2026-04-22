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
  const duration = String(body?.conversation_duration || "").trim();

  if (providerCallId) return `provider_call_id:${providerCallId}`;
  if (webhookId) return `webhook_id:${webhookId}`;
  if (toNumber && duration) return `fallback:${toNumber}:${duration}`;
  return null;
}

router.post("/", async (req, res) => {
  let webhookDedupKey = null;

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

    const extracted = sanitizedBody.extracted_data;
    const telephoneData = sanitizedBody.telephony_data;
    const transcriptedData = sanitizedBody.transcript;
    let conversationDueration = sanitizedBody.conversation_duration;

    function formatDuration(seconds) {
      const totalMilliseconds = Math.floor(seconds * 1000);

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

    // 🤖 Helper to extract nested keys from Bolna JSON safely
    const findField = (obj, key) => {
      if (!obj || typeof obj !== 'object') return null;
      if (obj[key] !== undefined && obj[key] !== null) return obj[key];
      for (let k in obj) {
        let res = findField(obj[k], key);
        if (res !== null) return res;
      }
      return null;
    };

    console.log("🤖 Extracting custom fields directly from Bolna data...");
    let user_name = sanitizeString(findField(extracted, "name") || "Guest");
    let feedback = sanitizeString(findField(extracted, "feedback") || "No feedback");
    let rate = sanitizeString(findField(extracted, "rate") || "0");
    let mobile = sanitizeString(telephoneData?.to_number || "");
    
    console.log(" Final Extracted Fields from Bolna:", { user_name, feedback, rate, mobile });

    let recordingURL = telephoneData?.recording_url || '';
    let caseType = "Customer Feedback";
    
    // Fallbacks for older variables so email/whatsapp don't crash
    let predDate = new Date().toLocaleString();
    let fullAddress = "Not Provided";
    let registration_number = "Not Provided";
    let issueDesc = feedback;
    let pincode = "";
    let technician_visit_date = new Date().toISOString();

    //Step 1 to Create Case in Salesforce
    
    // Print extracted data before Salesforce API call
    console.log("\n✅ EXTRACTED DATA TO SEND:");
    console.log(JSON.stringify({
      Subject: caseType,
      operation: "insert",
      user_name: user_name,
      Mobile: mobile,
          feedback: feedback,
          rate: rate,
      email: " ",
      preferred_date: predDate,
      recording_link: recordingURL,
      transcript: transcriptedData,
      conversationDueration: conversationDueration,
          sentiment: rate,
      Origin: "Phone",
      Priority: "High"
    }, null, 2));
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
        email: "aman.kumar@crmlanding.in",
        preferred_date: predDate,
        recording_link: recordingURL,
        transcript: transcriptedData,
        conversationDueration: conversationDueration,
            sentiment: rate,
        Origin: "Phone",
        Priority: "High"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SF_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          Cookie: "BrowserId=7spVeGDlEfCCMxkfpbgyRg; CookieConsentPolicy=0:1; LSKey-c$CookieConsentPolicy=0:1"
        }
      }
    );

    console.log("Salesforce Case created:", sfResponse.data);

    const caseId = 'SR-'+ (sfResponse.data.caseNumber || 'PENDING'); // Fallback if no case number
    const email = sanitizeString(sfResponse?.data?.email || "");
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

    //step 2 to send email to customer

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

    // Only send email if we have a valid email address
    let emailResponse = { success: true };
    if (email && email.includes('@')) {
      emailResponse = await sendMail({
        to: email,
        subject: `Greaves Electric Mobility – Service Update — Case ${caseId}`,
        html: emailHTML,
      });
    } else {
      console.log("⚠️ Skipping email: No valid email address provided");
    }

    //step 3 to send whatsapp message to customer

const parameters = [
  `${user_name}`,
  `${predDate}`,
  `${registeredAddress}`,
  `${registration_number}`,
  `${issueDesc}`
];
    const whatsappMobile = mobile.replace(/^(\+91|91)/, '');
    const whatsappPayload = {
      "messaging_product": "whatsapp",
      "to": "91" + whatsappMobile,
      "type": "template",
      "template": {
        "name": "greaves_service_demo",
        "language": { "code": "en" },
        "components": [
          {
            "type": "body",
            "parameters": parameters.map((text) => ({ type: "text", text })),
          },
        ],
      },
    };


    const whatsappResponse = await axios.post(
      "https://graph.facebook.com/v22.0/475003915704924/messages",
      whatsappPayload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "Accept-Encoding": "identity",

        },
      }
    );
console.log("WhatsApp message sent:", whatsappResponse.data);

    if (webhookDedupKey) {
      processedWebhookKeys.set(webhookDedupKey, Date.now());
    }

    res.status(200).json({
      success: true,
      message: "Salesforce Case created, and WhatsApp message delivered",
      salesforceResponse: sfResponse.data,
      whatsappResponse: whatsappResponse.data,
      schedStartTime: schedStartTime,       
    schedEndTime: schedEndTime    
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
