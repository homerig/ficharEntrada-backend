const express = require("express");
const {
  login,
  me,
  requestPasswordReset,
  confirmPasswordReset,
} = require("../controllers/auth.controller");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

router.post("/login", login);
router.post("/password-reset/request", requestPasswordReset);
router.post("/password-reset/confirm", confirmPasswordReset);
router.get("/me", requireAuth, me);

module.exports = router;
