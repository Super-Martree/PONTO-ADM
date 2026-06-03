const express = require("express");
const authenticate = require("../../middlewares/authenticate");
const {
  desfazerAjustePonto,
  listarAjustarPonto,
  salvarAjustePonto,
} = require("./ajustarPonto.service");

const router = express.Router();

function handleRouteError(error, res, next) {
  if (error.status) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  next(error);
}

router.use(authenticate);

router.get("/ajustar-ponto", async (req, res, next) => {
  try {
    const result = await listarAjustarPonto(req.user, req.query);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.post("/ajustar-ponto/:funcionarioId/:data", async (req, res, next) => {
  try {
    const result = await salvarAjustePonto(req.user, req.params, req.body || {});
    res.status(201).json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.delete("/ajustar-ponto/:funcionarioId/:data", async (req, res, next) => {
  try {
    const result = await desfazerAjustePonto(req.user, req.params);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.delete("/ajustar-ponto/:funcionarioId/:data/:ajusteId", async (req, res, next) => {
  try {
    const result = await desfazerAjustePonto(req.user, req.params);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

module.exports = router;
