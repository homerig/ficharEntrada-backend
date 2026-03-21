function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;
  const code = error.code || "INTERNAL_SERVER_ERROR";

  return res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message: error.message || "Ocurrio un error interno.",
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

module.exports = errorHandler;
