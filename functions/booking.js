const moment = require("moment-timezone");
const { TravelFlexTypes } = require("../helpers/types");


const calculateFlexDates = (departureDate, travelFlex) => {
    const departure = moment.utc(departureDate);
    
    switch(travelFlex) {
      case TravelFlexTypes.PREMIUM:
        return {
          can_cancel_until: departure.clone().subtract(2, 'days').toDate(),
          can_edit_until: departure.clone().subtract(1, 'days').toDate()
        };
      case TravelFlexTypes.BASIC:
        return {
          can_cancel_until: departure.clone().subtract(5, 'days').toDate(),
          can_edit_until: departure.clone().subtract(3, 'day').toDate()
        };
      default: 
        return {
          can_cancel_until: null,
          can_edit_until: null
        };
    }
  };

  module.exports = { calculateFlexDates }