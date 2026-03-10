const router = require("express").Router();
const { claim, create } = require("../controllers/voucher-controller");

router.post('/create', create);

router.post('/claim/:voucher_id/:user_id', claim);

module.exports = router;