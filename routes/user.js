const router = require("express").Router();
const { requestLimiter } = require("../auth/limiter");
const { verifySuperAdmin } = require("../auth/super-admin");
const { createAuthToken } = require("../auth/user");
const { createUser, login, getById, createDbUser, getAll, getUserSessions,updateNotifications  , deleteUserSession, deleteUser, createAppwriteUser, getByEmail, editName, editPhone, sendOtp, verifyOtp, exportUserData } = require("../controllers/user-controller");

router.use(requestLimiter);

router.post('/create', createUser);

router.post('/create/db', createDbUser);

router.post('/create/appwrite', createAppwriteUser);

router.post("/login", login);

router.get("/:id", getById);

router.get("/get/email", getByEmail);

router.post('/generate/auth-token', createAuthToken);

router.post("/delete/:user_id", deleteUser);

router.get('/list/all', verifySuperAdmin, getAll);

router.get('/sessions/:user_id', getUserSessions);

router.post("/session/delete/:user_id/:session_id", deleteUserSession);

router.post("/otp/send", sendOtp)

router.post("/otp/validate", verifyOtp)

router.post('/name/edit/:id', editName);

router.post('/phone/edit/:id', editPhone);

router.post('/notifications/update/:id', updateNotifications);

router.post("/download-data/:id", exportUserData)

module.exports = router;