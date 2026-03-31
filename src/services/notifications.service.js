const nodemailer = require("nodemailer");

const DELIVERY_MODE = process.env.EMAIL_DELIVERY_MODE || "console";
const APP_NAME = process.env.APP_NAME || "FicharEntrada";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const MAIL_FROM = process.env.MAIL_FROM || `${APP_NAME} <no-reply@localhost>`;

let transporter = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP no está configurado.");
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
}

function buildConsoleMessage({ to, code, fullName }) {
  return [
    `[${APP_NAME}] Recuperación de contraseña`,
    `Para: ${to}`,
    `Usuario: ${fullName || "sin nombre"}`,
    `Código: ${code}`,
  ].join("\n");
}

function buildHtmlEmail({ code, fullName }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="margin-bottom: 16px;">Recuperación de contraseña</h2>
      <p>Hola ${fullName || ""},</p>
      <p>Recibimos una solicitud para restablecer tu contraseña en <strong>${APP_NAME}</strong>.</p>
      <p>Tu código de verificación es:</p>
      <div style="display: inline-block; padding: 12px 18px; background: #1f4e78; color: #ffffff; font-size: 24px; font-weight: bold; letter-spacing: 4px; border-radius: 6px;">
        ${code}
      </div>
      <p style="margin-top: 16px;">Si no solicitaste este cambio, podés ignorar este correo.</p>
    </div>
  `;
}

async function sendPasswordResetEmail({ to, code, fullName }) {
  const consoleMessage = buildConsoleMessage({ to, code, fullName });

  if (DELIVERY_MODE === "console") {
    console.log(consoleMessage);

    return {
      mode: DELIVERY_MODE,
      preview: { code },
    };
  }

  const mailer = getTransporter();

  await mailer.sendMail({
    from: MAIL_FROM,
    to,
    subject: `${APP_NAME} - Recuperación de contraseña`,
    text: consoleMessage,
    html: buildHtmlEmail({ code, fullName }),
  });

  return {
    mode: DELIVERY_MODE,
  };
}

module.exports = {
  sendPasswordResetEmail,
};
