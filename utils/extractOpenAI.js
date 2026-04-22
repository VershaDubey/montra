const axios = require('axios');

/**
 * Extract structured data from transcript using OpenAI
 * @param {string} transcript - The conversation transcript
 * @param {string} openaiKey - OpenAI API key
 * @returns {Promise<object>} - Extracted fields
 */
async function extractFromTranscriptOpenAI(transcript, openaiKey) {
  const defaultExtracted = {
    user_name: "",
    mobile: "",
    pincode: "",
    service_appointment_date: "",
    issueDesc: "",
    fullAddress: "",
    registration_number: ""
  };

  if (!transcript || !openaiKey) {
    console.warn("⚠️ Transcript or OpenAI key missing");
    return defaultExtracted;
  }

  try {
    const prompt = `Extract the following information from this customer service transcript. Return ONLY a valid JSON object with these exact fields. If a field is not mentioned, leave it as an empty string.

Transcript:
${transcript}

Extract and return ONLY this JSON (no markdown, no extra text):
{
  "user_name": "extracted customer name or empty string",
  "mobile": "extracted phone number or empty string",
  "pincode": "extracted pincode/postal code or empty string",
  "service_appointment_date": "extracted appointment date or empty string",
  "issueDesc": "extracted issue description or empty string",
  "fullAddress": "extracted full address or empty string",
  "registration_number": "extracted vehicle/product registration number or empty string"
}`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const content = response.data.choices[0]?.message?.content || '';
    
    // Try to parse the JSON response
    let extracted = defaultExtracted;
    
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        extracted = { ...defaultExtracted, ...parsed };
      }
    } catch (parseError) {
      console.error("⚠️ Failed to parse OpenAI response:", content);
    }

    console.log("✨ OpenAI extracted data:", extracted);
    return extracted;

  } catch (error) {
    console.error("❌ OpenAI extraction error:", error.response?.data?.error?.message || error.message);
    return defaultExtracted;
  }
}

module.exports = {
  extractFromTranscriptOpenAI
};
