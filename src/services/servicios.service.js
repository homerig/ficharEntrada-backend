const prisma = require("../config/prisma");
const AppError = require("../utils/appError");
const { normalizeShiftList, parseTimeToMinutes } = require("../utils/shifts");

const DEFAULT_SHIFT_TOLERANCE_MINUTES = Number.parseInt(
  process.env.APP_SHIFT_TOLERANCE_MINUTES || "60",
  10
);

function normalizeName(value) {
  return String(value || "").trim();
}

function validateCoordinates(lat, lon) {
  const parsedLat = Number(lat);
  const parsedLon = Number(lon);

  if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
    throw new AppError("La latitud es invalida.", 400, "INVALID_LAT");
  }

  if (!Number.isFinite(parsedLon) || parsedLon < -180 || parsedLon > 180) {
    throw new AppError("La longitud es invalida.", 400, "INVALID_LNG");
  }

  return { lat: parsedLat, lon: parsedLon };
}

function validateRadius(radioMetros) {
  const value = Number(radioMetros);

  if (!Number.isInteger(value) || value < 10 || value > 5000) {
    throw new AppError("El radio en metros es invalido.", 400, "INVALID_RADIUS");
  }

  return value;
}

function validateCutoffTime(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalizedValue = String(value).trim();

  if (!/^\d{2}:\d{2}$/.test(normalizedValue)) {
    throw new AppError(
      "La hora límite debe tener formato HH:mm.",
      400,
      "INVALID_CUTOFF_TIME"
    );
  }

  return normalizedValue;
}

function validateShiftToleranceMinutes(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return DEFAULT_SHIFT_TOLERANCE_MINUTES;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 720) {
    throw new AppError(
      "La tolerancia entre turnos debe ser un entero entre 0 y 720 minutos.",
      400,
      "INVALID_SHIFT_TOLERANCE"
    );
  }

  return parsedValue;
}

function mapShift(shift) {
  return {
    id: shift.id,
    horaInicio: shift.hora_inicio,
    horaFin: shift.hora_fin,
    orden: shift.orden,
  };
}

function validateShifts(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new AppError("Los turnos deben enviarse como un arreglo.", 400, "INVALID_SHIFTS");
  }

  let normalizedShifts;

  try {
    normalizedShifts = normalizeShiftList(
      value.map((shift) => {
        if (typeof shift === "string") {
          return { horaInicio: shift };
        }

        if (!shift || typeof shift !== "object") {
          throw new AppError("Cada turno debe ser un objeto valido.", 400, "INVALID_SHIFT");
        }

        return {
          horaInicio: shift.horaInicio,
          horaFin: shift.horaFin ?? null,
        };
      })
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(error.message, 400, "INVALID_SHIFT_START");
  }

  for (const shift of normalizedShifts) {
    try {
      parseTimeToMinutes(shift.horaInicio, "La hora de inicio del turno debe tener formato HH:mm.");
    } catch (error) {
      throw new AppError(error.message, 400, "INVALID_SHIFT_START");
    }

    if (shift.horaFin) {
      try {
        parseTimeToMinutes(shift.horaFin, "La hora de fin del turno debe tener formato HH:mm.");
      } catch (error) {
        throw new AppError(error.message, 400, "INVALID_SHIFT_END");
      }
    }
  }

  return normalizedShifts;
}

function getLegacyCutoffTime(payload, normalizedShifts) {
  if (normalizedShifts !== undefined) {
    return normalizedShifts[0]?.horaInicio ?? null;
  }

  if (payload.horaEntradaLimite !== undefined) {
    return validateCutoffTime(payload.horaEntradaLimite);
  }

  return undefined;
}

function getEffectiveShifts(payload, normalizedShifts) {
  if (normalizedShifts !== undefined) {
    return normalizedShifts;
  }

  if (payload.horaEntradaLimite !== undefined) {
    const horaEntradaLimite = validateCutoffTime(payload.horaEntradaLimite);

    if (!horaEntradaLimite) {
      return [];
    }

    return [
      {
        horaInicio: horaEntradaLimite,
        horaFin: null,
        orden: 0,
      },
    ];
  }

  return undefined;
}

function mapService(service) {
  const mappedShifts = Array.isArray(service.turnos)
    ? [...service.turnos].sort((a, b) => a.orden - b.orden || a.hora_inicio.localeCompare(b.hora_inicio)).map(mapShift)
    : [];

  return {
    id: service.id,
    nombre: service.nombre,
    lat: service.lat,
    lon: service.lon,
    radioMetros: service.radio_metros,
    horaEntradaLimite: service.hora_entrada_limite ?? mappedShifts[0]?.horaInicio ?? null,
    toleranciaTurnoMinutos:
      service.tolerancia_turno_minutos ?? DEFAULT_SHIFT_TOLERANCE_MINUTES,
    activo: service.activo,
    turnos: mappedShifts,
  };
}

async function listServices({ includeInactive = true } = {}) {
  const services = await prisma.servicio.findMany({
    where: includeInactive ? undefined : { activo: true },
    include: {
      turnos: {
        orderBy: [{ orden: "asc" }, { hora_inicio: "asc" }],
      },
    },
    orderBy: [{ nombre: "asc" }],
  });

  return services.map(mapService);
}

async function createService(payload) {
  const nombre = normalizeName(payload.nombre);

  if (!nombre) {
    throw new AppError("El nombre del servicio es obligatorio.", 400, "INVALID_SERVICE_NAME");
  }

  const { lat, lon } = validateCoordinates(payload.lat, payload.lon);
  const radioMetros = validateRadius(payload.radioMetros ?? 200);
  const turnos = validateShifts(payload.turnos);
  const effectiveShifts = getEffectiveShifts(payload, turnos);
  const horaEntradaLimite = getLegacyCutoffTime(payload, turnos);
  const toleranciaTurnoMinutos = validateShiftToleranceMinutes(payload.toleranciaTurnoMinutos);

  try {
    const service = await prisma.servicio.create({
      data: {
        nombre,
        lat,
        lon,
        radio_metros: radioMetros,
        hora_entrada_limite: horaEntradaLimite,
        tolerancia_turno_minutos: toleranciaTurnoMinutos ?? DEFAULT_SHIFT_TOLERANCE_MINUTES,
        activo: payload.activo !== false,
        ...(effectiveShifts !== undefined
          ? {
              turnos: {
                create: effectiveShifts.map((shift) => ({
                  hora_inicio: shift.horaInicio,
                  hora_fin: shift.horaFin,
                  orden: shift.orden,
                })),
              },
            }
          : {}),
      },
      include: {
        turnos: {
          orderBy: [{ orden: "asc" }, { hora_inicio: "asc" }],
        },
      },
    });

    return mapService(service);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError("Ya existe un servicio con ese nombre.", 409, "SERVICE_ALREADY_EXISTS");
    }

    throw error;
  }
}

async function updateService(serviceId, payload) {
  const id = Number(serviceId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("El id del servicio es invalido.", 400, "INVALID_SERVICE_ID");
  }

  const existingService = await prisma.servicio.findUnique({
    where: { id },
  });

  if (!existingService) {
    throw new AppError("Servicio no encontrado.", 404, "SERVICE_NOT_FOUND");
  }

  const data = {};

  if (payload.nombre !== undefined) {
    const nombre = normalizeName(payload.nombre);

    if (!nombre) {
      throw new AppError("El nombre del servicio es obligatorio.", 400, "INVALID_SERVICE_NAME");
    }

    data.nombre = nombre;
  }

  if (payload.lat !== undefined || payload.lon !== undefined) {
    const { lat, lon } = validateCoordinates(
      payload.lat !== undefined ? payload.lat : existingService.lat,
      payload.lon !== undefined ? payload.lon : existingService.lon
    );

    data.lat = lat;
    data.lon = lon;
  }

  if (payload.radioMetros !== undefined) {
    data.radio_metros = validateRadius(payload.radioMetros);
  }

  const turnos = validateShifts(payload.turnos);
  const effectiveShifts = getEffectiveShifts(payload, turnos);
  const horaEntradaLimite = getLegacyCutoffTime(payload, turnos);
  const toleranciaTurnoMinutos = validateShiftToleranceMinutes(payload.toleranciaTurnoMinutos);

  if (horaEntradaLimite !== undefined) {
    data.hora_entrada_limite = horaEntradaLimite;
  }

  if (toleranciaTurnoMinutos !== undefined) {
    data.tolerancia_turno_minutos = toleranciaTurnoMinutos;
  }

  if (payload.activo !== undefined) {
    data.activo = Boolean(payload.activo);
  }

  try {
    const service = await prisma.servicio.update({
      where: { id },
      data: {
        ...data,
        ...(effectiveShifts !== undefined
          ? {
              turnos: {
                deleteMany: {},
                create: effectiveShifts.map((shift) => ({
                  hora_inicio: shift.horaInicio,
                  hora_fin: shift.horaFin,
                  orden: shift.orden,
                })),
              },
            }
          : {}),
      },
      include: {
        turnos: {
          orderBy: [{ orden: "asc" }, { hora_inicio: "asc" }],
        },
      },
    });

    return mapService(service);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError("Ya existe un servicio con ese nombre.", 409, "SERVICE_ALREADY_EXISTS");
    }

    throw error;
  }
}

async function setServiceStatus(serviceId, activo) {
  const id = Number(serviceId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("El id del servicio es invalido.", 400, "INVALID_SERVICE_ID");
  }

  const existingService = await prisma.servicio.findUnique({
    where: { id },
    include: {
      turnos: {
        orderBy: [{ orden: "asc" }, { hora_inicio: "asc" }],
      },
    },
  });

  if (!existingService) {
    throw new AppError("Servicio no encontrado.", 404, "SERVICE_NOT_FOUND");
  }

  const service = await prisma.servicio.update({
    where: { id },
    data: { activo: Boolean(activo) },
    include: {
      turnos: {
        orderBy: [{ orden: "asc" }, { hora_inicio: "asc" }],
      },
    },
  });

  return mapService(service);
}

async function deleteService(serviceId) {
  const id = Number(serviceId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("El id del servicio es invalido.", 400, "INVALID_SERVICE_ID");
  }

  const existingService = await prisma.servicio.findUnique({
    where: { id },
    include: {
      turnos: true,
    },
  });

  if (!existingService) {
    throw new AppError("Servicio no encontrado.", 404, "SERVICE_NOT_FOUND");
  }

  try {
    const deletedService = await prisma.servicio.delete({
      where: { id },
      include: {
        turnos: true,
      },
    });

    return mapService(deletedService);
  } catch (error) {
    if (error.code === "P2003") {
      throw new AppError(
        "No se puede eliminar el servicio porque tiene fichadas asociadas.",
        409,
        "SERVICE_HAS_ASSOCIATED_RECORDS"
      );
    }

    throw error;
  }
}

module.exports = {
  listServices,
  createService,
  updateService,
  setServiceStatus,
  deleteService,
};
