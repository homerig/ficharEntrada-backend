function getHealth(req, res) {
  return res.status(200).json({
    ok: true,
    message: "API operativa",
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  getHealth,
};
