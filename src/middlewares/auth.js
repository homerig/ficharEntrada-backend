const prisma = require("../config/prisma");
const AppError = require("../utils/appError");
const { verifyAuthToken } = require("../utils/auth");

function extractBearerToken(authorizationHeader) {
  const [type, token] = String(authorizationHeader || "").split(" ");

  if (type !== "Bearer" || !token) {
    throw new AppError("Se requiere un token de acceso.", 401, "AUTH_REQUIRED");
  }

  return token;
}

async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    const payload = verifyAuthToken(token);

    const user = await prisma.usuario.findUnique({
      where: { id: Number(payload.sub) },
      include: { rol: true },
    });

    if (!user || !user.activo) {
      throw new AppError("Usuario no autorizado.", 401, "UNAUTHORIZED");
    }

    req.user = {
      id: user.id,
      dni: user.dni,
      email: user.email,
      nombreApellido: user.nombre_apellido,
      role: user.rol.nombre,
    };

    return next();
  } catch (error) {
    return next(
      error instanceof AppError
        ? error
        : new AppError("No fue posible validar la sesion.", 401, "INVALID_TOKEN")
    );
  }
}

async function optionalAuth(req, res, next) {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      return next();
    }

    const token = extractBearerToken(authorizationHeader);
    const payload = verifyAuthToken(token);

    const user = await prisma.usuario.findUnique({
      where: { id: Number(payload.sub) },
      include: { rol: true },
    });

    if (!user || !user.activo) {
      return next();
    }

    req.user = {
      id: user.id,
      dni: user.dni,
      email: user.email,
      nombreApellido: user.nombre_apellido,
      role: user.rol.nombre,
    };

    return next();
  } catch (error) {
    return next();
  }
}

function requireRoles(allowedRoles) {
  return function validateRole(req, res, next) {
    if (!req.user) {
      return next(new AppError("Usuario no autenticado.", 401, "AUTH_REQUIRED"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError("No tenes permisos para esta accion.", 403, "FORBIDDEN"));
    }

    return next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRoles,
};
