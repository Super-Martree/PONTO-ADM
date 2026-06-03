const {
  createEscala,
  findEscalaById,
  listEscalas,
  updateEscala,
  updateEscalaStatus,
} = require("./escalas.repository");

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

const DIAS_KEYS = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];

const TIPOS_ESCALA = new Set(["fixa", "flexivel", "ciclo"]);

function normalizeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return number;
}

function hoursToMinutes(value) {
  return Math.round(normalizeNumber(value) * 60);
}

function defaultConfigByTipo(tipo) {
  if (tipo === "fixa") {
    return {
      horasPorDia: 8,
      diasAtivos: ["segunda", "terca", "quarta", "quinta", "sexta"],
    };
  }

  if (tipo === "ciclo") {
    return {
      semanas: [{
        dias: Object.fromEntries(DIAS_KEYS.map((key) => [key, key === "sabado" || key === "domingo" ? null : 8])),
      }],
    };
  }

  return {
    dias: Object.fromEntries(DIAS_KEYS.map((key) => [key, key === "sabado" || key === "domingo" ? null : 8])),
  };
}

function normalizeDias(dias = []) {
  const byDay = new Map();

  for (const item of Array.isArray(dias) ? dias : []) {
    const dia = Number(item.dia_semana);
    const meta = Number(item.meta_minutos ?? 0);

    if (!Number.isInteger(dia) || dia < 1 || dia > 7) {
      throw createHttpError(400, "Dia da semana invalido.");
    }

    if (!Number.isInteger(meta) || meta < 0) {
      throw createHttpError(400, "Meta de minutos invalida.");
    }

    byDay.set(dia, meta);
  }

  return [1, 2, 3, 4, 5, 6, 7].map((dia) => ({
    dia_semana: dia,
    meta_minutos: byDay.get(dia) || 0,
  }));
}

function diasFromConfiguracao(tipo, configuracao) {
  if (tipo === "fixa") {
    const diasAtivos = Array.isArray(configuracao.diasAtivos) ? configuracao.diasAtivos : [];
    const horasPorDia = normalizeNumber(configuracao.horasPorDia);

    return DIAS_KEYS.map((key, index) => ({
      dia_semana: index + 1,
      meta_minutos: diasAtivos.includes(key) ? hoursToMinutes(horasPorDia) : 0,
    }));
  }

  if (tipo === "flexivel") {
    const dias = configuracao.dias || {};

    return DIAS_KEYS.map((key, index) => ({
      dia_semana: index + 1,
      meta_minutos: dias[key] === null ? 0 : hoursToMinutes(dias[key]),
    }));
  }

  if (tipo === "ciclo") {
    const semanas = Array.isArray(configuracao.semanas) && configuracao.semanas.length
      ? configuracao.semanas
      : defaultConfigByTipo("ciclo").semanas;

    return DIAS_KEYS.map((key, index) => {
      const total = semanas.reduce((sum, semana) => {
        const value = semana?.dias?.[key];
        return sum + (value === null ? 0 : normalizeNumber(value));
      }, 0);

      return {
        dia_semana: index + 1,
        meta_minutos: hoursToMinutes(total / semanas.length),
      };
    });
  }

  return normalizeDias([]);
}

function normalizePayload(payload = {}) {
  const nome = String(payload.nome || "").trim();
  const tipo = TIPOS_ESCALA.has(payload.tipo) ? payload.tipo : "fixa";
  const configuracao = payload.configuracao && typeof payload.configuracao === "object"
    ? payload.configuracao
    : defaultConfigByTipo(tipo);

  if (!nome) {
    throw createHttpError(400, "Nome obrigatorio.");
  }

  return {
    nome,
    tipo,
    ativo: payload.ativo === undefined ? true : Boolean(payload.ativo),
    configuracao,
    dias: payload.configuracao ? diasFromConfiguracao(tipo, configuracao) : normalizeDias(payload.dias),
  };
}

async function listarEscalas(user) {
  requireAdmin(user);
  return listEscalas();
}

async function buscarEscala(user, idValue) {
  requireAdmin(user);
  const id = parseId(idValue);
  const escala = await findEscalaById(id);

  if (!escala) {
    throw createHttpError(404, "Escala nao encontrada.");
  }

  return escala;
}

async function criarEscala(user, payload) {
  requireAdmin(user);
  const data = normalizePayload(payload);
  return createEscala(data);
}

async function atualizarEscala(user, idValue, payload) {
  requireAdmin(user);
  parseId(idValue);
  void payload;
  throw createHttpError(403, "Escala criada nao pode ser editada. Crie uma nova escala e vincule aos funcionarios.");
}

async function alterarStatusEscala(user, idValue, payload) {
  requireAdmin(user);
  const id = parseId(idValue);
  const current = await findEscalaById(id);

  if (!current) {
    throw createHttpError(404, "Escala nao encontrada.");
  }

  if (payload?.ativo === undefined) {
    throw createHttpError(400, "Status ativo obrigatorio.");
  }

  return updateEscalaStatus(id, Boolean(payload.ativo));
}

module.exports = {
  alterarStatusEscala,
  atualizarEscala,
  buscarEscala,
  criarEscala,
  listarEscalas,
};
