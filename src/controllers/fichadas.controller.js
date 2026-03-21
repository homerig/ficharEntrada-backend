const fichadasService = require("../services/fichadas.service");

async function fichar(req, res, next) {
  try {
    const result = await fichadasService.registrarFichada(req.body);

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  fichar,
};
