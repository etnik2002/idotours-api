const router = require("express").Router();
const { requestLimiter } = require("../auth/limiter");
const { createOperator, login, getById, getAll, getOperatorLivechatMessages, edit, changeAutomaticPayoutSchedule, getDashboardUsers, getDashboardSession, createDashboardUser, updateDashboardUser, deleteDashboardUser } = require("../controllers/operator-controller");
const { verifyDashboardUser, verifyDashboardSuperAdmin } = require("../auth/dashboard-user");

router.use(requestLimiter);

router.post('/create', createOperator);

router.post("/edit/:id", edit)

router.post("/login", login);

router.get("/dashboard-session", verifyDashboardUser, getDashboardSession);
router.get("/dashboard-users", verifyDashboardSuperAdmin, getDashboardUsers);
router.post("/dashboard-users", verifyDashboardSuperAdmin, createDashboardUser);
router.put("/dashboard-users/:userId", verifyDashboardSuperAdmin, updateDashboardUser);
router.delete("/dashboard-users/:userId", verifyDashboardSuperAdmin, deleteDashboardUser);

router.get("/:id", getById);

router.get("/", getAll);

router.post('/automatic-payouts/:operatorId', changeAutomaticPayoutSchedule)

router.get("/messages/:operator_id", getOperatorLivechatMessages)

module.exports = router;
