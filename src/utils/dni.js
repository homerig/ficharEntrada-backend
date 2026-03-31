function isValidDni(dni) {
  const value = String(dni || "").trim();
  return value === "0" || /^\d{7,10}$/.test(value);
}

module.exports = {
  isValidDni,
};
