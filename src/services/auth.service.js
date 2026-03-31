const prisma = require("../config/prisma");
const AppError = require("../utils/appError");
const { ROLES } = require("../constants/roles");
const {
  createAuthToken,
  hashPassword,
  verifyPassword,
  generateResetCode,
  hashResetCode,
} = require("../utils/auth");
const { sendPasswordResetEmail } = require("./notifications.service");
const { isValidDni } = require("../utils/dni");

const ADMIN_DNI = process.env.ADMIN_DNI ? String(process.env.ADMIN_DNI).trim() : null;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;
const ADMIN_NAME = process.env.ADMIN_NAME || "Administrador";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ? String(process.env.ADMIN_EMAIL).trim().toLowerCase() : null;
const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 15);

function normalizeDni(dni) {
  return String(dni || "").trim();
}

function normalizePassword(password) {
  return String(password || "");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function ensureRoles(tx = prisma) {
  const roleNames = Object.values(ROLES);

  for (const roleName of roleNames) {
    await tx.role.upsert({
      where: { nombre: roleName },
      update: {},
      create: { nombre: roleName },
    });
  }
}

async function ensureUniqueAdmin(tx, excludedUserId = null) {
  const existingAdmin = await tx.usuario.findFirst({
    where: {
      rol: { nombre: ROLES.ADMINISTRADOR },
      ...(excludedUserId ? { NOT: { id: excludedUserId } } : {}),
    },
  });

  if (existingAdmin) {
    throw new AppError(
      "Ya existe un usuario administrador. Solo puede haber uno.",
      409,
      "ADMIN_ALREADY_EXISTS"
    );
  }
}

async function bootstrapAdmin() {
  await ensureRoles();

  if (!ADMIN_DNI || !ADMIN_PASSWORD) {
    return { bootstrapped: false, reason: "missing_env" };
  }

  const adminRole = await prisma.role.findUnique({
    where: { nombre: ROLES.ADMINISTRADOR },
  });

  const existingAdmin = await prisma.usuario.findFirst({
    where: { rol_id: adminRole.id },
  });

  if (existingAdmin) {
    return { bootstrapped: false, reason: "already_exists" };
  }

  await prisma.usuario.create({
    data: {
      dni: ADMIN_DNI,
      nombre_apellido: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password_hash: hashPassword(ADMIN_PASSWORD),
      rol_id: adminRole.id,
      activo: true,
    },
  });

  return { bootstrapped: true };
}

async function login(payload) {
  const dni = normalizeDni(payload.dni);
  const password = normalizePassword(payload.password);

  if (!isValidDni(dni)) {
    throw new AppError("El DNI es invalido.", 400, "INVALID_DNI");
  }

  if (password.length < 6) {
    throw new AppError("La contraseña es inválida.", 400, "INVALID_PASSWORD");
  }

  const user = await prisma.usuario.findUnique({
    where: { dni },
    include: { rol: true },
  });

  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    throw new AppError("Credenciales invalidas.", 401, "INVALID_CREDENTIALS");
  }

  if (!user.activo) {
    throw new AppError("El usuario se encuentra inactivo.", 403, "USER_INACTIVE");
  }

  const token = createAuthToken({
    sub: user.id,
    dni: user.dni,
    role: user.rol.nombre,
  });

  return {
    token,
    user: {
      id: user.id,
      dni: user.dni,
      email: user.email,
      nombreApellido: user.nombre_apellido,
      role: user.rol.nombre,
    },
  };
}

async function requestPasswordReset(payload) {
  const email = normalizeEmail(payload.email);

  if (!validateEmail(email)) {
    throw new AppError("El correo electrónico es inválido.", 400, "INVALID_EMAIL");
  }

  const user = await prisma.usuario.findUnique({
    where: { email },
  });

  if (!user || !user.activo) {
    return {
      message:
        "Si existe una cuenta asociada a ese correo electrónico, se envió un código de recuperación.",
    };
  }

  const code = generateResetCode();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

  await prisma.usuario.update({
    where: { id: user.id },
    data: {
      reset_code_hash: hashResetCode(code),
      reset_code_expires_at: expiresAt,
    },
  });

  const delivery = await sendPasswordResetEmail({
    to: email,
    code,
    fullName: user.nombre_apellido,
  });

  return {
    message:
      "Si existe una cuenta asociada a ese correo electrónico, se envió un código de recuperación.",
    ...(delivery.preview ? { preview: delivery.preview } : {}),
    expiresAt,
  };
}

async function confirmPasswordReset(payload) {
  const email = normalizeEmail(payload.email);
  const code = String(payload.code || "").trim();
  const newPassword = normalizePassword(payload.newPassword);

  if (!validateEmail(email)) {
    throw new AppError("El correo electrónico es inválido.", 400, "INVALID_EMAIL");
  }

  if (!/^\d{6}$/.test(code)) {
    throw new AppError("El código de recuperación es inválido.", 400, "INVALID_RESET_CODE");
  }

  if (newPassword.length < 6) {
    throw new AppError("La contraseña debe tener al menos 6 caracteres.", 400, "INVALID_PASSWORD");
  }

  const user = await prisma.usuario.findUnique({
    where: { email },
  });

  if (!user || !user.reset_code_hash || !user.reset_code_expires_at) {
    throw new AppError("No hay una recuperación pendiente para ese correo electrónico.", 404, "RESET_NOT_FOUND");
  }

  if (user.reset_code_expires_at.getTime() < Date.now()) {
    throw new AppError("El código de recuperación expiró.", 400, "RESET_CODE_EXPIRED");
  }

  if (user.reset_code_hash !== hashResetCode(code)) {
    throw new AppError("El código de recuperación es inválido.", 400, "INVALID_RESET_CODE");
  }

  await prisma.usuario.update({
    where: { id: user.id },
    data: {
      password_hash: hashPassword(newPassword),
      reset_code_hash: null,
      reset_code_expires_at: null,
    },
  });

  return {
    message: "La contraseña fue actualizada correctamente.",
  };
}

module.exports = {
  ensureRoles,
  ensureUniqueAdmin,
  bootstrapAdmin,
  login,
  requestPasswordReset,
  confirmPasswordReset,
};
