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
const { ROLES } = require("../constants/roles");

const router = express.Router();

router.use(requireAuth);

router.get("/", listServices);
router.post("/", requireRoles([ROLES.ADMINISTRADOR]), createService);
router.patch("/:id", requireRoles([ROLES.ADMINISTRADOR]), updateService);
router.patch("/:id/deactivate", requireRoles([ROLES.ADMINISTRADOR]), deactivateService);
router.patch("/:id/activate", requireRoles([ROLES.ADMINISTRADOR]), activateService);
router.delete("/:id", requireRoles([ROLES.ADMINISTRADOR]), deleteService);

module.exports = router;
