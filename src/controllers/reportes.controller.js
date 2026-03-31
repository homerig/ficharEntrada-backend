const reportesService = require("../services/reportes.service");

async function downloadPunchesExcel(req, res, next) {
  try {
    const result = await reportesService.exportPunchesExcel(req.query);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${result.fileName}"`);
    res.setHeader("Content-Length", result.buffer.length);

    return res.status(200).send(result.buffer);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  downloadPunchesExcel,
};
