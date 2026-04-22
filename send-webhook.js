#!/usr/bin/env node

const http = require('http');

// Your complete payload
const payload = {
    "id": "0832dab1-fb89-4e1f-95b3-62ad8cec7941",
    "agent_id": "7af528fb-df51-497e-9178-0ed2d787ef5d",
    "batch_id": null,
    "created_at_str": null,
    "updated_at_str": null,
    "scheduled_at": null,
    "answered_by_voice_mail": null,
    "conversation_duration": 105,
    "total_cost": 12.39,
    "transcript": "assistant: नमस्कार TVS कस्टमर सपोर्ट में आपका स्वागत है। मैं Priya आपकी किस प्रकार मदद कर सकती हूँ?\nuser: hello प्रिया मेरा ना vehicle ख़राब हो गया है\nassistant: मैं समझ सकती हूँ ये कितना परेशान करने वाला है — आप चिंता मत कीजिए, मैं अभी मदद करती हूँ। बस जल्दी से — आपका नाम, पिनकोड, और TVS गाड़ी का registration number बताइए।\nuser: मेरा नाम ankit है और मेरा pin code two seven seven zero zero one है और मेरा model का नाम गाड़ी के model का नाम m h zero one a b one two three four five six है\nassistant: अच्छा, वर्षा मैम — पिनकोड और registration number थोड़ा स्पष्ट बताइए। पिनकोड 2 7 7 0 0 1 है क्या? और registration number में \"एम एच\" के बाद के हिस्से फिर से बताइए।\nuser: mh zero one a b one two three four five six\nassistant: आपका pincode है — दोसौ सत्ताईस — शून्य शून्य एक — क्या यह सही है?  \nऔर आपकी गाड़ी का number है — एम एच — शून्य एक — ए बी — एक दो तीन चार पांच छह — क्या यह सही है?\nuser: हां बिल्कुल सही है\nassistant: समझ गई — अभी technician भेज रही हूँ। वे लगभग 2 घंटे में पहुँच जाएंगे। क्या मैं आपकी और किसी तरह मदद कर सकती हूँ?\nuser: नहीं\nassistant: ठीक है, वर्षा मैम। आपकी मदद कर पाकर खुशी हुई। TVS Customer Service से संपर्क करने के लिए धन्यवाद। Safe ride करें!\nuser: sorry sorry क्या बोला\nassistant: कोई बात नहीं, वर्षा मैम। मैंने कहा — आपकी मदद कर पाकर खुशी हुई। TVS Customer Service से संपर्क करने के लिए धन्यवाद। Safe ride करें!",
    "extracted_data": {
        "Service booking": {
            "service booking": {
                "objective": "Complete address registration_number",
                "subjective": null
            }
        }
    },
    "telephony_data": {
        "duration": "106",
        "to_number": "+918795583362",
        "from_number": "+918035735856",
        "recording_url": "https://bolna-recordings-india.s3.ap-south-1.amazonaws.com/plivo/f48cb58b-2d5d-463d-b252-f9158b97b6f7.mp3",
        "hosted_telephony": true,
        "provider_call_id": "f48cb58b-2d5d-463d-b252-f9158b97b6f7",
        "call_type": "outbound",
        "provider": "plivo",
        "hangup_by": "Callee",
        "hangup_reason": "Call recipient hungup",
        "hangup_provider_code": 4000,
        "ring_duration": 3,
        "post_dial_delay": 1,
        "to_number_carrier": null
    }
};

const jsonString = JSON.stringify(payload);

const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/webhook',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(jsonString)
    }
};

console.log('📤 Sending webhook request...');
console.log('Payload size:', Buffer.byteLength(jsonString), 'bytes');

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\n✅ Response Status:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('\n📊 Response Body:');
        try {
            console.log(JSON.stringify(JSON.parse(data), null, 2));
        } catch (e) {
            console.log(data);
        }
    });
});

req.on('error', (e) => {
    console.error('❌ Error:', e.message);
});

req.write(jsonString);
req.end();
