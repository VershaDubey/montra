# Webhook Implementation Checklist

## ✅ Core Components

- [x] **JSON Parsing Enhancement**
  - Server configured for 50MB payloads
  - Error handler for malformed JSON
  - File: `server.js`

- [x] **Data Sanitization**
  - Removes control characters from strings
  - Handles nested objects
  - File: `utils/sanitize.js`

- [x] **OpenAI Integration**
  - Extracts data from transcript
  - Parses Hindi and English
  - File: `utils/extractWithOpenAI.js`

- [x] **Webhook Route**
  - Updated to use OpenAI extraction
  - Maintains Salesforce/Email/WhatsApp flow
  - File: `routes/webhook.js`

## 🧪 Testing Steps

### Before Testing
- [ ] Ensure OpenAI API key is in `.env`
- [ ] Ensure PORT=5001 in `.env`
- [ ] Run `npm install` if new packages added

### Step 1: Start Server
```bash
node server.js
```
Expected: `🚀 Server running on port 5001`

### Step 2: Run Test
In another terminal:
```bash
node test-webhook-clean.js
```

Expected Output Should Show:
- [ ] OpenAI extraction starting
- [ ] Extracted fields logged
- [ ] Final sanitized fields logged
- [ ] Success response from Salesforce

## 📊 Validation Checklist

### User Name Extraction
- [ ] Extracts "वर्षा" as "Varsha"
- [ ] Handles name patterns like "मेरा नाम ... है"
- [ ] English names also work

### Pincode Extraction
- [ ] Extracts "277001" from transcript
- [ ] Handles digit-by-digit speech ("two seven seven zero zero one")
- [ ] Returns 6-digit codes

### Registration Number Extraction
- [ ] Extracts "MH01AB123456"
- [ ] Handles spoken format "m h zero one a b one two three four five six"
- [ ] Converts to uppercase

### Issue Description Extraction
- [ ] Extracts "vehicle ख़राब हो गया है"
- [ ] Identifies problems/issues in conversation
- [ ] Preserves Hindi text

### Mobile Number
- [ ] Falls back to `telephony_data.to_number`
- [ ] Shows "+918795583362"

## 🔍 Common Issues & Solutions

### Issue: "No response from server"
**Solution**: 
1. Check if port 5001 is available
2. Check for errors in server logs
3. Ensure all dependencies installed

### Issue: "OPENAI_API_KEY not found"
**Solution**:
1. Verify `.env` file contains `OPENAI_API_KEY=sk-proj-...`
2. Restart server after updating `.env`

### Issue: "Failed to parse OpenAI response"
**Solution**:
1. Check OpenAI API quota
2. Verify API key is valid
3. Check transcript is not empty

### Issue: "SyntaxError: Bad control character"
**Solution**: Already fixed! Should not occur with updated code

## 📈 Performance Metrics

Expected extraction time: ~2-5 seconds (OpenAI API call)

```
📤 Testing Webhook
⏳ Calling webhook...
✅ SUCCESS! Response received in ~3s
```

## 📝 Response Format

Success response includes:
```json
{
  "success": true,
  "message": "Salesforce Case created, and WhatsApp message delivered",
  "salesforceResponse": { ... },
  "whatsappResponse": { ... },
  "extracted_data": {
    "user_name": "Varsha",
    "mobile": "+918795583362",
    "pincode": "277001",
    "issueDesc": "vehicle ख़राब हो गया है",
    "registration_number": "MH01AB123456"
  }
}
```

## 🚀 Deploy Checklist

- [ ] All files committed to git
- [ ] `.env` not committed (security)
- [ ] All syntax checks passing
- [ ] Test runs successfully
- [ ] Response format validated
- [ ] Ready for production

## 📞 Support

If issues arise:
1. Check `WEBHOOK_TEST_GUIDE.md`
2. Review `IMPLEMENTATION_SUMMARY.md`
3. Check server logs for detailed errors
4. Verify OpenAI API key and quota
