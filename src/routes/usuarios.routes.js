const express = require("express");
const { listUsers, createUser, updateUser } = require("../controllers/usuarios.controller");
const { requireAuth, requireRoles, optionalAuth } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const router = express.Router();

router.post("/", optionalAuth, createUser);

router.use(requireAuth, requireRoles([ROLES.ADMINISTRADOR]));
router.get("/", listUsers);
router.patch("/:id", updateUser);

module.exports = router;
