require("dotenv").config()
const { depositAuth } = require("../auth/payment");
const { createCheckoutSession, createPaymentIntent, refund, cancelRefund, listAllCharges, listAllBalanceTransactions, getChargeByPaymentIntentId, createDeposit, getDeposits, createCustomer, createSetupIntent, retrieveCustomerPaymentMethods, detachUserPaymentMethod, initiateHalkbankPayment, halkbankCallback, getHalkbankPaymentStatus } = require("../controllers/payment-controller");
const { ok } = require("../functions/responses");
const router = require("express").Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.get("/transactions/list", listAllBalanceTransactions);

router.get("/charges/list", listAllCharges);

router.get("/charges/pid/:payment_intent_id", getChargeByPaymentIntentId)

router.post("/create-checkout-session", createCheckoutSession);

router.post("/create-payment-intent", createPaymentIntent);
router.post("/halkbank/initiate", initiateHalkbankPayment);
router.post("/halkbank/callback", halkbankCallback);
router.get("/halkbank/status/:order_id", getHalkbankPaymentStatus);

router.post("/create-setup-intent", createSetupIntent);

router.post("/create/customer", createCustomer);

router.get("/customer/retrieve-payment-methods/:customer_id", retrieveCustomerPaymentMethods);

router.post("/pm/detach/:payment_method_id/:user_id", detachUserPaymentMethod);

router.post("/refund/:payment_intent", refund);

router.post("/refund/cancel/:payment_intent", cancelRefund);

router.post('/deposit', depositAuth, createDeposit);

router.get('/deposit/all', getDeposits);

router.post("/quote/test", async (req, res) => {
    const quote = await stripe.quotes.create({
        line_items: [
            {
                price: 'price_CBb6IXqvTLXp3f',
                quantity: 5,
            },
            {
                price: 'price_HGd7M3DV3IMXkC',
            },
        ],
    });

    console.log({ quote });
    ok(res, "", quote)
})

module.exports = router;
