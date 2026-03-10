require("dotenv").config()

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = require('twilio')(accountSid, authToken);

function sendBookingReminderMessage(to_number, body) {
    console.log({to_number})
    try {
        client.messages
        .create({
            body,
            to: to_number, 
            messagingServiceSid: process.env.TWILIO_SERVICE_ID
        })
        .then((message) => console.log(message));
    } catch (error) {
        return error;
    }
}

module.exports = { sendBookingReminderMessage };