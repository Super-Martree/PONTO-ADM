const {
  createLoja,
  createLocalPermitido,
  deleteLocalPermitido,
  findLojaByCodigo,
  findLojaById,
  getNextCodigo,
  listLocaisPermitidos,
  listLojas,
  updateLoja,
  updateLocalPermitido,
  updateLojaStatus,
} = require("./lojas.repository");

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

function parseAtivo(value) {
  if (value === undefined || value === "") {
    return undefined;
  }

  if (value === true || value === "true" || value === "1" || value === 1) {
    return true;
  }

  if (value === false || value === "false" || value === "0" || value === 0) {
    return false;
  }

  throw createHttpError(400, "Filtro ativo invalido.");
}

function normalizeLojaPayload(payload = {}) {
  const codigo = Number(payload.codigo);
  const nome = String(payload.nome || "").trim();
  const cidade = String(payload.cidade || "").trim();
  const bairro = String(payload.bairro || "").trim();
  const cnpj = String(payload.cnpj || "").trim();
  const ativo = payload.ativo === undefined ? true : Boolean(payload.ativo);

  if (!Number.isInteger(codigo) || codigo <= 0) {
    throw createHttpError(400, "Codigo obrigatorio.");
  }

  if (!nome) {
    throw createHttpError(400, "Nome obrigatorio.");
  }

  if (!cidade) {
    throw createHttpError(400, "Cidade obrigatoria.");
  }

  return {
    codigo,
    nome,
    cidade,
    bairro,
    cnpj,
    ativo,
  };
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

async function listarLojas(user, query) {
  requireAdmin(user);
  return listLojas({ ativo: parseAtivo(query?.ativo) });
}

async function buscarProximoCodigo(user) {
  requireAdmin(user);
  return { codigo: await getNextCodigo() };
}

async function buscarLoja(user, idValue) {
  requireAdmin(user);
  const id = parseId(idValue);
  const loja = await findLojaById(id);

  if (!loja) {
    throw createHttpError(404, "Loja nao encontrada.");
  }

  return loja;
}

async function criarLoja(user, payload) {
  requireAdmin(user);
  const data = normalizeLojaPayload(payload);
  const duplicated = await findLojaByCodigo(data.codigo);

  if (duplicated) {
    throw createHttpError(400, "Codigo ja cadastrado.");
  }

  return createLoja(data);
}

async function atualizarLoja(user, idValue, payload) {
  requireAdmin(user);
  const id = parseId(idValue);
  const current = await findLojaById(id);

  if (!current) {
    throw createHttpError(404, "Loja nao encontrada.");
  }

  const data = normalizeLojaPayload(payload);
  const duplicated = await findLojaByCodigo(data.codigo);

  if (duplicated && duplicated.id !== id) {
    throw createHttpError(400, "Codigo ja cadastrado.");
  }

  return updateLoja(id, data);
}

async function alterarStatusLoja(user, idValue, payload) {
  requireAdmin(user);
  const id = parseId(idValue);
  const current = await findLojaById(id);

  if (!current) {
    throw createHttpError(404, "Loja nao encontrada.");
  }

  const ativo = parseAtivo(payload?.ativo);

  if (ativo === undefined) {
    throw createHttpError(400, "Status ativo obrigatorio.");
  }

  return updateLojaStatus(id, ativo);
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
  alterarStatusLoja,
  atualizarLoja,
  atualizarLocalPermitido,
  buscarLoja,
  buscarProximoCodigo,
  criarLoja,
  criarLocalPermitido,
  excluirLocalPermitido,
  listarLocaisPermitidos,
  listarLojas,
};
