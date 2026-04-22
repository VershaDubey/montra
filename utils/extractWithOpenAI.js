const axios = require('axios');

/**
 * Extract structured data from transcript using OpenAI
 * @param {string} transcript - The conversation transcript
 * @param {object} telephonyData - Phone data containing user number
 * @returns {Promise<object>} - Extracted fields
 */
async function extractWithOpenAI(transcript, telephonyData = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    return getDefaultExtraction(telephonyData);
  }

  try {
    const prompt = `Extract the following information from this conversation transcript. Return ONLY valid JSON with these exact fields, use empty string "" for missing values:
{
  "user_name": "full name of the user",
  "mobile": "phone number with country code",
  "pincode": "postal/zip code",
  "service_appointment_date": "appointment date in ISO format or empty string",
  "issueDesc": "description of the issue or problem",
  "fullAddress": "complete address",
  "registration_number": "vehicle/product registration or model number"
}

Transcript:
${transcript}

Phone number from system: ${telephonyData?.to_number || ''}

Important:
- Extract EXACTLY as mentioned above
- Use empty string "" for any missing fields
- For issueDesc, use Hindi words as they appear
- For registration_number, use uppercase
- Return ONLY the JSON object, no other text`;

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
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0]?.message?.content;
    
    if (!content) {
      console.error('❌ No content in OpenAI response');
      return getDefaultExtraction(telephonyData);
    }

    // Try to parse the JSON response
    let extracted;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        extracted = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response:', content);
      return getDefaultExtraction(telephonyData);
    }

    // Ensure all required fields exist
    const result = {
      user_name: extracted.user_name || '',
      mobile: extracted.mobile || telephonyData?.to_number || '',
      pincode: extracted.pincode || '',
      service_appointment_date: extracted.service_appointment_date || '',
      issueDesc: extracted.issueDesc || '',
      fullAddress: extracted.fullAddress || '',
      registration_number: extracted.registration_number || ''
    };

    console.log('✅ OpenAI Extraction successful:', result);
    return result;

  } catch (error) {
    console.error('❌ OpenAI extraction error:', error.response?.data || error.message);
    return getDefaultExtraction(telephonyData);
  }
}

/**
 * Get default extraction with empty values
 * @param {object} telephonyData - Phone data
 * @returns {object} - Default extraction object
 */
function getDefaultExtraction(telephonyData = {}) {
  return {
    user_name: '',
    mobile: telephonyData?.to_number || '',
    pincode: '',
    service_appointment_date: new Date().toISOString(),
    issueDesc: '',
    fullAddress: '',
    registration_number: ''
  };
}

module.exports = {
  extractWithOpenAI,
  getDefaultExtraction
};
