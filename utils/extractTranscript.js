/**
 * Extract structured data from transcript conversation
 * @param {string} transcript - The conversation transcript
 * @param {object} telephonyData - Phone data containing user number
 * @returns {object} - Extracted fields
 */
function extractFromTranscript(transcript, telephonyData = {}) {
  const extracted = {
    user_name: null,
    mobile: null,
    pincode: null,
    service_appointment_date: null,
    issuedesc: null,
    fulladdress: null,
    registration_number: null,
  };

  if (!transcript) return extracted;

  const text = transcript.toLowerCase();

  // Extract user name
  // Look for patterns like "my name is X" or "नाम ... है"
  const nameMatches = transcript.match(/(?:my\s+name\s+is|मेरा\s+नाम|name\s+है)\s+([a-zA-Z\u0900-\u097F]+)/gi);
  if (nameMatches && nameMatches.length > 0) {
    const lastMatch = nameMatches[nameMatches.length - 1];
    const name = lastMatch.split(/(?:is|है)/i).pop()?.trim();
    if (name && name.length > 1) {
      extracted.user_name = name;
    }
  }

  // Extract pincode - look for sequences of numbers
  // In hindi: "pin code two seven seven zero zero one" or digits
  const pincodeMatches = transcript.match(/(?:pin\s+code|pincode|पिनकोड|pin)[:\s]+([0-9]{6}|(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|०|१|२|३|४|५|६|७|८|९)\s*)+)/gi);
  if (pincodeMatches && pincodeMatches.length > 0) {
    const lastMatch = pincodeMatches[pincodeMatches.length - 1];
    // Try to extract 6 digit numbers
    const digitMatch = lastMatch.match(/\d{6}/);
    if (digitMatch) {
      extracted.pincode = digitMatch[0];
    }
  }

  // Extract registration number / vehicle number
  // Look for patterns like "mh zero one a b one two three four five six"
  const regMatches = transcript.match(/(?:registration|number|vehicle|गाड़ी|model|mh\s+)[:\s]+([\w\s]+?)(?:है|is|क्या|$)/gi);
  if (regMatches && regMatches.length > 0) {
    const lastMatch = regMatches[regMatches.length - 1];
    // Clean up the matched text
    const cleaned = lastMatch
      .replace(/(?:registration|number|vehicle|गाड़ी|model|है|is|क्या)/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned && cleaned.length > 2) {
      extracted.registration_number = cleaned.toUpperCase();
    }
  }

  // Extract issue description
  // Look for problem indicators
  const issueMatches = transcript.match(/(?:problem|issue|broken|not\s+working|ख़राब|खराब|repair|नहीं|काम|problem\s+है)[:\s]*([^।]*?)(?:\n|$|।|।।)/gi);
  if (issueMatches && issueMatches.length > 0) {
    const lastMatch = issueMatches[issueMatches.length - 1];
    const cleaned = lastMatch
      .replace(/(?:problem|issue|broken|not\s+working|ख़राब|खराब|repair|नहीं|काम|problem\s+है)[\s:]*/gi, '')
      .trim();
    if (cleaned && cleaned.length > 2) {
      extracted.issuedesc = cleaned;
    }
  }

  // Extract address
  const addressMatches = transcript.match(/(?:address|location|आदर्श|पता)[:\s]+([^।]*?)(?:\n|$|।|।।)/gi);
  if (addressMatches && addressMatches.length > 0) {
    const lastMatch = addressMatches[addressMatches.length - 1];
    const cleaned = lastMatch
      .replace(/(?:address|location|आदर्श|पता)[\s:]*/gi, '')
      .trim();
    if (cleaned && cleaned.length > 2) {
      extracted.fulladdress = cleaned;
    }
  }

  // Extract mobile if not provided from telephony data
  if (!extracted.mobile && telephonyData?.to_number) {
    extracted.mobile = telephonyData.to_number;
  }

  // Set appointment date to now if not found
  if (!extracted.service_appointment_date) {
    extracted.service_appointment_date = new Date().toISOString();
  }

  return extracted;
}

module.exports = {
  extractFromTranscript,
};
