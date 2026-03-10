
class NotificationTypes {
    static NOT_ENOUGH_SEATS = "NOT_ENOUGH_SEATS";
    static GENERAL = "GENERAL";
    static AGENCY_DEBT = "AGENCY_DEBT";
}
class TravelFlexTypes {
    static PREMIUM = "PREMIUM";
    static BASIC = "BASIC";
    static NO_FLEX = "NO_FLEX";

}

class TravelFlexPermissions {
    static PREMIUM = {
        CAN_CANCEL: 2,
        CAN_EDIT: 1,
        RESCHEDULE: 3,
        SUPPORT: Infinity

    }

    static BASIC = {
        CAN_CANCEL: 5,
        CAN_EDIT: 3,
        RESCHEDULE: 0,
        SUPPORT: Infinity
    }

    static NO_FLEX = {
        CAN_CANCEL: 0,
        CAN_EDIT: 0,
        RESCHEDULE: 0,
        SUPPORT: Infinity
    }
}

class EnvTypes {
    static DEV = "DEV";
    static PROD = "PROD";
}

class PlatformTypes {
    static IOS = "IOS";
    static ANDROID = "ANDROID";
    static WEB = "WEB";
}
class IntentTypes {
    static CANCEL = "CANCEL";
    static EDIT_DETAILS = "EDIT_DETAILS";
    static RESCHEDULE = "RESCHEDULE";
    static CHANGE_FLEX = "CHANGE_FLEX";
    static REFUND = "REFUND";
}

class PaymentMethodTypes {
    static CARD = "card";
    static ACSS_DEBIT = "acss_debit";
    static AFFIRM = "affirm";
    static AFTERPAY_CLEARPAY = "afterpay_clearpay";
    static ALIPAY = "alipay";
    static AU_BECS_DEBIT = "au_becs_debit";
    static BACS_DEBIT = "bacs_debit";
    static BANCONTACT = "bancontact";
    static BLIK = "blik";
    static BOLETO = "boleto";
    static CASHAPP = "cashapp";
    static CUSTOMER_BALANCE = "customer_balance";
    static EPS = "eps";
    static FPX = "fpx";
    static GIROPAY = "giropay";
    static GRABPAY = "grabpay";
    static IDEAL = "ideal";
    static KLARNA = "klarna";
    static KONBINI = "konbini";
    static LINK = "link";
    static OXXO = "oxxo";
    static P24 = "p24";
    static PAYNOW = "paynow";
    static PIX = "pix";
    static PROMPTPAY = "promptpay";
    static SEPA_DEBIT = "sepa_debit";
    static SOFORT = "sofort";
    static US_BANK_ACCOUNT = "us_bank_account";
    static WECHAT_PAY = "wechat_pay";
}



module.exports = { NotificationTypes, TravelFlexTypes, TravelFlexPermissions, IntentTypes, PlatformTypes, EnvTypes, PaymentMethodTypes };
