const express = require("express");
const authenticate = require("../../middlewares/authenticate");
const {
  alterarStatusEscala,
  atualizarEscala,
  buscarEscala,
  criarEscala,
  listarEscalas,
} = require("./escalas.service");

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
    const escalas = await listarEscalas(req.user);
    res.json({ escalas });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const escala = await buscarEscala(req.user, req.params.id);
    res.json({ escala });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const escala = await criarEscala(req.user, req.body || {});
    res.status(201).json({ message: "Escala criada com sucesso.", escala });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const escala = await atualizarEscala(req.user, req.params.id, req.body || {});
    res.json({ message: "Escala atualizada com sucesso.", escala });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const escala = await alterarStatusEscala(req.user, req.params.id, req.body || {});
    res.json({ message: escala.ativo ? "Escala ativada com sucesso." : "Escala inativada com sucesso.", escala });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

module.exports = router;
