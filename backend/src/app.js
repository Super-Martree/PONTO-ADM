const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const { getPool } = require("./db/postgres");
const authRoutes = require("./modules/auth/auth.routes");
const configuracoesRoutes = require("./modules/configuracoes/configuracoes.routes");
const escalasRoutes = require("./modules/escalas/escalas.routes");
const feriadosRoutes = require("./modules/feriados/feriados.routes");
const funcionariosRoutes = require("./modules/funcionarios/funcionarios.routes");
const lojasRoutes = require("./modules/lojas/lojas.routes");
const pontoRoutes = require("./modules/ponto/ponto.routes");
const ajustarPontoRoutes = require("./modules/ajustarPonto/ajustarPonto.routes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || env.frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origem nao permitida pelo CORS."));
  },
  credentials: true,
}));
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "same-origin");
  res.set("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/health/db", async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT current_database() AS \"databaseName\", current_user AS \"userName\"");
    res.json({ ok: true, ...result.recordset[0] });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/configuracoes", configuracoesRoutes);
app.use("/api/escalas", escalasRoutes);
app.use("/api/feriados", feriadosRoutes);
app.use("/api/funcionarios", funcionariosRoutes);
app.use("/api/lojas", lojasRoutes);
app.use("/api/ponto", pontoRoutes);
app.use("/api/admin", ajustarPontoRoutes);
app.use(errorHandler);

module.exports = app;
