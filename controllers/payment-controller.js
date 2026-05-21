require("dotenv").config();
const crypto = require("crypto");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { default: mongoose } = require("mongoose");
const { calculateTotalAmount } = require("../functions/passenger");
const { server_error, ok, bad_request, error_404 } = require("../functions/responses");
const Deposit = require("../models/Deposit");
const User = require("../models/User");
const PendingPayment = require("../models/PendingPayment");
const Booking = require("../models/Booking");
const { create: createBooking } = require("./booking-controller");
const { users } = require("../appwrite/appwrite.config");

const HALKBANK_CURRENCY_CODE = "807";
const HALKBANK_STORE_TYPE = "3d_pay_hosting";
const DEFAULT_EUR_TO_MKD_RATE = 61.5;

function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value || value.trim() === "") {
        throw new Error(`${name} is not configured`);
    }
    return value.trim();
}

function getPublicApiUrl(req) {
    const configuredUrl = process.env.HALKBANK_CALLBACK_BASE_URL || process.env.API_URL || process.env.BACKEND_URL;
    if (configuredUrl) {
        return configuredUrl.replace(/\/$/, "");
    }

    const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
    return `${protocol}://${req.get("host")}`;
}

function getFrontendUrl() {
    return (process.env.FRONTEND_URL || process.env.DOMAIN_URL || "http://localhost:3000").replace(/\/$/, "");
}

function escapeHashValue(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/\|/g, "\\|");
}

function createHalkbankHash(params, storeKey) {
    const hashData = Object.keys(params)
        .sort()
        .map((key) => escapeHashValue(params[key]))
        .join("|");

    return crypto
        .createHash("sha512")
        .update(`${hashData}|${storeKey}`, "utf8")
        .digest("base64");
}

function getHalkbankAmountInMkd(amountInEur) {
    const rate = Number(process.env.HALKBANK_EUR_TO_MKD_RATE || DEFAULT_EUR_TO_MKD_RATE);
    const normalizedRate = Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_EUR_TO_MKD_RATE;
    return Number((amountInEur * normalizedRate).toFixed(2));
}

function verifyHalkbankCallbackHash(body, storeKey) {
    const responseHash = body.HASH || body.hash;
    const hashParams = body.HASHPARAMS || body.HASH_PARAMS;

    if (!responseHash || !hashParams) {
        return true;
    }

    const hashParamsVal = body.HASHPARAMSVAL || String(hashParams)
        .split(":")
        .filter(Boolean)
        .map((key) => String(body[key] ?? ""))
        .join("");

    const calculatedHash = crypto
        .createHash("sha512")
        .update(`${hashParamsVal}${storeKey}`, "utf8")
        .digest("base64");

    try {
        return crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(responseHash));
    } catch (error) {
        return false;
    }
}

function sendPaymentRedirect(res, url, title) {
    return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="refresh" content="0;url=${url}">
          <title>${title}</title>
        </head>
        <body>
          <div style="text-align:center;padding:50px;font-family:Arial,sans-serif;">
            <h2>${title}</h2>
            <p>Redirecting...</p>
            <p><a href="${url}">Click here if you are not redirected automatically</a></p>
          </div>
          <script>
            (function() {
              var redirectUrl = ${JSON.stringify(url)};
              try {
                if (window.top && window.top !== window.self) {
                  window.top.location.href = redirectUrl;
                  return;
                }
              } catch(e) {}
              try {
                if (window.parent && window.parent !== window.self) {
                  window.parent.location.href = redirectUrl;
                  return;
                }
              } catch(e) {}
              window.location.replace(redirectUrl);
            })();
          </script>
        </body>
        </html>
      `);
}

module.exports = {
    initiateHalkbankPayment: async (req, res) => {
        try {
            const { amount, bookingRequests, bookingSummaries = [] } = req.body;
            const normalizedAmount = Number(amount);

            if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
                return bad_request(res, "Please provide a valid payment amount", null);
            }

            if (!Array.isArray(bookingRequests) || bookingRequests.length < 1) {
                return bad_request(res, "No booking requests were provided", null);
            }

            const storeKey = getRequiredEnv("HALKBANK_STORE_KEY");
            const clientId = getRequiredEnv("HALKBANK_CLIENT_ID");
            const postUrl = getRequiredEnv("HALKBANK_GATEWAY_URL");
            const orderId = `HB${Date.now()}${crypto.randomBytes(4).toString("hex")}`;
            const rnd = crypto.randomBytes(10).toString("hex");
            const callbackUrl = `${getPublicApiUrl(req)}/payment/halkbank/callback`;
            const halkbankAmount = getHalkbankAmountInMkd(normalizedAmount);

            await PendingPayment.create({
                orderId,
                amount: Number(normalizedAmount.toFixed(2)),
                currency: HALKBANK_CURRENCY_CODE,
                status: "pending",
                bookingRequests,
                bookingSummaries,
                bankResponse: {
                    originalAmountEur: Number(normalizedAmount.toFixed(2)),
                    halkbankAmountMkd: halkbankAmount,
                    exchangeRate: Number(process.env.HALKBANK_EUR_TO_MKD_RATE || DEFAULT_EUR_TO_MKD_RATE),
                },
            });

            const params = {
                clientid: clientId,
                amount: halkbankAmount.toFixed(2),
                oid: orderId,
                okUrl: callbackUrl,
                failUrl: callbackUrl,
                trantype: "Auth",
                currency: HALKBANK_CURRENCY_CODE,
                rnd,
                storetype: HALKBANK_STORE_TYPE,
                hashAlgorithm: "ver3",
                lang: "en",
            };

            return ok(res, "halkbank_payment_initiated", {
                postUrl,
                fields: {
                    ...params,
                    encoding: "UTF-8",
                    hash: createHalkbankHash(params, storeKey),
                },
                orderId,
            });
        } catch (error) {
            server_error(res, error.message, null);
        }
    },

    halkbankCallback: async (req, res) => {
        const frontendUrl = getFrontendUrl();

        try {
            const bankResponse = req.body || {};
            const orderId = bankResponse.oid || bankResponse.OID;
            const responseStatus = bankResponse.Response || bankResponse.response;
            const errorMessage = bankResponse.ErrMsg || bankResponse.mdErrorMsg || "Payment declined";

            if (!orderId) {
                return sendPaymentRedirect(
                    res,
                    `${frontendUrl}/checkout/error?error=missing_order_id`,
                    "Payment Failed",
                );
            }

            const storeKey = getRequiredEnv("HALKBANK_STORE_KEY");
            if (!verifyHalkbankCallbackHash(bankResponse, storeKey)) {
                await PendingPayment.findOneAndUpdate(
                    { orderId },
                    { status: "failed", bankResponse, failureMessage: "Invalid Halkbank callback hash" },
                );

                return sendPaymentRedirect(
                    res,
                    `${frontendUrl}/checkout/error?paymentId=${encodeURIComponent(orderId)}&error=invalid_hash`,
                    "Payment Failed",
                );
            }

            if (responseStatus !== "Approved") {
                await PendingPayment.findOneAndUpdate(
                    { orderId },
                    { status: "failed", bankResponse, failureMessage: errorMessage },
                );

                return sendPaymentRedirect(
                    res,
                    `${frontendUrl}/checkout/error?paymentId=${encodeURIComponent(orderId)}&error=${encodeURIComponent(errorMessage)}`,
                    "Payment Failed",
                );
            }

            let pendingPayment = await PendingPayment.findOne({ orderId });
            if (!pendingPayment) {
                return sendPaymentRedirect(
                    res,
                    `${frontendUrl}/checkout/error?paymentId=${encodeURIComponent(orderId)}&error=payment_not_found`,
                    "Payment Failed",
                );
            }

            if (pendingPayment.status !== "approved") {
                pendingPayment = await PendingPayment.findOneAndUpdate(
                    { orderId, status: { $in: ["pending", "failed"] } },
                    { status: "processing", bankResponse },
                    { new: true },
                ) || pendingPayment;

                if (pendingPayment.status === "processing") {
                    const createdBookingIds = await processHalkbankBookings(pendingPayment, bankResponse);
                    pendingPayment.status = "approved";
                    pendingPayment.createdBookingIds = createdBookingIds;
                    pendingPayment.processedAt = new Date();
                    pendingPayment.bankResponse = bankResponse;
                    await pendingPayment.save();
                }
            }

            const firstBookingId = pendingPayment.createdBookingIds?.[0]?.toString() || "";
            return sendPaymentRedirect(
                res,
                `${frontendUrl}/checkout/success?paymentId=${encodeURIComponent(orderId)}&bookingId=${encodeURIComponent(firstBookingId)}`,
                "Payment Successful",
            );
        } catch (error) {
            console.error("Halkbank callback error:", error);
            return sendPaymentRedirect(
                res,
                `${frontendUrl}/checkout/error?error=internal_error`,
                "Payment Failed",
            );
        }
    },

    getHalkbankPaymentStatus: async (req, res) => {
        try {
            const pendingPayment = await PendingPayment.findOne({ orderId: req.params.order_id });
            if (!pendingPayment) {
                return error_404(res, "Payment not found", null);
            }

            const booking = pendingPayment.createdBookingIds?.length
                ? await Booking.findById(pendingPayment.createdBookingIds[0]).populate({ path: "operator", select: "name" })
                : null;

            return ok(res, "halkbank_payment_status", {
                orderId: pendingPayment.orderId,
                status: pendingPayment.status,
                amount: pendingPayment.amount,
                createdBookingIds: pendingPayment.createdBookingIds,
                bookingSummaries: pendingPayment.bookingSummaries,
                failureMessage: pendingPayment.failureMessage,
                booking: booking ? {
                    _id: booking._id,
                    departure_date: booking.departure_date,
                    price: booking.price,
                    operator: booking.operator,
                    metadata: booking.metadata,
                    destinations: booking.destinations,
                } : null,
            });
        } catch (error) {
            server_error(res, error.message, null);
        }
    },

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
            console.log({ paymentIntent });

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

async function processHalkbankBookings(pendingPayment, bankResponse) {
    const createdBookingIds = [];
    const paymentIntentId = pendingPayment.orderId;

    for (const bookingRequest of pendingPayment.bookingRequests) {
        const body = {
            ...bookingRequest.body,
            payment_intent_id: paymentIntentId,
            halkbank: {
                auth_code: bankResponse.AuthCode || bankResponse.authCode || null,
                transaction_id: bankResponse.TransId || bankResponse.TRANID || null,
                host_ref_num: bankResponse.HostRefNum || null,
            },
        };

        const createdBooking = await createBookingWithController({
            operatorId: bookingRequest.operatorId,
            userId: bookingRequest.userId || null,
            ticketId: bookingRequest.ticketId,
            body,
        });

        createdBookingIds.push(createdBooking._id);
    }

    return createdBookingIds;
}

function createBookingWithController({ operatorId, userId, ticketId, body }) {
    return new Promise((resolve, reject) => {
        const req = {
            params: {
                operator_id: operatorId,
                user_id: userId || "null",
                ticket_id: ticketId,
            },
            body,
        };

        const res = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                if (this.statusCode >= 400) {
                    return reject(new Error(payload?.message || "Failed to create booking"));
                }
                return resolve(payload?.data || payload);
            },
        };

        Promise.resolve(createBooking(req, res)).catch(reject);
    });
}
