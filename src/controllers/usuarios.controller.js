const usuariosService = require("../services/usuarios.service");

async function listUsers(req, res, next) {
  try {
    const result = await usuariosService.listUsers();

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const result = await usuariosService.createUser(req.body, req.user);

    return res.status(201).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const result = await usuariosService.updateUser(req.params.id, req.body);

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
};
