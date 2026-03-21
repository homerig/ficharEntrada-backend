require("dotenv").config();

const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health.routes");
const fichadasRoutes = require("./routes/fichadas.routes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/fichadas", fichadasRoutes);

app.use((req, res) => {
  return res.status(404).json({
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: "Ruta no encontrada.",
    },
  });
});

app.use(errorHandler);

module.exports = app;
