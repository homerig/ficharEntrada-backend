const serviciosService = require("../services/servicios.service");

async function listServices(req, res, next) {
  try {
    const result = await serviciosService.listServices({
      includeInactive: req.query.includeInactive !== "false",
    });

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function createService(req, res, next) {
  try {
    const result = await serviciosService.createService(req.body);

    return res.status(201).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateService(req, res, next) {
  try {
    const result = await serviciosService.updateService(req.params.id, req.body);

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

async function deleteService(req, res, next) {
  try {
    const result = await serviciosService.deleteService(req.params.id);

    return res.status(200).json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listServices,
  createService,
  updateService,
  deleteService,
};
