const express = require("express");
const {
  baterPonto,
  getAdminApuracaoPeriodo,
  getAdminPontoDoMes,
  getAdminResumoFuncionarios,
  getAdminTodayApuracao,
  getDashboardResumo,
  getFuncionarioPontoDoMes,
  getRegistrosPeriodo,
  getTodayStatus,
} = require("./ponto.service");
const authenticate = require("../../middlewares/authenticate");

const router = express.Router();

function handleRouteError(error, res, next) {
  if (error.status) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  next(error);
}

router.use(authenticate);

router.post("/bater", async (req, res, next) => {
  try {
    const result = await baterPonto(req.user, req.body);
    res.status(201).json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/hoje", async (req, res, next) => {
  try {
    const result = await getTodayStatus(req.user);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/registros", async (req, res, next) => {
  try {
    const result = await getRegistrosPeriodo(req.user, req.query);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/apuracao/hoje", async (req, res, next) => {
  try {
    const hasPeriodQuery = req.query?.periodo || req.query?.inicio || req.query?.fim;
    const result = hasPeriodQuery
      ? await getAdminApuracaoPeriodo(req.user, req.query)
      : await getAdminTodayApuracao(req.user, req.query);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/apuracao", async (req, res, next) => {
  try {
    const result = await getAdminApuracaoPeriodo(req.user, req.query);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/admin/ponto-do-mes", async (req, res, next) => {
  try {
    const result = await getAdminPontoDoMes(req.user, req.query);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/admin/resumo-funcionarios", async (req, res, next) => {
  try {
    const result = await getAdminResumoFuncionarios(req.user, req.query);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/escala-mes", async (req, res, next) => {
  try {
    const result = await getFuncionarioPontoDoMes(req.user, req.query);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const result = await getDashboardResumo(req.user);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

module.exports = router;
