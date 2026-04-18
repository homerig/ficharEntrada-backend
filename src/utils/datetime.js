const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Argentina/Buenos_Aires";

function getDatePartsInTimezone(date, timeZone = APP_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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

function getDateStringInTimezone(date, timeZone = APP_TIMEZONE) {
  const parts = getDatePartsInTimezone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDateOnly(date) {
  if (!date) {
    return "";
  }

  return new Date(date).toISOString().slice(0, 10);
}

module.exports = {
  APP_TIMEZONE,
  formatDateOnly,
  getDatePartsInTimezone,
  getDateStringInTimezone,
};
