const { createApplicant, getAll } = require("../controllers/applicant-controller");

const router = require("express").Router();

router.post("/create", createApplicant);

router.get('/all', getAll)

module.exports = router;