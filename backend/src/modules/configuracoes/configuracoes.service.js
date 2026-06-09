const {
  createLocalPermitido,
  deleteLocalPermitido,
  getLocalizacaoConfig,
  listLocaisPermitidos,
  updateLocalPermitido,
  updateLocalizacaoConfig,
} = require("./configuracoes.repository");

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

function parseBoolean(value) {
  if (value === true || value === "true" || value === "1" || value === 1) {
    return true;
  }

  if (value === false || value === "false" || value === "0" || value === 0) {
    return false;
  }

  throw createHttpError(400, "Status da validacao de localizacao invalido.");
}

function parseId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(400, "ID invalido.");
  }

  return id;
}

function normalizeLocalPayload(payload = {}) {
  const nome = String(payload.nome || "").trim();
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  const raioMetros = Number(payload.raioMetros || 100);
  const ativo = payload.ativo === undefined ? true : Boolean(payload.ativo);

  if (!nome) {
    throw createHttpError(400, "Nome do local obrigatorio.");
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw createHttpError(400, "Latitude invalida.");
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw createHttpError(400, "Longitude invalida.");
  }

  if (!Number.isInteger(raioMetros) || raioMetros < 10 || raioMetros > 5000) {
    throw createHttpError(400, "Raio deve ficar entre 10 e 5000 metros.");
  }

  return {
    nome,
    latitude,
    longitude,
    raioMetros,
    ativo,
  };
}

async function buscarConfiguracaoLocalizacao(user) {
  return getLocalizacaoConfig();
}

async function salvarConfiguracaoLocalizacao(user, payload = {}) {
  requireAdmin(user);
  return updateLocalizacaoConfig({
    validacaoLocalizacaoAtiva: parseBoolean(payload.validacaoLocalizacaoAtiva),
  });
}

async function listarLocaisPermitidos(user) {
  requireAdmin(user);
  return listLocaisPermitidos();
}

async function criarLocalPermitido(user, payload) {
  requireAdmin(user);
  return createLocalPermitido(normalizeLocalPayload(payload));
}

async function atualizarLocalPermitido(user, idValue, payload) {
  requireAdmin(user);
  const id = parseId(idValue);
  const local = await updateLocalPermitido(id, normalizeLocalPayload(payload));

  if (!local) {
    throw createHttpError(404, "Local permitido nao encontrado.");
  }

  return local;
}

async function excluirLocalPermitido(user, idValue) {
  requireAdmin(user);
  const id = parseId(idValue);
  const deleted = await deleteLocalPermitido(id);

  if (!deleted) {
    throw createHttpError(404, "Local permitido nao encontrado.");
  }

  return { message: "Local permitido excluido com sucesso." };
}

module.exports = {
  atualizarLocalPermitido,
  buscarConfiguracaoLocalizacao,
  criarLocalPermitido,
  excluirLocalPermitido,
  listarLocaisPermitidos,
  salvarConfiguracaoLocalizacao,
};
