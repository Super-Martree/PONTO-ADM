const express = require("express");
const authenticate = require("../../middlewares/authenticate");
const {
  alterarStatusLoja,
  atualizarLoja,
  buscarLoja,
  buscarProximoCodigo,
  criarLoja,
  listarLojas,
} = require("./lojas.service");

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
    const lojas = await listarLojas(req.user, req.query);
    res.json({ lojas });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/next-codigo", async (req, res, next) => {
  try {
    const result = await buscarProximoCodigo(req.user);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const loja = await buscarLoja(req.user, req.params.id);
    res.json({ loja });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const loja = await criarLoja(req.user, req.body || {});
    res.status(201).json({ message: "Loja criada com sucesso.", loja });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const loja = await atualizarLoja(req.user, req.params.id, req.body || {});
    res.json({ message: "Loja atualizada com sucesso.", loja });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const loja = await alterarStatusLoja(req.user, req.params.id, req.body || {});
    res.json({ message: loja.ativo ? "Loja ativada com sucesso." : "Loja inativada com sucesso.", loja });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

module.exports = router;
