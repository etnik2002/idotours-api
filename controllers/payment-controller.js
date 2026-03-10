require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { default: mongoose } = require("mongoose");
const { calculateTotalAmount } = require("../functions/passenger");
const { server_error, ok, bad_request, error_404 } = require("../functions/responses");
const Deposit = require("../models/Deposit");
const User = require("../models/User");
const { users } = require("../appwrite/appwrite.config");

module.exports = {
    createCheckoutSession: async (req, res) => {
        try {
            const { passengers } = req.body;

            let line_items = passengers?.map((passenger) => ({
                price_data: {
                    currency: "eur",
                    product_data: {
                        name: passenger?.full_name,
                    },
                    unit_amount: Math.round(passenger?.price * 100),
                },
                quantity: 1,
            }));

            if (!line_items) {
                line_items = [
                    {
                        price_data: {
                            currency: "eur",
                            product_data: {
                                name: "etnik zeqiri",
                            },
                            unit_amount: Math.round(123 * 100),
                        },
                        quantity: 1,
                    }
                ]
            }


            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                line_items: line_items,
                mode: 'payment',
                success_url: `${process.env.DOMAIN_URL}/payment?success=true`,
                cancel_url: `${process.env.DOMAIN_URL}/payment?canceled=true`,
            });

            ok(res, "checkout_session_created", { session_id: session?.id });
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

    createPaymentIntent: async (req, res) => {
        try {
            let data = {
                amount: parseInt(req.body.amount_in_cents),
                currency: "eur",
                automatic_payment_methods: {
                    enabled: true,
                },
                metadata: {
                    ticket_id: req.body.ticket_id || null,
                }
            };
    
            let auto_capture = false;
            if (req.query.use_saved_card == 'true' && req.query.customer_id && req.query.customer_id.trim() !== "" && req.query.payment_method_id && req.query.payment_method_id.trim() !== "") {
                data.customer = req.query.customer_id.trim();
                data.payment_method = req.query.payment_method_id;
                auto_capture = true;
            }
    
            let paymentIntent = await stripe.paymentIntents.create(data);
            
            if (auto_capture) {
                paymentIntent = await stripe.paymentIntents.confirm(
                    paymentIntent.id,
                    {
                        payment_method: req.query.payment_method_id,
                        return_url: 'https://www.gobusly.com',
                    }
                );
    
                return res.status(200).json({
                    message: "Payment captured automatically",
                    data: paymentIntent,
                    auto_capture: true
                });
            }
    
            ok(res, "payment_intent_created", { clientSecret: paymentIntent.client_secret, auto_capture: false });
        } catch (error) {
            server_error(res, error.message, null);
        }
    }
,

    createSetupIntent: async (req, res) => {
        try {
            // this endpount creates a payment intent and saves customer card data to use in the future
            const setupIntent = await stripe.setupIntents.create({ customer: req.query.customer_id, payment_method_types: ["card"] });

            const paymentMethod = await stripe.paymentMethods.attach(req.body.payment_method_id, { customer: req.query.customer_id });

            const user = await User.findByIdAndUpdate(
                req.query.user_id,
                { $push: { stripe_payment_method_ids: req.body.payment_method_id } },
                { new: true }
            );
            
            const updatedCustomer = await stripe.customers.update(req.query.customer_id, {
                invoice_settings: {
                    default_payment_method: paymentMethod.id,
                },
            });

            ok(res, "setup_intent_created", { paymentMethod, setupIntent, updatedCustomer, user });
        } catch (error) {
            server_error(res, error.message, null)
        }
    },

    createDeposit: async (req, res) => {
        try {
            if (!req.body.amount_in_cents || req.body.amount_in_cents === 0) {
                return res.status(403).json({ message: "Please specify an amount to deposit", data: null });
            }

            let userId = req.user.$id;
            let query;

            const deposit_data = {
                amount_in_cents: req.body.amount_in_cents,
                currency: req.body.currency || "EUR",
                payment_intent_id: req.body.payment_intent_id
            };

            if (mongoose.Types.ObjectId.isValid(req.user.$id)) {
                deposit_data.user = req.user.$id;
                query = { _id: req.user.$id }
            } else {
                deposit_data.appwrite_user_id = req.user.$id;
                query = { appwrite_id: req.user.$id }
            }

            const newDeposit = new Deposit(deposit_data);
            await newDeposit.save();

            const updatedUser = await User.findOne(query);

            if (updatedUser) {
                updatedUser.balance_in_cents = (updatedUser.balance_in_cents || 0) + req.body.amount_in_cents;
                await updatedUser.save();
                return res.status(201).json({ message: "Deposit successfully saved", data: null });
            } else {
                return res.status(404).json({ message: "User not found", data: null });
            }
        } catch (error) {
            server_error(res, error.message || (error.response && error.response.message) || "Server error", null);
        }
    },


    getDeposits: async (req, res) => {
        try {
            let { select, page = 1, limit = 10 } = req.query;

            page = parseInt(page);
            limit = parseInt(limit);

            const skip = (page - 1) * limit;

            const deposits = await Deposit.find({})
                .select(select)
                .populate({
                    path: "user",
                    select: "email name"
                })
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: 'desc' });

            return res.status(200).json({ message: "Deposit data", data: deposits });
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

    listAllBalanceTransactions: async (req, res) => {
        try {
            const transactions = await stripe.balanceTransactions.list({
                limit: 100,
            });

            ok(res, "transactions", transactions)
        } catch (error) {
            server_error(res, "server error", null)
        }
    },

    listAllCharges: async (req, res) => {
        try {
            const charges = await stripe.charges.list({
                limit: 100,
            });

            ok(res, "Charges", charges)
        } catch (error) {
            server_error(res, "server error", null)
        }
    },

    getChargeByPaymentIntentId: async (req, res) => {
        try {
            const charge = await stripe.charges.list({
                limit: 1,
                payment_intent: req.params.payment_intent_id || "pi_3Px7UtDAZApOs2EV1Qr7HhgX"
            });

            ok(res, "Charge", charge.data[0])
        } catch (error) {
            server_error(res, "", null);
        }
    },


    refund: async (req, res, next) => {
        try {
            if (!req.params.payment_intent_id || req.params.payment_intent_id == "") {
                bad_request(res, "Please provide a valid payment_intent", null);
            }

            if (req.params.payment_intent_id === "full_deposit_payment") {
                req.body.is_full_deposit_payment = true;
                next();
            }

            if (!req.body.amount_in_cents || req.body.amount_in_cents < 1) {
                bad_request(res, "Please provide a valid amount in cents", null);
            }

            const refund = await stripe.refunds.create({
                payment_intent: req.params.payment_intent_id,
                amount: req.body.amount_in_cents,
            });
            if (!refund) {
                bad_request(res, "Refund wasnt successfull. Please try again", null);
            }

            // ok(res, `A refund of € ${(req.body.amount_in_cents / 100).toFixed(2)} has been successfully processed.`, refund);
            next()
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

    cancelRefund: async (req, res) => {
        try {
            if (!req.params.payment_intent || req.params.payment_intent == "") {
                bad_request(res, "Please provide a valid payment_intent", null);
            }

            const refund = await stripe.refunds.cancel(req.params.payment_intent);

            if (!refund) {
                bad_request(res, "Refund wasnt successfull. Please try again", null);
            }

            ok(res, `Refund with payment_intent of ${req.params.payment_intent} was successfully canceled.`, refund);
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

    createCustomer: async (req, res) => {
        try {
            await stripe.customers.create({
                name: req.body.full_name,
                email: req.body.email,
            });
            ok(res, "Customer created", null);
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

    createCustomerPaymentMethod: async (req, res) => {
        try {
            let { customer } = req.body;
            if (customer != {}) {
                customer = await stripe.customers.create({
                    name: req.body.name,
                    email: req.body.email,
                });
            }

            const paymentMethod = await stripe.paymentMethods.create({
                type: req.body.type || 'card',
                us_bank_account: {
                    account_holder_type: 'individual',
                    account_number: req.body.account_number,
                    routing_number: req.body.routing_number,
                },
                billing_details: {
                    name: req.body.name,
                },
            });

            ok(res, "Payment method created", null);
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

    detachUserPaymentMethod: async (req, res) => {
        try {
            const detached = await stripe.paymentMethods.detach(
                req.params.payment_method_id
            );


            ok(res, "Detached", null)
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    },

    retrieveCustomerPaymentMethods: async (req, res) => {
        try {
            const paymentMethods = await stripe.customers.listPaymentMethods(
                req.params.customer_id,
                {
                    limit: 100,
                }
            );
            ok(res, "Payment methods", paymentMethods)
        } catch (error) {
            server_error(res, error.message || error.response.message, null);
        }
    }

}

