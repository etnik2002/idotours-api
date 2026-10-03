const mongoose = require("mongoose");
const { IntentTypes, TravelFlexTypes, Platforms, PlatformTypes } = require("../helpers/types");

const bookingSchema = mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    appwrite_user_id:{
        type: String,
    },
    external_id: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
    },
    ticket: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
        required: true,
    },
    return_booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
    },
    route: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Route',
        required: true,
    },
    agency: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agency',
    },
    operator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Operator',
    },
    affiliate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Affiliate',
    },
    departure_date: { type: Date },
    destinations: {
        departure_station: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Station",
        },
        arrival_station: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Station",
        },
        departure_station_label: {
            type: String,
        },
        arrival_station_label: {
            type: String,
        },
    },
    labels: {
        from_city: { type: String },
        to_city: { type: String },
    },
    passengers: [
        {
            full_name: {
                type: String,
            },
            email: {
                type: String,
            },
            phone: {
                type: String,
            },
            birthdate: {
                type: String,
            },
            age: {
                type: Number,
            },
            price: {
                type: Number,
            },
            is_scanned: {
                type: Boolean,
                default: false,
            },
            luggages_price: {
                type: Number,
            },
            total_luggages: {
                type: Number,
            },
        }
    ],
    location: {
        from: {
            lat: { type: Number },
            lng: { type: Number }
        },
        to: {
            lat: { type: Number },
            lng: { type: Number }
        },
    },
    price: {
        type: Number,
    },
    service_fee: {
        type: Number,
    },
    platform: {
        type: String,
        enum: [PlatformTypes.IOS, PlatformTypes.ANDROID, PlatformTypes.WEB],
        default: PlatformTypes.WEB,
    },
    is_paid: {
        type: Boolean,
        enum: ['true', 'false'],
        default: 'false',
    },
    live_mode: {
        type: Boolean,
        enum: ['true', 'false'],
        default: 'true',
    },
    is_agency_debt_paid: {
        type: Boolean,
        default: false,
    },
    metadata: {
        transaction_id: {
            type: String,
        },
        payment_intent_id: {
            type: String,
        },
        payment_processor: {
            type: String,
        },
        halkbank: {
            auth_code: String,
            transaction_id: String,
            host_ref_num: String,
        },
        travel_flex: {
            type: String,
            enum: [TravelFlexTypes.PREMIUM, TravelFlexTypes.BASIC, TravelFlexTypes.NO_FLEX],
            default: TravelFlexTypes.NO_FLEX
        },
        can_cancel_booking_until: {
            type: Date,
        },
        can_edit_booking_until: {
            type: Date,
        },
        intents: [
            {
                type: String,
                enum: [IntentTypes.CANCEL, IntentTypes.EDIT_DETAILS, IntentTypes.RESCHEDULE, IntentTypes.CHANGE_FLEX, IntentTypes.REFUND],
                created_at: { type: Date, default: Date.now }
            }
        ],
        deposited_money: {
            used: {
                type: Boolean,
            },
            amount_in_cents: {
                type: Number,
            },
        },
        refund_action: {
            amount_in_cents: Number,
            is_refunded: {
                type: Boolean, 
                default: false,
            },
        },
        download_url: {
            type: String
        },
        reminders: {
            email_departure_reminder_sent: { type: Boolean, default: false },
            sms_departure_reminder_sent: { type: Boolean, default: false },
        },
        discount_codde: {type: String},
        discount_amount_in_cents: {type: Number},
        wallet_pass_added: { type: Boolean, default: false },
        open_return: { type: Boolean, default: false },
        internal_comment: { type: String, trim: true },
        ticket_comment: { type: String, trim: true },
        departure_time: { type: String, trim: true },
        destination_country: { type: String, trim: true },
        price_currency: {
            type: String,
            enum: ["EUR", "CHF"],
            default: "EUR",
        },
        exchange_rates: {
            chf_to_mkd: Number,
        },
    },
    
    
} , { timestamps : true });

const getExternalIdCountryCode = (booking) => {
    const source =
        booking?.metadata?.destination_country ||
        booking?.labels?.to_city ||
        booking?.destinations?.arrival_station_label ||
        "XX";
    const normalized = String(source)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase();
    return (normalized.slice(0, 2) || "XX").padEnd(2, "X");
};

bookingSchema.pre("validate", async function generateExternalBookingId(next) {
    if (this.external_id) return next();

    const countryCode = getExternalIdCountryCode(this);

    try {
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const randomNumber = Math.floor(100000 + Math.random() * 900000);
            const candidate = `IDB-${countryCode}${randomNumber}`;
            const existing = await this.constructor.exists({
                external_id: candidate,
                _id: { $ne: this._id },
            });

            if (!existing) {
                this.external_id = candidate;
                return next();
            }
        }

        next(new Error("Could not generate a unique booking external id"));
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model("Booking", bookingSchema);
