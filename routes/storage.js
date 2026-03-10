const router = require("express").Router();
const { createFile } = require("../controllers/storage-controller");


router.post("/create-file", createFile)

module.exports = router;