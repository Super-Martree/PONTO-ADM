const {
  createFuncionario,
  deleteFuncionarioEscalaHistorico,
  deleteFuncionarioEscalaSemanal,
  findFuncionarioById,
  findCurrentFuncionarioEscalaHistorico,
  findLatestFuncionarioEscalaHistorico,
  findFuncionarioByMatricula,
  getNextMatricula,
  insertFuncionarioAuditoria,
  listFuncionarioEscalasHistorico,
  listFuncionarioEscalasSemanais,
  listFuncionarioAuditoria,
  listFuncionarios,
  updateFuncionario,
  updateFuncionarioEscala,
  updateFuncionarioStatus,
  upsertFuncionarioEscalaHistorico,
  upsertFuncionarioEscalaSemanal,
} = require("./funcionarios.repository");
const bcrypt = require("bcryptjs");
const { findEscalaById } = require("../escalas/escalas.repository");
const { findLojaById } = require("../lojas/lojas.repository");

const SALT_ROUNDS = 10;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireAdmin(user) {
  if (user?.role !== "admin") {
    throw createHttpError(403, "Acesso restrito ao administrador.");
  }
}

function parseId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(400, "ID invalido.");
  }

  return id;
}

function parseOptionalId(value) {
  if (value === undefined || value === null || value === "") return null;
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(400, "ID relacionado invalido.");
  }

  return id;
}

function parseRequiredId(value, fieldName) {
  const id = parseOptionalId(value);

  if (!id) {
    throw createHttpError(400, `${fieldName} obrigatoria.`);
  }

  return id;
}

function parseDateOnly(value) {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : null;
}

function addDays(dateText, amount) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getLocalDateOnly() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizePayload(payload = {}, { requireStartDate = true } = {}) {
  const nome = String(payload.nome || "").trim();

  if (!nome) {
    throw createHttpError(400, "Nome obrigatorio.");
  }

  const dataInicioPonto = parseDateOnly(payload.dataInicioPonto);

  if (requireStartDate && !dataInicioPonto) {
    throw createHttpError(400, "Data de inicio do ponto obrigatoria.");
  }

  return {
    nome,
    ativo: payload.ativo === undefined ? true : Boolean(payload.ativo),
    lojaId: parseRequiredId(payload.lojaId, "Loja"),
    setorId: parseOptionalId(payload.setorId),
    dataInicioPonto,
  };
}

async function validateLojaObrigatoria(lojaId) {
  const loja = await findLojaById(lojaId);

  if (!loja) {
    throw createHttpError(400, "Loja nao encontrada.");
  }

  return loja;
}

function normalizePassword(value, { required = false } = {}) {
  const senha = String(value || "");

  if (!senha && !required) {
    return "";
  }

  if (senha.length < 1 || senha.length > 128) {
    throw createHttpError(400, "Senha deve ter entre 1 e 128 caracteres.");
  }

  return senha;
}

function auditActor(user) {
  return {
    alteradoPorMatricula: user?.matricula ? String(user.matricula) : null,
    alteradoPorNome: user?.name || user?.matricula || "Sistema",
  };
}

function addAuditChange(changes, { current, next, campo, funcionario, user }) {
  const before = current === undefined || current === null || current === "" ? "-" : String(current);
  const after = next === undefined || next === null || next === "" ? "-" : String(next);

  if (before === after) return;

  changes.push({
    funcionarioId: funcionario.id,
    matricula: funcionario.matricula,
    campo,
    valorAnterior: before,
    valorNovo: after,
    ...auditActor(user),
  });
}

async function listarFuncionarios(user) {
  requireAdmin(user);
  return listFuncionarios();
}

async function listarAuditoriaFuncionario(user, idValue) {
  requireAdmin(user);
  const id = parseId(idValue);
  const current = await findFuncionarioById(id);

  if (!current) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  return listFuncionarioAuditoria(id);
}

async function buscarProximaMatricula(user) {
  requireAdmin(user);
  return { matricula: await getNextMatricula() };
}

async function criarFuncionario(user, payload) {
  requireAdmin(user);
  const matricula = await getNextMatricula();
  const duplicated = await findFuncionarioByMatricula(matricula);

  if (duplicated) {
    throw createHttpError(400, "Matricula ja cadastrada.");
  }

  const data = normalizePayload(payload);
  await validateLojaObrigatoria(data.lojaId);
  data.escalaId = null;
  const senha = normalizePassword(payload.senha) || matricula;
  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
  return createFuncionario({ ...data, matricula, senha: senhaHash });
}

async function atualizarFuncionario(user, idValue, payload) {
  requireAdmin(user);
  const id = parseId(idValue);
  const current = await findFuncionarioById(id);

  if (!current) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  const data = normalizePayload(payload, { requireStartDate: false });
  const nextLoja = await validateLojaObrigatoria(data.lojaId);
  data.dataInicioPonto = data.dataInicioPonto || current.dataInicioPonto || null;
  const senha = normalizePassword(payload.senha);
  if (senha) {
    data.senha = await bcrypt.hash(senha, SALT_ROUNDS);
  }
  data.escalaId = current.escalaId || null;
  const changes = [];
  addAuditChange(changes, { current: current.nome, next: data.nome, campo: "Nome", funcionario: current, user });
  addAuditChange(changes, { current: current.lojaNome || "Sem loja", next: nextLoja?.nome || "Sem loja", campo: "Loja", funcionario: current, user });
  addAuditChange(changes, { current: current.dataInicioPonto || "-", next: data.dataInicioPonto || "-", campo: "Inicio do ponto", funcionario: current, user });
  addAuditChange(changes, { current: current.ativo ? "Ativo" : "Inativo", next: data.ativo ? "Ativo" : "Inativo", campo: "Status", funcionario: current, user });
  if (senha) {
    addAuditChange(changes, { current: "Senha anterior", next: "Senha alterada", campo: "Senha", funcionario: current, user });
  }
  const funcionario = await updateFuncionario(id, data);

  await insertFuncionarioAuditoria(changes);

  return funcionario;
}

async function atualizarEscalaFuncionario(user, idValue, payload) {
  requireAdmin(user);
  const id = parseId(idValue);
  const current = await findFuncionarioById(id);

  if (!current) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  const escalaId = parseOptionalId(payload.escalaId);
  const escala = escalaId ? await findEscalaById(escalaId) : null;

  if (escalaId && (!escala || !escala.ativo)) {
    throw createHttpError(400, "Escala ativa nao encontrada.");
  }

  const dataInicio = parseDateOnly(payload.dataInicio) || current.dataInicioPonto;

  if (!dataInicio) {
    throw createHttpError(400, "Data de inicio da escala obrigatoria.");
  }

  await upsertFuncionarioEscalaHistorico({
    matricula: current.matricula,
    escalaId,
    dataInicio,
  });
  const currentEscalaId = dataInicio <= getLocalDateOnly()
    ? escalaId
    : current.escalaId || null;
  const funcionario = await updateFuncionarioEscala(id, currentEscalaId);

  const changes = [];
  addAuditChange(changes, {
    current: current.escalaNome || "Sem escala",
    next: escala?.nome || "Sem escala",
    campo: "Alteracao de Escala",
    funcionario: current,
    user,
  });
  addAuditChange(changes, {
    current: current.dataInicioPonto || "-",
    next: dataInicio,
    campo: "Inicio desta escala",
    funcionario: current,
    user,
  });
  await insertFuncionarioAuditoria(changes);

  return funcionario;
}

async function listarHistoricoEscalasFuncionario(user, idValue) {
  requireAdmin(user);
  const id = parseId(idValue);
  const current = await findFuncionarioById(id);

  if (!current) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  return listFuncionarioEscalasHistorico(current.matricula);
}

async function excluirHistoricoEscalaFuncionario(user, idValue, historicoIdValue) {
  requireAdmin(user);
  const id = parseId(idValue);
  const historicoId = parseId(historicoIdValue);
  const current = await findFuncionarioById(id);

  if (!current) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  const deleted = await deleteFuncionarioEscalaHistorico({
    matricula: current.matricula,
    historicoId,
  });

  if (!deleted) {
    throw createHttpError(404, "Registro de escala nao encontrado.");
  }

  const currentEffective = await findCurrentFuncionarioEscalaHistorico(current.matricula);
  const latest = await findLatestFuncionarioEscalaHistorico(current.matricula);
  const funcionario = await updateFuncionarioEscala(id, currentEffective?.escalaId || null);
  await insertFuncionarioAuditoria([{
    funcionarioId: current.id,
    matricula: current.matricula,
    campo: "Exclusao de Escala",
    valorAnterior: current.escalaNome || "Sem escala",
    valorNovo: latest?.escalaNome || "Sem escala",
    alteradoPorMatricula: user?.matricula || null,
    alteradoPorNome: user?.name || null,
  }]);

  return funcionario;
}

async function listarEscalasSemanaisFuncionario(user, idValue) {
  requireAdmin(user);
  const id = parseId(idValue);
  const current = await findFuncionarioById(id);

  if (!current) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  return listFuncionarioEscalasSemanais(current.matricula);
}

async function salvarEscalaSemanalFuncionario(user, idValue, payload) {
  requireAdmin(user);
  const id = parseId(idValue);
  const current = await findFuncionarioById(id);

  if (!current) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  const escalaId = parseRequiredId(payload.escalaId, "Escala");
  const escala = await findEscalaById(escalaId);

  if (!escala || !escala.ativo) {
    throw createHttpError(400, "Escala ativa nao encontrada.");
  }

  const semanaInicio = parseDateOnly(payload.semanaInicio);

  if (!semanaInicio) {
    throw createHttpError(400, "Inicio da semana obrigatorio.");
  }

  const semanaFim = addDays(semanaInicio, 6);
  const motivo = String(payload.motivo || "").trim().slice(0, 255);

  await upsertFuncionarioEscalaSemanal({
    matricula: current.matricula,
    escalaId,
    semanaInicio,
    semanaFim,
    motivo,
  });

  await insertFuncionarioAuditoria([{
    funcionarioId: current.id,
    matricula: current.matricula,
    campo: "Escala semanal",
    valorAnterior: "-",
    valorNovo: `${escala.nome} (${semanaInicio} a ${semanaFim})`,
    ...auditActor(user),
  }]);

  return listFuncionarioEscalasSemanais(current.matricula);
}

async function excluirEscalaSemanalFuncionario(user, idValue, semanalIdValue) {
  requireAdmin(user);
  const id = parseId(idValue);
  const semanalId = parseId(semanalIdValue);
  const current = await findFuncionarioById(id);

  if (!current) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  const deleted = await deleteFuncionarioEscalaSemanal({
    matricula: current.matricula,
    semanalId,
  });

  if (!deleted) {
    throw createHttpError(404, "Escala semanal nao encontrada.");
  }

  await insertFuncionarioAuditoria([{
    funcionarioId: current.id,
    matricula: current.matricula,
    campo: "Exclusao de escala semanal",
    valorAnterior: String(semanalId),
    valorNovo: "-",
    ...auditActor(user),
  }]);

  return listFuncionarioEscalasSemanais(current.matricula);
}

async function alterarStatusFuncionario(user, idValue, payload) {
  requireAdmin(user);
  const id = parseId(idValue);
  const current = await findFuncionarioById(id);

  if (!current) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  if (payload?.ativo === undefined) {
    throw createHttpError(400, "Status ativo obrigatorio.");
  }

  const ativo = Boolean(payload.ativo);
  const funcionario = await updateFuncionarioStatus(id, ativo);
  await insertFuncionarioAuditoria([{
    funcionarioId: current.id,
    matricula: current.matricula,
    campo: "Status",
    valorAnterior: current.ativo ? "Ativo" : "Inativo",
    valorNovo: ativo ? "Ativo" : "Inativo",
    ...auditActor(user),
  }]);

  return funcionario;
}

module.exports = {
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
};
