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
    ticket: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ticket',
        required: true,
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
    },
    
    
} , { timestamps : true });

module.exports = mongoose.model("Booking", bookingSchema);
