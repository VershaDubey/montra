# Webhook Testing Guide

## Quick Start

### Step 1: Start the Server
```bash
node server.js
```

You should see:
```
🚀 Server running on port 5001
```

### Step 2: In another terminal, run the test
```bash
node test-webhook-clean.js
```

## What the System Does

1. **Receives** the webhook payload from Bolna platform
2. **Sanitizes** all incoming data to remove control characters
3. **Extracts** data from the transcript using OpenAI API
4. **Returns** structured data in this format:
```json
{
  "user_name": "Varsha",
  "mobile": "+918795583362",
  "pincode": "277001",
  "service_appointment_date": "2026-04-07T...",
  "issueDesc": "vehicle ख़राब हो गया है",
  "fullAddress": "",
  "registration_number": "MH01AB123456"
}
```

## Expected Extracted Data

From the test transcript, the system should extract:
- **user_name**: Varsha
- **mobile**: +918795583362
- **pincode**: 277001
- **issueDesc**: vehicle ख़राब हो गया है
- **registration_number**: MH01AB123456

## Files Modified

1. **server.js** - Enhanced JSON parsing with 50MB limit
2. **routes/webhook.js** - Updated to use OpenAI extraction
3. **utils/sanitize.js** - Sanitizes all incoming strings
4. **utils/extractWithOpenAI.js** - Extracts data from transcript using OpenAI
5. **.env** - Added OPENAI_API_KEY

## Environment Variables Required

```
OPENAI_API_KEY=your_api_key_here
PORT=5001
```

## Troubleshooting

- If server doesn't start, check if port 5001 is in use
- If webhook doesn't respond, ensure OpenAI API key is valid
- Check server logs for detailed error messages
