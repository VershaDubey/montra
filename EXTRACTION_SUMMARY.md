# Webhook Data Extraction - Implementation Summary

## 🎯 Problem Solved
- ❌ **Before**: JSON parsing errors with control characters, missing extracted data, crashes when fields were empty
- ✅ **After**: Intelligent extraction using OpenAI, graceful fallbacks, proper error handling

## 📁 Files Created/Modified

### 1. **`utils/extractOpenAI.js`** (NEW)
- Calls OpenAI API to intelligently extract data from transcript
- Extracts exactly these 7 fields:
  ```json
  {
    "user_name": "Varsha",
    "mobile": "+918795583362",
    "pincode": "277001",
    "service_appointment_date": "",
    "issueDesc": "vehicle खराब हो गया है",
    "fullAddress": "",
    "registration_number": "MH01AB123456"
  }
  ```

### 2. **`routes/webhook.js`** (UPDATED)
- Now imports OpenAI extraction utility
- Logic flow:
  1. If Bolna `extracted_data` is provided → Use it
  2. Else if `extracted_data` is empty → Use OpenAI parsing
  3. Fallback with empty strings for missing fields

### 3. **`.env`** (UPDATED)
- Added `OPENAI_API_KEY=` placeholder
- You need to add your actual key here

### 4. **`server.js`** (PREVIOUS UPDATE)
- Increased JSON limit to 50MB
- Added JSON error handler

### 5. **`utils/sanitize.js`** (PREVIOUS UPDATE)
- Removes control characters from strings
- Escapes special characters for JSON safety

## 🚀 Usage

### Step 1: Add OpenAI API Key
```bash
# Edit .env file and add:
OPENAI_API_KEY=sk-your-actual-key-here
```

### Step 2: Run Server
```bash
node server.js
```

### Step 3: Send Webhook
```bash
node test-webhook.js
```

### Or use cURL:
```bash
curl -X POST http://localhost:5001/webhook \
  -H "Content-Type: application/json" \
  -d @payload.json
```

## 📊 Extracted Fields Explained

| Field | Example | Purpose |
|-------|---------|---------|
| `user_name` | "Varsha" | Customer's name |
| `mobile` | "+918795583362" | Customer's phone number |
| `pincode` | "277001" | Postal/zip code |
| `service_appointment_date` | "2026-04-07" | Appointment date if mentioned |
| `issueDesc` | "vehicle खराब हो गया है" | Problem/issue description |
| `fullAddress` | "123 Main St..." | Customer's address |
| `registration_number` | "MH01AB123456" | Vehicle/product registration |

## ✨ Features

✅ Handles empty extracted_data  
✅ Multilingual support (Hindi + English)  
✅ Graceful fallbacks  
✅ Proper error handling  
✅ Detailed console logging  
✅ JSON parsing errors fixed  
✅ Support for both Bolna extraction and OpenAI parsing  

## 🔧 Troubleshooting

**Q: "OPENAI_API_KEY not set"**  
A: Add your key to `.env` file

**Q: "OpenAI API rate limited"**  
A: Wait a moment before retrying, or check your API usage

**Q: "Extraction returning empty strings"**  
A: The information might not be in the transcript. Check console logs.

## 📝 Environment Variables

```env
PORT=5001
OPENAI_API_KEY=sk-your-key-here
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
RESEND_API_KEY=your-resend-key
```

Done! Your webhook is now ready to intelligently extract data from transcripts. 🎉
