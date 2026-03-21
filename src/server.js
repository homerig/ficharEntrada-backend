require("dotenv").config();

const app = require("./app");
const prisma = require("./config/prisma");

const PORT = Number(process.env.PORT) || 3000;

async function bootstrap() {
  try {
    await prisma.$connect();

    app.listen(PORT, () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar el servidor:", error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`Senal recibida: ${signal}. Cerrando aplicacion...`);

  try {
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

bootstrap();
