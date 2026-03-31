const prisma = require("../config/prisma");
const AppError = require("../utils/appError");
const { ROLES } = require("../constants/roles");
const { ensureRoles, ensureUniqueAdmin } = require("./auth.service");
const { hashPassword } = require("../utils/auth");
const { isValidDni } = require("../utils/dni");

function normalizeDni(dni) {
  return String(dni || "").trim();
}

function normalizeName(value) {
  return String(value || "").trim();
}

function normalizePassword(value) {
  return String(value || "");
}

function normalizeRole(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getRoleOrFail(roleName, tx = prisma) {
  const role = await tx.role.findUnique({
    where: { nombre: roleName },
  });

  if (!role) {
    throw new AppError("Rol invalido.", 400, "INVALID_ROLE");
  }

  return role;
}

async function listUsers() {
  await ensureRoles();

  const users = await prisma.usuario.findMany({
    include: { rol: true },
    orderBy: [{ nombre_apellido: "asc" }],
  });

  return users.map((user) => ({
    id: user.id,
    dni: user.dni,
    email: user.email,
    nombreApellido: user.nombre_apellido,
    role: user.rol.nombre,
    activo: user.activo,
    hasPassword: Boolean(user.password_hash),
    createdAt: user.created_at,
  }));
}

function canCreatePrivilegedUsers(actorUser) {
  return actorUser?.role === ROLES.ADMINISTRADOR;
}

async function createUser(payload, actorUser = null) {
  await ensureRoles();

  const dni = normalizeDni(payload.dni);
  const email = normalizeEmail(payload.email);
  const nombreApellido = normalizeName(payload.nombreApellido);
  const password = normalizePassword(payload.password);
  const isAdminRequest = canCreatePrivilegedUsers(actorUser);
  const roleName = isAdminRequest ? normalizeRole(payload.role || ROLES.EMPLOYEE) : ROLES.EMPLOYEE;

  if (!isValidDni(dni)) {
    throw new AppError("El DNI es invalido.", 400, "INVALID_DNI");
  }

  if (!isAdminRequest && dni === "0") {
    throw new AppError("No podes registrarte con ese DNI.", 403, "FORBIDDEN_DNI");
  }

  if (!nombreApellido) {
    throw new AppError("El nombre y apellido es obligatorio.", 400, "INVALID_NAME");
  }

  if (!validateEmail(email)) {
    throw new AppError("El correo electrónico es inválido.", 400, "INVALID_EMAIL");
  }

  if (password.length < 6) {
    throw new AppError("La contraseña debe tener al menos 6 caracteres.", 400, "INVALID_PASSWORD");
  }

  const role = await getRoleOrFail(roleName);

  if (role.nombre === ROLES.ADMINISTRADOR) {
    await ensureUniqueAdmin(prisma);
  }

  try {
    const user = await prisma.usuario.create({
      data: {
        dni,
        email,
        nombre_apellido: nombreApellido,
        password_hash: hashPassword(password),
        rol_id: role.id,
        activo: isAdminRequest ? payload.activo !== false : true,
      },
      include: { rol: true },
    });

    return {
      id: user.id,
      dni: user.dni,
      email: user.email,
      nombreApellido: user.nombre_apellido,
      role: user.rol.nombre,
      activo: user.activo,
    };
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError(
        "Ya existe un usuario con ese DNI o correo electrónico.",
        409,
        "USER_ALREADY_EXISTS"
      );
    }

    throw error;
  }
}

async function updateUser(userId, payload) {
  await ensureRoles();

  const id = Number(userId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("El id de usuario es invalido.", 400, "INVALID_USER_ID");
  }

  const existingUser = await prisma.usuario.findUnique({
    where: { id },
    include: { rol: true },
  });

  if (!existingUser) {
    throw new AppError("Usuario no encontrado.", 404, "USER_NOT_FOUND");
  }

  const data = {};

  if (payload.nombreApellido !== undefined) {
    const nombreApellido = normalizeName(payload.nombreApellido);

    if (!nombreApellido) {
      throw new AppError("El nombre y apellido es obligatorio.", 400, "INVALID_NAME");
    }

    data.nombre_apellido = nombreApellido;
  }

  if (payload.email !== undefined) {
    const email = normalizeEmail(payload.email);

    if (!validateEmail(email)) {
      throw new AppError("El correo electrónico es inválido.", 400, "INVALID_EMAIL");
    }

    data.email = email;
  }

  if (payload.activo !== undefined) {
    data.activo = Boolean(payload.activo);
  }

  if (payload.password !== undefined) {
    const password = normalizePassword(payload.password);

    if (password.length < 6) {
      throw new AppError("La contraseña debe tener al menos 6 caracteres.", 400, "INVALID_PASSWORD");
    }

    data.password_hash = hashPassword(password);
  }

  if (payload.role !== undefined) {
    const roleName = normalizeRole(payload.role);
    const role = await getRoleOrFail(roleName);

    if (role.nombre === ROLES.ADMINISTRADOR) {
      await ensureUniqueAdmin(prisma, existingUser.id);
    }

    data.rol_id = role.id;
  }

  let updatedUser;

  try {
    updatedUser = await prisma.usuario.update({
      where: { id },
      data,
      include: { rol: true },
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError(
        "Ya existe un usuario con ese DNI o correo electrónico.",
        409,
        "USER_ALREADY_EXISTS"
      );
    }

    throw error;
  }

  return {
    id: updatedUser.id,
    dni: updatedUser.dni,
    email: updatedUser.email,
    nombreApellido: updatedUser.nombre_apellido,
    role: updatedUser.rol.nombre,
    activo: updatedUser.activo,
    hasPassword: Boolean(updatedUser.password_hash),
  };
}

module.exports = {
  listUsers,
  createUser,
  updateUser,
};
