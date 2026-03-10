const router = require("express").Router();

const apicache = require("apicache");
const { getDebtsForOperatorsFromSelectedDates, getDebtsForOperatorsByMonth, getRevenueAnalytics, getRevenueByMonth } = require("../controllers/reports-controller");
const cache = apicache.middleware;

router.get('/revenue/analytics', getRevenueAnalytics)

router.get('/revenue/by-month', cache("5 minutes"), getRevenueByMonth)

router.get('/debts/date-range', cache("5 minutes"), getDebtsForOperatorsFromSelectedDates);

router.get('/debts/month', cache("5 minutes"), getDebtsForOperatorsByMonth);


module.exports = router;