function parseTimeToMinutes(value, errorMessage = "La hora debe tener formato HH:mm.") {
  const normalizedValue = String(value || "").trim();

  if (!/^\d{2}:\d{2}$/.test(normalizedValue)) {
    throw new Error(errorMessage);
  }

  const [hours, minutes] = normalizedValue.split(":").map(Number);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(errorMessage);
  }

  return hours * 60 + minutes;
}

function normalizeShiftList(shifts = []) {
  const uniqueShiftMap = new Map();

  for (const shift of shifts) {
    const horaInicio = String(shift.horaInicio || "").trim();

    if (!horaInicio) {
      continue;
    }

    const minutes = parseTimeToMinutes(horaInicio);
    const key = String(minutes);

    if (!uniqueShiftMap.has(key)) {
      uniqueShiftMap.set(key, {
        horaInicio,
        horaFin: shift.horaFin ? String(shift.horaFin).trim() : null,
      });
    }
  }

  return Array.from(uniqueShiftMap.entries())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, shift], index) => ({
      ...shift,
      orden: index,
    }));
}

function resolveServiceShiftStarts(service) {
  if (Array.isArray(service?.turnos) && service.turnos.length > 0) {
    return normalizeShiftList(
      service.turnos.map((shift) => ({
        horaInicio: shift.hora_inicio ?? shift.horaInicio,
        horaFin: shift.hora_fin ?? shift.horaFin ?? null,
      }))
    ).map((shift) => shift.horaInicio);
  }

  if (service?.hora_entrada_limite) {
    return [String(service.hora_entrada_limite)];
  }

  return [];
}

function evaluatePunchAgainstShifts(entryTime, shiftStarts, upcomingShiftToleranceMinutes = 60) {
  if (!entryTime || !Array.isArray(shiftStarts) || shiftStarts.length === 0) {
    return {
      isLate: false,
      assignedShift: null,
      minutesLate: 0,
    };
  }

  const entryMinutes = parseTimeToMinutes(entryTime);
  const sortedShifts = [...shiftStarts]
    .map((shiftStart) => ({
      shiftStart,
      minutes: parseTimeToMinutes(shiftStart),
    }))
    .sort((a, b) => a.minutes - b.minutes);

  const nextShiftIndex = sortedShifts.findIndex((shift) => shift.minutes >= entryMinutes);
  let assignedShift;

  if (nextShiftIndex === -1) {
    assignedShift = sortedShifts[sortedShifts.length - 1];
  } else {
    const nextShift = sortedShifts[nextShiftIndex];
    const minutesUntilNextShift = nextShift.minutes - entryMinutes;

    if (minutesUntilNextShift <= upcomingShiftToleranceMinutes) {
      assignedShift = nextShift;
    } else if (nextShiftIndex > 0) {
      assignedShift = sortedShifts[nextShiftIndex - 1];
    } else {
      assignedShift = nextShift;
    }
  }

  const minutesLate = Math.max(0, entryMinutes - assignedShift.minutes);

  return {
    isLate: minutesLate > 0,
    assignedShift: assignedShift.shiftStart,
    minutesLate,
  };
}

module.exports = {
  evaluatePunchAgainstShifts,
  normalizeShiftList,
  parseTimeToMinutes,
  resolveServiceShiftStarts,
};
