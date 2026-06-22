const express = require("express");
const authenticate = require("../../middlewares/authenticate");
const {
  alterarStatusFuncionario,
  atualizarEscalaFuncionario,
  atualizarFuncionario,
  buscarProximaMatricula,
  criarFuncionario,
  excluirEscalaSemanalFuncionario,
  excluirHistoricoEscalaFuncionario,
  listarEscalasSemanaisFuncionario,
  listarHistoricoEscalasFuncionario,
  listarAuditoriaFuncionario,
  listarFuncionarios,
  salvarEscalaSemanalFuncionario,
} = require("./funcionarios.service");

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
    const funcionarios = await listarFuncionarios(req.user);
    res.json({ funcionarios });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/next-matricula", async (req, res, next) => {
  try {
    const result = await buscarProximaMatricula(req.user);
    res.json(result);
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/:id/auditoria", async (req, res, next) => {
  try {
    const auditoria = await listarAuditoriaFuncionario(req.user, req.params.id);
    res.json({ auditoria });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/:id/escalas-historico", async (req, res, next) => {
  try {
    const historico = await listarHistoricoEscalasFuncionario(req.user, req.params.id);
    res.json({ historico });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.get("/:id/escalas-semanais", async (req, res, next) => {
  try {
    const escalas = await listarEscalasSemanaisFuncionario(req.user, req.params.id);
    res.json({ escalas });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.post("/:id/escalas-semanais", async (req, res, next) => {
  try {
    const escalas = await salvarEscalaSemanalFuncionario(req.user, req.params.id, req.body || {});
    res.status(201).json({ message: "Escala semanal salva com sucesso.", escalas });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.delete("/:id/escalas-semanais/:semanalId", async (req, res, next) => {
  try {
    const escalas = await excluirEscalaSemanalFuncionario(req.user, req.params.id, req.params.semanalId);
    res.json({ message: "Escala semanal excluida com sucesso.", escalas });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.delete("/:id/escalas-historico/:historicoId", async (req, res, next) => {
  try {
    const funcionario = await excluirHistoricoEscalaFuncionario(req.user, req.params.id, req.params.historicoId);
    res.json({ message: "Registro de escala excluido com sucesso.", funcionario });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const funcionario = await criarFuncionario(req.user, req.body || {});
    res.status(201).json({ message: "Funcionario criado com sucesso.", funcionario });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.put("/:id/escala", async (req, res, next) => {
  try {
    const funcionario = await atualizarEscalaFuncionario(req.user, req.params.id, req.body || {});
    res.json({ message: "Escala do funcionario atualizada com sucesso.", funcionario });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const funcionario = await atualizarFuncionario(req.user, req.params.id, req.body || {});
    res.json({ message: "Funcionario atualizado com sucesso.", funcionario });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const funcionario = await alterarStatusFuncionario(req.user, req.params.id, req.body || {});
    res.json({
      message: funcionario.ativo ? "Funcionario ativado com sucesso." : "Funcionario inativado com sucesso.",
      funcionario,
    });
  } catch (error) {
    handleRouteError(error, res, next);
  }
});

module.exports = router;
