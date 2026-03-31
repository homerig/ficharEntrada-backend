const express = require("express");
const { downloadPunchesExcel } = require("../controllers/reportes.controller");
const { requireAuth, requireRoles } = require("../middlewares/auth");
const { DOWNLOAD_ALLOWED_ROLES } = require("../constants/roles");

const router = express.Router();

router.use(requireAuth, requireRoles(DOWNLOAD_ALLOWED_ROLES));

router.get("/fichadas/excel", downloadPunchesExcel);

module.exports = router;
