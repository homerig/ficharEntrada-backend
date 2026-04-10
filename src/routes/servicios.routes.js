const express = require("express");
const {
  listServices,
  createService,
  updateService,
  deactivateService,
  activateService,
  deleteService,
} = require("../controllers/servicios.controller");
const { requireAuth, requireRoles } = require("../middlewares/auth");
const { MANAGEMENT_ALLOWED_ROLES } = require("../constants/roles");

const router = express.Router();

router.use(requireAuth);

router.get("/", listServices);
router.post("/", requireRoles(MANAGEMENT_ALLOWED_ROLES), createService);
router.patch("/:id", requireRoles(MANAGEMENT_ALLOWED_ROLES), updateService);
router.patch("/:id/deactivate", requireRoles(MANAGEMENT_ALLOWED_ROLES), deactivateService);
router.patch("/:id/activate", requireRoles(MANAGEMENT_ALLOWED_ROLES), activateService);
router.delete("/:id", requireRoles(MANAGEMENT_ALLOWED_ROLES), deleteService);

module.exports = router;
