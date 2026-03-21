const express = require("express");
const { fichar } = require("../controllers/fichadas.controller");

const router = express.Router();

router.post("/fichar", fichar);

module.exports = router;
