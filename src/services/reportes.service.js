const ExcelJS = require("exceljs");
const prisma = require("../config/prisma");
const AppError = require("../utils/appError");

const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Argentina/Buenos_Aires";

function pad(value) {
  return String(value).padStart(2, "0");
}

function getDatePartsInTimezone(date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return values;
}

function formatDate(date) {
  if (!date) {
    return "";
  }

  const parts = getDatePartsInTimezone(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDateTime(date) {
  if (!date) {
    return "";
  }

  const parts = getDatePartsInTimezone(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function formatTime(date) {
  if (!date) {
    return "";
  }

  const parts = getDatePartsInTimezone(date);
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

function getTimeFromDate(date) {
  const parts = getDatePartsInTimezone(date);
  return `${parts.hour}:${parts.minute}`;
}

function isLatePunch(punch) {
  if (!punch.entrada || !punch.servicio?.hora_entrada_limite) {
    return false;
  }

  return getTimeFromDate(punch.entrada) > punch.servicio.hora_entrada_limite;
}

function getDateRange(filters) {
  if (filters.date && filters.month) {
    throw new AppError("No se puede filtrar por día y mes al mismo tiempo.", 400, "INVALID_DATE_FILTER");
  }

  if (filters.date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(filters.date));

    if (!match) {
      throw new AppError("El filtro date debe tener formato YYYY-MM-DD.", 400, "INVALID_DATE");
    }

    const [, year, month, day] = match;
    const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    const end = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

    return { gte: start, lte: end };
  }

  if (filters.month) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(filters.month));

    if (!match) {
      throw new AppError("El filtro month debe tener formato YYYY-MM.", 400, "INVALID_MONTH");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

    const start = new Date(`${year}-${pad(month)}-01T00:00:00.000Z`);
    const end = new Date(`${nextMonth.year}-${pad(nextMonth.month)}-01T00:00:00.000Z`);

    return { gte: start, lt: end };
  }

  return undefined;
}

async function getPunches(filters) {
  const where = {};
  const fecha = getDateRange(filters);

  if (fecha) {
    where.fecha = fecha;
  }

  if (filters.employeeId !== undefined) {
    const employeeId = Number(filters.employeeId);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      throw new AppError("El identificador del empleado es inválido.", 400, "INVALID_EMPLOYEE_ID");
    }

    where.usuario_id = employeeId;
  }

  if (filters.serviceId !== undefined) {
    const serviceId = Number(filters.serviceId);

    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      throw new AppError("El identificador del servicio es inválido.", 400, "INVALID_SERVICE_ID");
    }

    where.servicio_id = serviceId;
  }

  const punches = await prisma.fichada.findMany({
    where,
    include: {
      usuario: {
        include: {
          rol: true,
        },
      },
      servicio: true,
    },
    orderBy: [{ fecha: "desc" }, { entrada: "desc" }],
  });

  const lateOnly = String(filters.lateOnly || "false").toLowerCase() === "true";

  return punches.filter((punch) => !lateOnly || isLatePunch(punch));
}

async function exportPunchesExcel(filters) {
  const punches = await getPunches(filters);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Fichadas");

  sheet.columns = [
    { header: "Nombre y apellido", key: "empleado", width: 30 },
    { header: "DNI", key: "dni", width: 16 },
    { header: "Entrada", key: "entrada", width: 14 },
    { header: "Salida", key: "salida", width: 14 },
    { header: "Día", key: "dia", width: 14 },
    { header: "Servicio", key: "servicio", width: 28 },
  ];

  for (const punch of punches) {
    const row = sheet.addRow({
      empleado: punch.usuario.nombre_apellido,
      dni: punch.usuario.dni,
      entrada: formatTime(punch.entrada),
      salida: formatTime(punch.salida),
      dia: formatDate(punch.fecha),
      servicio: punch.servicio.nombre,
    });

    if (isLatePunch(punch)) {
      row.getCell("entrada").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF4CCCC" },
      };
      row.getCell("entrada").font = {
        color: { argb: "FF9C0006" },
      };
    }
  }

  sheet.getRow(1).font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E78" },
  };
  sheet.getRow(1).alignment = {
    vertical: "middle",
    horizontal: "center",
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    fileName: `reporte-fichadas-${Date.now()}.xlsx`,
    buffer: Buffer.from(buffer),
    total: punches.length,
  };
}

module.exports = {
  exportPunchesExcel,
};
