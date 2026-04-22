# Setup Instructions for OpenAI Integration

## Step 1: Add OpenAI API Key

1. Open the `.env` file in your project
2. Add your OpenAI API key on the `OPENAI_API_KEY` line:
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

3. Get your key from: https://platform.openai.com/api-keys

## How it Works

The webhook now:
1. ✅ First tries to use `extracted_data` from Bolna platform
2. ✅ If `extracted_data` is empty, uses OpenAI to intelligently parse the transcript
3. ✅ Extracts these 7 fields:
   - `user_name` - Customer name
   - `mobile` - Phone number
   - `pincode` - Postal code
   - `service_appointment_date` - Appointment date
   - `issueDesc` - Issue description
   - `fullAddress` - Customer address
   - `registration_number` - Vehicle/Product registration

## Testing

After adding the OpenAI key:

```bash
node server.js    # Terminal 1
node test-webhook.js  # Terminal 2 (in another window)
```

The test webhook will send a sample payload and you'll see the extracted data in the console.
