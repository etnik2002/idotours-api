require('dotenv').config();
const axios = require('axios');

const wiseConfig = {
  apiKey: process.env.WISE_API_KEY,
  baseUrl: 'https://api.wise.com',
};

const wiseClient = axios.create({
  baseURL: wiseConfig.baseUrl,
  headers: {
    Authorization: `Bearer ${wiseConfig.apiKey}`,
    'Content-Type': 'application/json',
  },
});

async function createWiseRecipient(profileId, recipientDetails) {
  try {
      const response = await wiseClient.post(`/v1/profiles/${profileId}/recipient-accounts`, recipientDetails);
      return response.data;
  } catch (error) {
      throw error;
  }
}

const createTransfer = async (transferDetails) => {
  try {
      const quote = await createQuote();

      const payload = {
          targetAccount: transferDetails.targetAccount,
          quote: quote.id,
          customerTransactionId: transferDetails.customerTransactionId,
          sourceCurrency: transferDetails.sourceCurrency,
          targetCurrency: transferDetails.targetCurrency,
          targetAmount: transferDetails.targetAmount,
          profile: transferDetails.profile,
          transferPurpose: transferDetails.transferPurpose,
          sourceAmount: transferDetails.sourceAmount,
          details: {
              recipientAccountId: transferDetails.recipientAccountId,
              reference: transferDetails.reference,
              transferPurpose: transferDetails.transferPurpose,
              sourceOfFunds: transferDetails.sourceOfFunds,
          },
      };


      const response = await wiseClient.post('/v1/transfers', payload);

      return response.data;
  } catch (error) {
      throw error;
  }
};

async function getAllRecipients(profileId) {
  try {
      const response = await wiseClient.get(`/v2/accounts?profile=${profileId}`);
      return response.data;
  } catch (error) {
      throw error;
  }
}


async function createQuote() {
  try {
      const response = await wiseClient.post(`/v3/quotes/`, {
          "sourceCurrency": "EUR",
          "targetCurrency": "EUR",
          "sourceAmount": null,
          "targetAmount": 110,
          "pricingConfiguration": {
            "fee": {
              "type": "OVERRIDE",
              "variable": 0.011,
              "fixed": 15.42
            }
          }
      });

      return response.data;
  } catch (error) {
      throw error;
  }
}


async function validateIBAN(iban) {
  try {
    return await axios.get(`https://api.ibanapi.com/v1/validate/${iban}?api_key=ae59141576843462e93ad2263e81e9db0629da07`)
  } catch (error) {
    throw error;
  }
}

module.exports = {wiseClient, createQuote, getAllRecipients, createTransfer, createWiseRecipient, validateIBAN};
