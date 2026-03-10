const router = require("express").Router();
const { requestLimiter } = require("../auth/limiter");
const { createAgency, login, getById, getAll, editAgency, deleteAgency, sendOtp, verifyOtp, resetPassword, getMonthlySalesReport } = require("../controllers/agency-controller");

router.use(requestLimiter);

router.get("/", getAll);

router.post('/create', createAgency);

router.post("/login", login);

router.get("/:id", getById);

router.put('/:id', editAgency);

router.delete('/:id', deleteAgency);

router.post('/forgot-password', sendOtp);

router.post('/verify-otp', verifyOtp);

router.post('/reset-password', resetPassword);

router.get("/:id/monthly-report", getMonthlySalesReport);

module.exports = router;