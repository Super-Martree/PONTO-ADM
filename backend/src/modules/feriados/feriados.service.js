const {
  createFeriado,
  findFeriadoById,
  hasFeriadosTable,
  listFeriados,
  updateFeriado,
  updateFeriadoStatus,
} = require("./feriados.repository");

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

function parseDateOnly(value) {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw createHttpError(400, "Data obrigatoria ou invalida.");
  }

  return text;
}

function normalizePayload(payload = {}) {
  const descricao = String(payload.descricao || "").trim();

  if (!descricao) {
    throw createHttpError(400, "Descricao obrigatoria.");
  }

  if (descricao.length > 150) {
    throw createHttpError(400, "Descricao deve ter no maximo 150 caracteres.");
  }

  return {
    data: parseDateOnly(payload.data),
    descricao,
    ativo: payload.ativo === undefined ? true : Boolean(payload.ativo),
  };
}

async function ensureTable() {
  if (!await hasFeriadosTable()) {
    throw createHttpError(400, "Tabela de feriados nao existe. Execute backend/docs/supabase-schema.sql no Supabase.");
  }
}

async function listarFeriados(user) {
  requireAdmin(user);
  return listFeriados();
}

async function buscarFeriado(user, idValue) {
  requireAdmin(user);
  const id = parseId(idValue);
  const feriado = await findFeriadoById(id);

  if (!feriado) {
    throw createHttpError(404, "Feriado nao encontrado.");
  }

  return feriado;
}

async function criarFeriado(user, payload) {
  requireAdmin(user);
  await ensureTable();
  return createFeriado(normalizePayload(payload));
}

async function atualizarFeriado(user, idValue, payload) {
  requireAdmin(user);
  await ensureTable();
  const id = parseId(idValue);
  const current = await findFeriadoById(id);

  if (!current) {
    throw createHttpError(404, "Feriado nao encontrado.");
  }

  return updateFeriado(id, normalizePayload(payload));
}

async function alterarStatusFeriado(user, idValue, payload) {
  requireAdmin(user);
  await ensureTable();
  const id = parseId(idValue);
  const current = await findFeriadoById(id);

  if (!current) {
    throw createHttpError(404, "Feriado nao encontrado.");
  }

  if (payload?.ativo === undefined) {
    throw createHttpError(400, "Status ativo obrigatorio.");
  }

  return updateFeriadoStatus(id, Boolean(payload.ativo));
}

module.exports = {
  alterarStatusFeriado,
  atualizarFeriado,
  buscarFeriado,
  criarFeriado,
  listarFeriados,
};
