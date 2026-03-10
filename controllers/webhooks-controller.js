const { server_error, ok } = require("../functions/responses");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { adminWebhookReceiver } = require("../helpers/email");
const crypto = require('crypto');

module.exports = {
    stripe: async (req, res) => {
        try {
            const event = req.body;
            const obj = event.type.object;
            switch (obj) {
                case 'payment_intent.payment_failed':
                    adminWebhookReceiver(event.type, obj)
                    break;
                case 'charge.refunded':
                    // adminWebhookReceiver(event.type, obj)
                    break;
                case 'refund.failed':
                    // adminWebhookReceiver(event.type, obj)
                    break;
                case 'refund.created':
                    // adminWebhookReceiver(event.type, obj)
                    break;
                case 'charge.refunded':
                    adminWebhookReceiver(event.type, obj)
                    break;
                case 'refund.updated':
                    // adminWebhookReceiver(event.type, obj)
                    break;
                case 'charge.refund.updated':
                    // adminWebhookReceiver(event.type, obj)
                    break;
                case 'charge.dispute.funds_reinstated':
                    // adminWebhookReceiver(event.type, obj)
                    break;
                case 'source.refund_attributes_required':
                    // adminWebhookReceiver(event.type, obj)
                    break;
                case 'review.closed':
                    // adminWebhookReceiver(event.type, obj)
                    break;
                default:
                    console.log(`Unhandled event type ${event.type}`);
            }

            return res.status(200).json({ message: "Webhook received", data: null });
        } catch (error) {
            server_error(res, error.message, null);
        }
    },

    receiveAllStripeEvents: async (req, res) => {
        try {
            const events = await stripe.events.list();
            ok(res, "Webhook events data", events)
        } catch (error) {
            server_error(res, error.message, null);
        }
    },

    wise: async (req, res) => {
      try {
          const event = req.body;
          
          const signature = req.headers['x-signature-sha256'];
          const timestamp = req.headers['x-timestamp'];
          
          if (signature && timestamp) {
              const isValid = verifyWiseSignature(event, signature, timestamp);
              if (!isValid) {
                  return server_error(res, "Invalid webhook signature", null);
              }
          }

          if (event.event_type === 'transfers#state-change') {
              const transferData = event.data.resource;
              const newState = event.data.current_state;
              

              switch (newState) {
                  case 'incoming_payment_waiting':
                      // Payment is waiting to be received
                      await adminWebhookReceiver('transfer.waiting', {
                          transferId: transferData.id,
                          amount: transferData.amount,
                          sourceCurrency: transferData.source_currency,
                          targetCurrency: transferData.target_currency,
                          status: 'waiting_for_payment'
                      });
                      break;

                  case 'processing':
                      // Transfer is being processed
                      await adminWebhookReceiver('transfer.processing', {
                          transferId: transferData.id,
                          amount: transferData.amount,
                          status: 'processing'
                      });
                      break;

                  case 'funds_converted':
                      // Money has been converted
                      await adminWebhookReceiver('transfer.converted', {
                          transferId: transferData.id,
                          amount: transferData.amount,
                          rate: transferData.rate,
                          status: 'converted'
                      });
                      break;

                  case 'outgoing_payment_sent':
                      // Money has been sent to recipient
                      await adminWebhookReceiver('transfer.completed', {
                          transferId: transferData.id,
                          amount: transferData.amount,
                          recipientDetails: transferData.details,
                          status: 'completed'
                      });
                      break;

                  case 'cancelled':
                      // Transfer was cancelled
                      await adminWebhookReceiver('transfer.cancelled', {
                          transferId: transferData.id,
                          reason: transferData.cancel_reason,
                          status: 'cancelled'
                      });
                      break;

                  case 'failed':
                      // Transfer failed
                      await adminWebhookReceiver('transfer.failed', {
                          transferId: transferData.id,
                          errorCode: transferData.error_code,
                          errorMessage: transferData.error_message,
                          status: 'failed'
                      });
                      break;

                  default:
                      console.log(`Unhandled transfer state: ${newState}`);
              }
          }

          return ok(res, "Webhook received from Wise", null);
      } catch (error) {
          return server_error(res, error.message, null);
      }
  }
};

function verifyWiseSignature(payload, signature, timestamp) {
  try {
      const signaturePayload = `${timestamp}.${JSON.stringify(payload)}`;
      const expectedSignature = crypto
          .createHmac('sha256', process.env.WISE_WEBHOOK_SECRET)
          .update(signaturePayload)
          .digest('hex');
      
      return crypto.timingSafeEqual(
          Buffer.from(expectedSignature),
          Buffer.from(signature)
      );
  } catch (error) {
      return false;
  }
}