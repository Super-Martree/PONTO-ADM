const express = require("express");
const authenticate = require("../../middlewares/authenticate");
const {
  atualizarLocalPermitido,
  criarLocalPermitido,
  excluirLocalPermitido,
  listarLocaisPermitidos,
} = require("../lojas/lojas.service");
const {
  buscarConfiguracaoLocalizacao,
  salvarConfiguracaoLocalizacao,
} = require("./configuracoes.service");

const router = express.Router();

function handleRouteError(error, res, next) {
  if (error.status) {
    res.status(error.status).json({ message: error.message });
    return;
  }

  next(error);
}

router.use(authenticate);

router.get("/localizacao", async (req, res, next) => {
  try {
    const configuracao = await buscarConfiguracaoLocalizacao(req.user);
    res.json({ configuracao });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.put("/localizacao", async (req, res, next) => {
  try {
    const configuracao = await salvarConfiguracaoLocalizacao(req.user, req.body || {});
    res.json({ message: "Configuracao de localizacao atualizada com sucesso.", configuracao });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/locais-permitidos", async (req, res, next) => {
  try {
    const locais = await listarLocaisPermitidos(req.user);
    res.json({ locais });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.post("/locais-permitidos", async (req, res, next) => {
  try {
    const local = await criarLocalPermitido(req.user, req.body || {});
    res.status(201).json({ message: "Local permitido criado com sucesso.", local });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.put("/locais-permitidos/:id", async (req, res, next) => {
  try {
    const local = await atualizarLocalPermitido(req.user, req.params.id, req.body || {});
    res.json({ message: "Local permitido atualizado com sucesso.", local });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.delete("/locais-permitidos/:id", async (req, res, next) => {
  try {
    const result = await excluirLocalPermitido(req.user, req.params.id);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

module.exports = router;
