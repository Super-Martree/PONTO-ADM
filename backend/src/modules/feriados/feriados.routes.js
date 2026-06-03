const express = require("express");
const authenticate = require("../../middlewares/authenticate");
const {
  alterarStatusFeriado,
  atualizarFeriado,
  buscarFeriado,
  criarFeriado,
  listarFeriados,
} = require("./feriados.service");

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
    const feriados = await listarFeriados(req.user);
    res.json({ feriados });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const feriado = await buscarFeriado(req.user, req.params.id);
    res.json({ feriado });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const feriado = await criarFeriado(req.user, req.body || {});
    res.status(201).json({ message: "Feriado criado com sucesso.", feriado });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const feriado = await atualizarFeriado(req.user, req.params.id, req.body || {});
    res.json({ message: "Feriado atualizado com sucesso.", feriado });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const feriado = await alterarStatusFeriado(req.user, req.params.id, req.body || {});
    res.json({ message: feriado.ativo ? "Feriado ativado com sucesso." : "Feriado inativado com sucesso.", feriado });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

module.exports = router;
