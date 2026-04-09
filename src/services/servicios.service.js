const prisma = require("../config/prisma");
const AppError = require("../utils/appError");

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

function mapService(service) {
  return {
    id: service.id,
    nombre: service.nombre,
    lat: service.lat,
    lon: service.lon,
    radioMetros: service.radio_metros,
    horaEntradaLimite: service.hora_entrada_limite,
    activo: service.activo,
  };
}

async function listServices({ includeInactive = true } = {}) {
  const services = await prisma.servicio.findMany({
    where: includeInactive ? undefined : { activo: true },
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
  const horaEntradaLimite = validateCutoffTime(payload.horaEntradaLimite);

  try {
    const service = await prisma.servicio.create({
      data: {
        nombre,
        lat,
        lon,
        radio_metros: radioMetros,
        hora_entrada_limite: horaEntradaLimite,
        activo: payload.activo !== false,
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

  if (payload.horaEntradaLimite !== undefined) {
    data.hora_entrada_limite = validateCutoffTime(payload.horaEntradaLimite);
  }

  if (payload.activo !== undefined) {
    data.activo = Boolean(payload.activo);
  }

  try {
    const service = await prisma.servicio.update({
      where: { id },
      data,
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
  });

  if (!existingService) {
    throw new AppError("Servicio no encontrado.", 404, "SERVICE_NOT_FOUND");
  }

  const service = await prisma.servicio.update({
    where: { id },
    data: { activo: Boolean(activo) },
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
  });

  if (!existingService) {
    throw new AppError("Servicio no encontrado.", 404, "SERVICE_NOT_FOUND");
  }

  try {
    const deletedService = await prisma.servicio.delete({
      where: { id },
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
