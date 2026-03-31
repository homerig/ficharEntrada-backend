const prisma = require("../config/prisma");
const { findNearestService } = require("../utils/geo");
const AppError = require("../utils/appError");
const { ROLES } = require("../constants/roles");
const { ensureRoles } = require("./auth.service");
const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Argentina/Buenos_Aires";

function normalizeDni(dni) {
  return String(dni || "").trim();
}

function normalizeDeviceId(deviceId) {
  return String(deviceId || "").trim();
}

function normalizeOptionalName(nombreApellido) {
  const value = String(nombreApellido || "").trim();
  return value || null;
}

function validatePayload(payload) {
  const dni = normalizeDni(payload.dni);
  const deviceId = normalizeDeviceId(payload.deviceId);
  const nombreApellido = normalizeOptionalName(payload.nombreApellido);
  const lat = Number(payload.lat);
  const lng = Number(payload.lng);

  if (!/^\d{7,10}$/.test(dni)) {
    throw new AppError("El DNI es invalido.", 400, "INVALID_DNI");
  }

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new AppError("La latitud es invalida.", 400, "INVALID_LAT");
  }

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new AppError("La longitud es invalida.", 400, "INVALID_LNG");
  }

  if (!deviceId || deviceId.length < 6) {
    throw new AppError("El identificador del dispositivo es inválido.", 400, "INVALID_DEVICE_ID");
  }

  return {
    dni,
    lat,
    lng,
    deviceId,
    fingerprint: payload.fingerprint ?? null,
    nombreApellido,
  };
}

function getStartOfDay(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

async function findActiveServiceOrFail(lat, lng) {
  const services = await prisma.servicio.findMany({
    where: { activo: true },
  });

  const nearestService = findNearestService(
    lat,
    lng,
    services,
    Math.max(...services.map((service) => service.radio_metros || 200), 200)
  );

  if (!nearestService) {
    throw new AppError(
      "No estas dentro de una zona valida para fichar.",
      400,
      "OUT_OF_SERVICE_AREA"
    );
  }

  const allowedRadius = nearestService.radio_metros || 200;

  if (nearestService.distanceMeters > allowedRadius) {
    throw new AppError(
      "No estas dentro de una zona valida para fichar.",
      400,
      "OUT_OF_SERVICE_AREA"
    );
  }

  return nearestService;
}

async function ensureUser(payload, now, tx) {
  const existingUser = await tx.usuario.findUnique({
    where: { dni: payload.dni },
    include: { rol: true },
  });

  if (!existingUser) {
    throw new AppError(
      "El usuario no existe y necesita registro previo.",
      409,
      "NEEDS_REGISTRATION",
      { needsRegistration: true }
    );
  }

  if (!existingUser.activo) {
    throw new AppError("El usuario se encuentra inactivo.", 403, "USER_INACTIVE");
  }

  if (existingUser.device_id && existingUser.device_id !== payload.deviceId) {
    throw new AppError(
      "Este usuario ya tiene un dispositivo asignado.",
      403,
      "DEVICE_MISMATCH"
    );
  }

  const userData = {
    device_last_seen_at: now,
  };

  if (!existingUser.device_id) {
    userData.device_id = payload.deviceId;
    userData.device_registered_at = now;
  }

  if (payload.fingerprint !== null) {
    userData.device_fingerprint = payload.fingerprint;
  }

  if (Object.keys(userData).length === 0) {
    return existingUser;
  }

  return tx.usuario.update({
    where: { id: existingUser.id },
    data: userData,
    include: { rol: true },
  });
}

async function registerEmployeePunch(tx, user, service, payload, now, date) {
  const firstPunchOfDay = await tx.fichada.findFirst({
    where: {
      usuario_id: user.id,
      fecha: date,
    },
    include: {
      servicio: true,
    },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
  });

  if (!firstPunchOfDay) {
    const punch = await tx.fichada.create({
      data: {
        usuario_id: user.id,
        fecha: date,
        entrada: now,
        lat: payload.lat,
        lon: payload.lng,
        servicio_id: service.id,
        fingerprint: payload.fingerprint,
      },
      include: {
        servicio: true,
      },
    });

    return {
      action: "ENTRADA",
      punch,
    };
  }

  const punch = await tx.fichada.update({
    where: { id: firstPunchOfDay.id },
    data: {
      salida: now,
      fingerprint: payload.fingerprint,
    },
    include: {
      servicio: true,
    },
  });

  return {
    action: "SALIDA",
    punch,
  };
}

async function registerSupervisorPunch(tx, user, service, payload, now, date) {
  const existingPunch = await tx.fichada.findFirst({
    where: {
      usuario_id: user.id,
      fecha: date,
    },
    include: {
      servicio: true,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
  });

  if (!existingPunch || existingPunch.salida) {
    const punch = await tx.fichada.create({
      data: {
        usuario_id: user.id,
        fecha: date,
        entrada: now,
        lat: payload.lat,
        lon: payload.lng,
        servicio_id: service.id,
        fingerprint: payload.fingerprint,
      },
      include: {
        servicio: true,
      },
    });

    return {
      action: "ENTRADA",
      punch,
    };
  }

  if (!existingPunch.salida) {
    if (existingPunch.servicio_id !== service.id) {
      await tx.fichada.update({
        where: { id: existingPunch.id },
        data: {
          salida: now,
          fingerprint: payload.fingerprint,
        },
      });

      const punch = await tx.fichada.create({
        data: {
          usuario_id: user.id,
          fecha: date,
          entrada: now,
          lat: payload.lat,
          lon: payload.lng,
          servicio_id: service.id,
          fingerprint: payload.fingerprint,
        },
        include: {
          servicio: true,
        },
      });

      return {
        action: "TRASLADO",
        punch,
      };
    }

    const punch = await tx.fichada.update({
      where: { id: existingPunch.id },
      data: {
        salida: now,
        fingerprint: payload.fingerprint,
      },
      include: {
        servicio: true,
      },
    });

    return {
      action: "SALIDA",
      punch,
    };
  }

  throw new AppError("No fue posible registrar la fichada.", 409, "PUNCH_CONFLICT");
}

async function registerPunch(tx, user, service, payload, now) {
  const date = getStartOfDay(now);

  if (user.rol?.nombre === ROLES.EMPLOYEE) {
    return registerEmployeePunch(tx, user, service, payload, now, date);
  }

  return registerSupervisorPunch(tx, user, service, payload, now, date);
}

async function registrarFichada(payload) {
  await ensureRoles();

  const validatedPayload = validatePayload(payload);
  const now = new Date();
  const service = await findActiveServiceOrFail(validatedPayload.lat, validatedPayload.lng);

  const result = await prisma.$transaction(async (tx) => {
    const user = await ensureUser(validatedPayload, now, tx);
    const punchResult = await registerPunch(tx, user, service, validatedPayload, now);

    return {
      action: punchResult.action,
      usuario: {
        id: user.id,
        dni: user.dni,
        nombreApellido: user.nombre_apellido,
      },
      servicio: {
        id: service.id,
        nombre: service.nombre,
        distanceMeters: Number(service.distanceMeters.toFixed(2)),
      },
      fichada: {
        id: punchResult.punch.id,
        fecha: punchResult.punch.fecha,
        entrada: punchResult.punch.entrada,
        salida: punchResult.punch.salida,
      },
    };
  });

  return result;
}

module.exports = {
  registrarFichada,
  AppError,
};
