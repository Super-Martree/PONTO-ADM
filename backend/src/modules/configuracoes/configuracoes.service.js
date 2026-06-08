const {
  getLocalizacaoConfig,
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

async function buscarConfiguracaoLocalizacao(user) {
  return getLocalizacaoConfig();
}

async function salvarConfiguracaoLocalizacao(user, payload = {}) {
  requireAdmin(user);
  return updateLocalizacaoConfig({
    validacaoLocalizacaoAtiva: parseBoolean(payload.validacaoLocalizacaoAtiva),
  });
}

module.exports = {
  buscarConfiguracaoLocalizacao,
  salvarConfiguracaoLocalizacao,
};
