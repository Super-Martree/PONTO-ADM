const express = require("express");
const authenticate = require("../../middlewares/authenticate");
const { criarLancamentoManual, listarBancoHoras } = require("./bancoHoras.service");

const router = express.Router();

function handleRouteError(error, res, next) {
  if (error.status) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  next(error);
}

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const result = await listarBancoHoras(req.user, req.query);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.post("/lancamentos", async (req, res, next) => {
  try {
    const result = await criarLancamentoManual(req.user, req.body || {});
    res.status(201).json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

module.exports = router;
