const crypto = require("crypto");

const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || "change-me-in-production";
const TOKEN_TTL_SECONDS = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 12);
const SCRYPT_KEYLEN = 64;
const RESET_CODE_BYTES = 3;

function toBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value) {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(value).digest("base64url");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) {
    return false;
  }

  const [salt, hash] = storedHash.split(":");
  const derivedHash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  const hashBuffer = Buffer.from(hash, "hex");
  const derivedBuffer = Buffer.from(derivedHash, "hex");

  if (hashBuffer.length !== derivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(hashBuffer, derivedBuffer);
}

function createAuthToken(payload) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const encodedBody = toBase64Url(JSON.stringify(body));
  const signature = signValue(encodedBody);

  return `${encodedBody}.${signature}`;
}

function verifyAuthToken(token) {
  const [encodedBody, signature] = String(token || "").split(".");

  if (!encodedBody || !signature) {
    throw new Error("Token invalido.");
  }

  const expectedSignature = signValue(encodedBody);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Firma invalida.");
  }

  const payload = JSON.parse(fromBase64Url(encodedBody));

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expirado.");
  }

  return payload;
}

function generateResetCode() {
  const randomNumber = crypto.randomBytes(RESET_CODE_BYTES).readUIntBE(0, RESET_CODE_BYTES);
  return String(randomNumber % 1000000).padStart(6, "0");
}

function hashResetCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

module.exports = {
  hashPassword,
  verifyPassword,
  createAuthToken,
  verifyAuthToken,
  generateResetCode,
  hashResetCode,
};
