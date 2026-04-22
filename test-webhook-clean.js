#!/usr/bin/env node

const axios = require('axios');

const payload = {
    "id": "0832dab1-fb89-4e1f-95b3-62ad8cec7941",
    "agent_id": "7af528fb-df51-497e-9178-0ed2d787ef5d",
    "batch_id": null,
    "conversation_duration": 105,
    "transcript": "assistant: नमस्कार TVS कस्टमर सपोर्ट में आपका स्वागत है। मैं Priya आपकी किस प्रकार मदद कर सकती हूँ?\nuser: hello प्रिया मेरा नाम वर्षा है और मेरा vehicle ख़राब हो गया है\nassistant: मैं समझ सकती हूँ ये कितना परेशान करने वाला है — आप चिंता मत कीजिए, मैं अभी मदद करती हूँ। बस जल्दी से — आपका नाम, पिनकोड, और TVS गाड़ी का registration number बताइए।\nuser: मेरा नाम वर्षा है और मेरा pin code two seven seven zero zero one है और मेरा model का नाम गाड़ी के model का नाम m h zero one a b one two three four five six है\nassistant: अच्छा, वर्षा मैम — पिनकोड और registration number थोड़ा स्पष्ट बताइए। पिनकोड 2 7 7 0 0 1 है क्या? और registration number में एम एच के बाद के हिस्से फिर से बताइए।\nuser: mh zero one a b one two three four five six\nassistant: आपका pincode है — दोसौ सत्ताईस — शून्य शून्य एक — क्या यह सही है? और आपकी गाड़ी का number है — एम एच — शून्य एक — ए बी — एक दो तीन चार पांच छह — क्या यह सही है?\nuser: हां बिल्कुल सही है\nassistant: समझ गई — अभी technician भेज रही हूँ। वे लगभग 2 घंटे में पहुँच जाएंगे।",
    "extracted_data": {},
    "telephony_data": {
        "duration": "106",
        "to_number": "+918795583362",
        "from_number": "+918035735856",
        "recording_url": "https://bolna-recordings-india.s3.ap-south-1.amazonaws.com/plivo/f48cb58b-2d5d-463d-b252-f9158b97b6f7.mp3",
        "provider_call_id": "f48cb58b-2d5d-463d-b252-f9158b97b6f7"
    }
};

async function testWebhook() {
    try {
        console.log('📤 Testing Webhook with payload...\n');
        console.log('Transcript length:', payload.transcript.length);
        console.log('Extracted data:', payload.extracted_data);
        console.log('\n⏳ Calling webhook...\n');

        const response = await axios.post('http://localhost:5001/webhook', payload, {
            timeout: 120000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ SUCCESS! Response received:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Log extracted data
        if (response.data.extracted_data) {
            console.log('\n📊 Extracted Data:');
            console.log(JSON.stringify(response.data.extracted_data, null, 2));
        }

    } catch (error) {
        console.error('❌ Error testing webhook:\n');
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('No response received from server');
            console.error('Make sure server is running on http://localhost:5001');
        } else {
            console.error('Error:', error.message);
        }
        
        process.exit(1);
    }
}

testWebhook();
