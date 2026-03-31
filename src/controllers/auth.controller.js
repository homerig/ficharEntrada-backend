const authService = require("../services/auth.service");

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
  try {
    return res.status(200).json({
      ok: true,
      data: req.user,
    });
  } catch (error) {
    return next(error);
  }
}

async function requestPasswordReset(req, res, next) {
  try {
    const result = await authService.requestPasswordReset(req.body);

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function confirmPasswordReset(req, res, next) {
  try {
    const result = await authService.confirmPasswordReset(req.body);

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
  me,
  requestPasswordReset,
  confirmPasswordReset,
};
