require("dotenv").config();
const { GoogleAuth } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');

const createGooglePass = async (ticket, qr_code) => {
  try {
    const credentials = require('../credentials/google/google-service-account.json');
    
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
    });

    const authClient = await auth.getClient();
    const walletobjects = google.walletobjects({ version: 'v1', auth: authClient });

    const ISSUER_ID = process.env.GOOGLE_PASS_ISSUER_ID;
    const classId = `${ISSUER_ID}.bus_ticket_class`; 
    
    const transitClass = {
      id: classId,
      issuerName: 'GoBusly',
      transitType: 'BUS',
      reviewStatus: 'UNDER_REVIEW',
      logo: {
        sourceUri: {
          uri: 'https://ph-files.imgix.net/fd3cbc20-0872-4a89-9363-119924a9e60c.png?auto=format'
        },
        contentDescription: {
          defaultValue: {
            language: 'en-US',
            value: 'GoBusly Logo'
          }
        }
      }
    };

    try {
      await walletobjects.transitclass.insert({
        requestBody: transitClass
      });
    } catch (error) {
      if (error.code === 409) {
      } else {
      }
    }

    const transitObject = {
      id: `${classId}.${ticket._id}`, 
      classId: classId,
      state: 'ACTIVE',
      tripType: 'ONE_WAY',
      passengerName: ticket.passengers?.[0]?.full_name || 'Passenger',
      
      ticketLeg: {
        originStationCode: ticket.labels?.from_city?.toUpperCase() || 'ORIGIN',
        destinationStationCode: ticket.labels?.to_city?.toUpperCase() || 'DESTINATION',
        departureDateTime: ticket.departure_date.toISOString(),
        operator: ticket.operator?.name || 'GoBusly'
      },

      barcode: {
        type: 'QR_CODE',
        value: qr_code
      }
    };

    const payload = {
      iss: credentials.client_email,
      aud: 'google',
      origins: ['https://gobusly.com'],
      typ: 'savetowallet',
      payload: {
        transitObjects: [transitObject]
      },
      iat: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(payload, credentials.private_key, {
      algorithm: 'RS256'
    });

    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;
    return saveUrl;

  } catch (error) {
    throw error;
  }
};

module.exports = { createGooglePass };
