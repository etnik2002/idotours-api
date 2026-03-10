const { server_error } = require('../functions/responses');
const { createWiseRecipient, getAllRecipients, createTransfer, createQuote } = require('../functions/banking.config');

// IBAN VALIDATOR API
// https://api.ibanapi.com/v1/validate/MK0720380220031120990520287?api_key=ae59141576843462e93ad2263e81e9db0629da07

module.exports = {
    createRecipient: async (req, res) => {
        try {
            const recipientDetails = {
                currency: 'EUR',
                type: 'iban',
                profile: "P83846827",
                accountHolderName: req.body.accountHolderName,
                legalType: 'PRIVATE',
                details: {
                    iban: req.body.iban,
                    swiftCode: req.body.swiftCode,
                },
            };

            const recipient = await createWiseRecipient("P83846827", recipientDetails);
            return res.status(201).json(recipient);
        } catch (error) {
            server_error(res, error.message);
        }
    },

    getRecipients: async (req,res) => {
        try {
            const recipients = await getAllRecipients("P83846827");
            return res.status(201).json(recipients);
        } catch (error) {
            server_error(res, error.message)
        }
    },




    sendMoney: async (req, res) => {
        try {
            const requiredParams = ['sourceCurrency', 'targetCurrency', 'targetAmount', 'profile', 'transferPurpose', 'sourceAmount', 'recipientAccountId'];
            const missingParams = requiredParams.filter(param => !req.query[param]);

            if (missingParams.length > 0) {
                return res.status(400).json({
                    error: `Missing required parameters: ${missingParams.join(', ')}`
                });
            }
            const quote = await createQuote()
            // const transferDetails = {
            //     targetAccount: req.query.targetAccount,
            //     quote: req.query.quoteUuid,
            //     sourceCurrency: req.query.sourceCurrency,
            //     targetCurrency: req.query.targetCurrency,
            //     targetAmount: req.query.targetAmount,
            //     customerTransactionId: req.query.customerTransactionId,
            //     profile: req.query.profile,
            //     transferPurpose: req.query.transferPurpose,
            //     sourceAmount: req.query.sourceAmount,
            //     recipientAccountId: req.query.recipientAccountId,
            //     reference: req.query.reference || "to my friend",
            //     sourceOfFunds: req.query.sourceOfFunds || "verification.source.of.funds.other"
            // };

            const transferDetails = {
                targetAccount: req.query.targetAccount,
                quote: quote.id,
                sourceCurrency: req.query.sourceCurrency,
                targetCurrency: req.query.targetCurrency,
                targetAmount: req.query.targetAmount,
                profile: req.query.profile,
            };


            const transfer = await createTransfer(transferDetails);
            return res.status(201).json(transfer);
        } catch (error) {
            return res.status(error.response?.status || 500).json({
                error: error.response?.data || error.message
            });
        }
    },
    


}

