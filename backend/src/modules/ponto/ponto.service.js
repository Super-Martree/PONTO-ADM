const {
  findLastPunch,
  getFuncionarioEscalaByMatricula,
  getTodayDate,
  insertPunch,
  listActiveAllowedPunchLocations,
  listAdminApuracaoRange,
  listAdminMonthlyPunches,
  listAdminTodayApuracao,
  listFeriadosByRange,
  listLatestPunches,
  listPunchesByRange,
  listTodayPunches,
} = require("./ponto.repository");
const { listActiveAdjustmentsByRange } = require("../ajustarPonto/ajustarPonto.repository");
const { getLocalizacaoConfig } = require("../configuracoes/configuracoes.repository");
const { resolveEscalaExpectedMinutes } = require("../escalas/escalaRuntime");

const TIPOS = ["entrada1", "saida1", "entrada2", "saida2"];
const DIA_NOMES = {
  1: "Segunda",
  2: "Terca",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sabado",
  7: "Domingo",
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateMatricula(matricula) {
  return /^[A-Za-z0-9._-]{1,20}$/.test(String(matricula || "").trim());
}

function normalizeMatricula(matricula) {
  return String(matricula || "").trim();
}

function normalizeLocation(payload = {}) {
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  const accuracyMeters = payload.accuracyMeters === null || payload.accuracyMeters === undefined
    ? null
    : Number(payload.accuracyMeters);
  const capturedAt = payload.capturedAt ? new Date(payload.capturedAt) : new Date();

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw createHttpError(400, "Latitude da localizacao invalida.");
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw createHttpError(400, "Longitude da localizacao invalida.");
  }

  if (accuracyMeters !== null && (!Number.isFinite(accuracyMeters) || accuracyMeters < 0)) {
    throw createHttpError(400, "Precisao da localizacao invalida.");
  }

  if (Number.isNaN(capturedAt.getTime())) {
    throw createHttpError(400, "Data da localizacao invalida.");
  }

  return {
    latitude,
    longitude,
    accuracyMeters,
    capturedAt: capturedAt.toISOString(),
  };
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceMeters(origin, target) {
  const earthRadiusMeters = 6371000;
  const deltaLat = degreesToRadians(target.latitude - origin.latitude);
  const deltaLon = degreesToRadians(target.longitude - origin.longitude);
  const originLat = degreesToRadians(origin.latitude);
  const targetLat = degreesToRadians(target.latitude);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(originLat) * Math.cos(targetLat) * Math.sin(deltaLon / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function findAllowedLocation(location, allowedLocations = []) {
  let nearest = null;

  for (const allowed of allowedLocations) {
    const distanceMeters = calculateDistanceMeters(location, allowed);
    const candidate = {
      ...allowed,
      distanceMeters,
    };

    if (!nearest || distanceMeters < nearest.distanceMeters) {
      nearest = candidate;
    }

    if (distanceMeters <= Number(allowed.raioMetros || 0)) {
      return {
        allowed: true,
        location: candidate,
      };
    }
  }

  return {
    allowed: false,
    location: nearest,
  };
}

async function resolvePunchLocation(payload = {}) {
  const { validacaoLocalizacaoAtiva } = await getLocalizacaoConfig();

  if (!validacaoLocalizacaoAtiva) {
    return payload?.location ? normalizeLocation(payload.location) : null;
  }

  const location = normalizeLocation(payload?.location);
  const allowedLocations = await listActiveAllowedPunchLocations();

  if (!allowedLocations.length) {
    return null;
  }

  const result = findAllowedLocation(location, allowedLocations);

  if (result.allowed) {
    return location;
  }

  const nearest = result.location;
  const distanceText = nearest ? `${Math.round(nearest.distanceMeters)}m` : "fora da area permitida";
  const localText = nearest ? ` Local mais proximo: ${nearest.nome} (${distanceText}).` : "";
  throw createHttpError(403, `Voce esta fora dos locais permitidos para bater ponto.${localText}`);
}

function buildResumo({ matricula, data, batidas, esperadoMinutos = 8 * 60 }) {
  const resumo = {
    entrada1: null,
    saida1: null,
    entrada2: null,
    saida2: null,
    esperadoMinutos,
    esperado: formatMinutes(esperadoMinutos),
    totalBatidas: batidas.length,
    limiteAtingido: batidas.length >= TIPOS.length,
    proximaBatida: TIPOS[batidas.length] || null,
  };

  for (const batida of batidas) {
    resumo[batida.tipo] = batida.hora_ponto;
  }

  return {
    matricula,
    data,
    batidas: batidas.map(({
      tipo,
      hora_ponto,
      latitude,
      longitude,
      accuracy_meters,
      location_captured_at,
    }) => ({
      tipo,
      hora_ponto,
      latitude,
      longitude,
      accuracy_meters,
      location_captured_at,
    })),
    resumo,
  };
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function maxDateOnly(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return a > b ? a : b;
}

function parseDateOnly(value) {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : text;
}

function resolvePeriodRange(query = {}) {
  const periodo = String(query.periodo || "dia").toLowerCase();
  const today = new Date();
  const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const end = new Date(start);

  if (periodo === "geral") {
    return { periodo, startDate: "1900-01-01", endDate: "9999-12-31" };
  }

  if (periodo === "semana") {
    const day = start.getUTCDay();
    const offset = day === 0 ? 6 : day - 1;
    start.setUTCDate(start.getUTCDate() - offset);
    end.setUTCDate(start.getUTCDate() + 6);
  } else if (periodo === "mes") {
    start.setUTCDate(1);
    end.setUTCMonth(start.getUTCMonth() + 1, 0);
  } else if (periodo === "personalizado") {
    const inicio = parseDateOnly(query.inicio);
    const fim = parseDateOnly(query.fim);

    if (!inicio || !fim || inicio > fim) {
      throw createHttpError(400, "Informe um periodo personalizado valido.");
    }

    return { periodo, startDate: inicio, endDate: fim };
  } else if (periodo !== "dia") {
    throw createHttpError(400, "Periodo invalido.");
  }

  return {
    periodo,
    startDate: toDateOnly(start),
    endDate: toDateOnly(end),
  };
}

function resolveAdminApuracaoRange(query = {}) {
  const periodo = String(query.periodo || "geral").toLowerCase();
  const today = new Date();
  const start = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const end = new Date(start);

  if (query.data) {
    const data = parseDateOnly(query.data);
    if (!data) {
      throw createHttpError(400, "Data de apuracao invalida.");
    }
    return { periodo: "dia", startDate: data, endDate: data, calendar: true };
  }

  if (periodo === "geral") {
    return { periodo, startDate: "1900-01-01", endDate: "9999-12-31", calendar: false };
  }

  if (periodo === "hoje") {
    return {
      periodo,
      startDate: toDateOnly(start),
      endDate: toDateOnly(end),
      calendar: true,
    };
  }

  if (periodo === "semana") {
    const day = start.getUTCDay();
    const offset = day === 0 ? 6 : day - 1;
    start.setUTCDate(start.getUTCDate() - offset);
    end.setUTCDate(start.getUTCDate() + 6);
  } else if (periodo === "mes") {
    start.setUTCDate(1);
    end.setUTCMonth(start.getUTCMonth() + 1, 0);
  } else if (periodo === "personalizado") {
    const inicio = parseDateOnly(query.inicio);
    const fim = parseDateOnly(query.fim);

    if (!inicio || !fim || inicio > fim) {
      throw createHttpError(400, "Informe um periodo personalizado valido.");
    }

    return { periodo, startDate: inicio, endDate: fim, calendar: true };
  } else {
    throw createHttpError(400, "Periodo invalido.");
  }

  return {
    periodo,
    startDate: toDateOnly(start),
    endDate: toDateOnly(end),
    calendar: true,
  };
}

function groupPunchesByDate({ matricula, batidas }) {
  const grouped = new Map();

  for (const batida of batidas) {
    if (!grouped.has(batida.data_ponto)) {
      grouped.set(batida.data_ponto, {
        matricula,
        data: batida.data_ponto,
        entrada1: null,
        saida1: null,
        entrada2: null,
        saida2: null,
        totalBatidas: 0,
      });
    }

    const row = grouped.get(batida.data_ponto);
    row[batida.tipo] = batida.hora_ponto;
    row.totalBatidas += 1;
  }

  return [...grouped.values()].map((row) => ({
    ...row,
    limiteAtingido: row.totalBatidas >= TIPOS.length,
    proximaBatida: TIPOS[row.totalBatidas] || null,
  }));
}

function hasPontoBatido(row) {
  return Number(row?.totalBatidas || 0) > 0;
}

function timeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function formatMinutes(totalMinutes, { signed = false } = {}) {
  const value = Number(totalMinutes || 0);
  const sign = value < 0 ? "-" : signed ? "+" : "";
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function calculateWorkedMinutes(row) {
  const entrada1 = timeToMinutes(row.entrada1);
  const saida1 = timeToMinutes(row.saida1);
  const entrada2 = timeToMinutes(row.entrada2);
  const saida2 = timeToMinutes(row.saida2);
  let total = 0;

  if (entrada1 !== null && saida1 !== null && saida1 >= entrada1) {
    total += saida1 - entrada1;
  }

  if (entrada2 !== null && saida2 !== null && saida2 >= entrada2) {
    total += saida2 - entrada2;
  }

  return total;
}

function getDiaSemana(dateText) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function addDays(dateText, amount) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDateOnly(date);
}

function listDates(startDate, endDate) {
  const dates = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);
    current = addDays(current, 1);
  }

  return dates;
}

function getLocalDateOnly() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildEscalaInfo(rows = []) {
  const first = rows[0] || {};
  const dias = new Map();

  for (const row of rows) {
    if (row.diaSemana) {
      dias.set(Number(row.diaSemana), Number(row.metaMinutos || 0));
    }
  }

  return {
    escalaId: first.escalaId || null,
    escalaNome: first.escalaNome || "Sem escala",
    tipo: first.escalaTipo || "fixa",
    configuracao: first.escalaConfiguracao || null,
    dataInicio: first.escalaDataInicio || first.dataInicioPonto || null,
    dataInicioPonto: first.dataInicioPonto || null,
    dias,
  };
}

function buildFeriadosMap(rows = []) {
  return new Map(rows.map((feriado) => [feriado.data, feriado]));
}

function enrichPontoRow(row, escalaInfo, feriadosMap = new Map()) {
  if (escalaInfo?.dataInicioPonto && row.data < escalaInfo.dataInicioPonto) {
    return {
      ...row,
      escala: escalaInfo?.escalaNome || row.escalaNome || "Sem escala",
      feriado: null,
      statusCodigo: null,
      status: null,
      esperadoMinutos: 0,
      esperado: formatMinutes(0),
      trabalhadoMinutos: 0,
      trabalhado: formatMinutes(0),
      saldoMinutos: null,
      saldo: null,
    };
  }

  const feriado = feriadosMap.get(row.data);
  const trabalhadoMinutos = calculateWorkedMinutes(row);
  const totalBatidas = Number(row.totalBatidas || 0);
  const today = getLocalDateOnly();
  const isFuture = row.data > today;

  if (isFuture && totalBatidas === 0) {
    const esperadoMinutos = feriado ? 0 : row.esperadoMinutos ?? resolveEscalaExpectedMinutes(escalaInfo, row.data);
    const status = feriado ? "Feriado" : esperadoMinutos > 0 ? "A trabalhar" : "Folga";
    const statusCodigo = feriado ? "feriado" : esperadoMinutos > 0 ? "a_trabalhar" : "folga";

    return {
      ...row,
      escala: feriado ? "Feriado" : escalaInfo?.escalaNome || row.escalaNome || "Sem escala",
      feriado: feriado?.descricao || null,
      statusCodigo,
      status,
      esperadoMinutos,
      esperado: formatMinutes(esperadoMinutos),
      trabalhadoMinutos: 0,
      trabalhado: formatMinutes(0),
      saldoMinutos: null,
      saldo: null,
    };
  }

  if (feriado) {
    const saldoMinutos = totalBatidas > 0 ? trabalhadoMinutos : 0;

    return {
      ...row,
      escala: "Feriado",
      feriado: feriado.descricao,
      statusCodigo: totalBatidas > 0 ? "feriado_trabalhado" : "feriado",
      status: totalBatidas > 0 ? "Feriado Trabalhado" : "Feriado",
      esperadoMinutos: 0,
      esperado: formatMinutes(0),
      trabalhadoMinutos,
      trabalhado: formatMinutes(trabalhadoMinutos),
      saldoMinutos,
      saldo: formatMinutes(saldoMinutos, { signed: true }),
    };
  }

  const esperadoMinutos = row.esperadoMinutos ?? resolveEscalaExpectedMinutes(escalaInfo, row.data);
  const saldoMinutos = trabalhadoMinutos - esperadoMinutos;
  const isToday = row.data === today;
  let status = "Completo";
  let statusCodigo = "normal";

  if (esperadoMinutos <= 0) {
    if (totalBatidas > 0) {
      status = "Indevido";
      statusCodigo = "indevido";
    } else {
      status = "Folga";
      statusCodigo = "folga";
    }
  } else if (isToday && totalBatidas < TIPOS.length) {
    status = "Em andamento";
    statusCodigo = "em_andamento";
  } else if (totalBatidas === 0) {
    status = "Falta";
    statusCodigo = "debito";
  } else if (totalBatidas % 2 !== 0) {
    status = "Incompleto";
    statusCodigo = "incompleto";
  } else if (saldoMinutos > 0) {
    statusCodigo = "credito";
  } else if (saldoMinutos < 0) {
    statusCodigo = "debito";
  }

  return {
    ...row,
    escala: escalaInfo?.escalaNome || row.escalaNome || "Sem escala",
    esperadoMinutos,
    esperado: formatMinutes(esperadoMinutos),
    trabalhadoMinutos,
    trabalhado: formatMinutes(trabalhadoMinutos),
    saldoMinutos: status === "Em andamento" ? null : saldoMinutos,
    saldo: status === "Em andamento" ? null : formatMinutes(saldoMinutos, { signed: true }),
    statusCodigo,
    status,
  };
}

function applyMonthlyAdjustment(row, adjustment) {
  if (!adjustment) {
    return row;
  }

  if (adjustment.tipoAjuste === "PAGO_EM_FOLHA") {
    return {
      ...row,
      ajustado: true,
      tipoAjuste: adjustment.tipoAjuste,
      motivoAjuste: adjustment.motivo || null,
      observacaoAjuste: adjustment.observacao || null,
    };
  }

  const values = {
    entrada1: adjustment.entrada1 || null,
    saida1: adjustment.saida1 || null,
    entrada2: adjustment.entrada2 || null,
    saida2: adjustment.saida2 || null,
  };

  return {
    ...row,
    ...values,
    totalBatidas: Object.values(values).filter(Boolean).length,
    ajustado: true,
    tipoAjuste: adjustment.tipoAjuste,
    metaMinutosOverride: adjustment.metaMinutosOverride || null,
    motivoAjuste: adjustment.motivo || null,
    observacaoAjuste: adjustment.observacao || null,
  };
}

function overrideMonthlyAdjustmentStatus(row) {
  if (!row.ajustado) {
    return row;
  }

  if (row.tipoAjuste === "JUSTIFICAR_FALTA") {
    return {
      ...row,
      statusCodigo: "falta_justificada",
      status: "Falta justificada",
    };
  }

  if (row.tipoAjuste === "ABONAR_DIA") {
    return {
      ...row,
      statusCodigo: "atestado",
      status: "Atestado",
      esperadoMinutos: 0,
      esperado: formatMinutes(0),
      saldoMinutos: 0,
      saldo: formatMinutes(0, { signed: true }),
    };
  }

  if (row.tipoAjuste === "FALTA_DESCONTADA") {
    return {
      ...row,
      statusCodigo: "falta_descontada",
      status: "Falta descontada",
      esperadoMinutos: 0,
      esperado: formatMinutes(0),
      saldoMinutos: 0,
      saldo: formatMinutes(0, { signed: true }),
    };
  }

  if (row.tipoAjuste === "PAGO_EM_FOLHA") {
    const saldoMinutos = Math.min(Number(row.saldoMinutos || 0), 0);

    return {
      ...row,
      statusCodigo: "pago_em_folha",
      status: "Pago em folha",
      saldoMinutos,
      saldo: formatMinutes(saldoMinutos, { signed: true }),
    };
  }

  if (row.tipoAjuste === "MARCAR_FERIADO") {
    return {
      ...row,
      escala: "Feriado pago",
      statusCodigo: "feriado_pago",
      status: "Feriado pago",
      esperadoMinutos: 0,
      esperado: formatMinutes(0),
      saldoMinutos: 0,
      saldo: formatMinutes(0, { signed: true }),
    };
  }

  if (row.tipoAjuste === "MARCAR_FOLGA") {
    return {
      ...row,
      escala: "Folga ajustada",
      statusCodigo: "folga",
      status: "Folga",
      esperadoMinutos: 0,
      esperado: formatMinutes(0),
      saldoMinutos: 0,
      saldo: formatMinutes(0, { signed: true }),
    };
  }

  if (row.tipoAjuste === "MARCAR_TRABALHO") {
    const esperadoMinutos = Number(row.metaMinutosOverride || row.esperadoMinutos || 0);
    const saldoMinutos = Number(row.trabalhadoMinutos || 0) - esperadoMinutos;

    return {
      ...row,
      statusCodigo: row.statusCodigo === "folga" ? "normal" : row.statusCodigo,
      status: row.status === "Folga" ? "Completo" : row.status,
      esperadoMinutos,
      esperado: formatMinutes(esperadoMinutos),
      saldoMinutos,
      saldo: formatMinutes(saldoMinutos, { signed: true }),
    };
  }

  return row;
}

function suppressInProgressMonthlyBalance(row) {
  if (row.status !== "Em andamento") {
    return row;
  }

  return {
    ...row,
    saldoMinutos: null,
    saldo: null,
  };
}

function summarizePontoDias(dias = []) {
  const diasValidos = dias.filter((dia) => dia.status);
  const saldoMinutos = diasValidos.reduce((total, dia) => (
    dia.saldoMinutos === null ? total : total + Number(dia.saldoMinutos || 0)
  ), 0);
  const uteis = diasValidos.filter((dia) => Number(dia.esperadoMinutos || 0) > 0).length;
  const trabalhados = diasValidos.filter((dia) => Number(dia.trabalhadoMinutos || 0) > 0).length;
  const faltas = diasValidos.filter((dia) => dia.status === "Falta").length;
  const incompletos = diasValidos.filter((dia) => dia.status === "Incompleto").length;
  const pendentes = diasValidos.filter((dia) => (
    dia.status === "Falta"
    || dia.status === "Incompleto"
    || dia.status === "Em andamento"
    || dia.status === "Fora da escala"
  )).length;
  const ajustados = diasValidos.filter((dia) => dia.ajustado).length;

  return {
    dias: diasValidos.length,
    uteis,
    trabalhados,
    faltas,
    pendentes,
    incompletos,
    ajustados,
    saldoMinutos,
    saldo: formatMinutes(saldoMinutos, { signed: true }),
  };
}

function getAuthenticatedMatricula(user) {
  const cleanMatricula = normalizeMatricula(user?.matricula);

  if (!validateMatricula(cleanMatricula)) {
    throw createHttpError(401, "Sessão inválida.");
  }

  return cleanMatricula;
}

async function getTodayStatus(user) {
  const cleanMatricula = getAuthenticatedMatricula(user);
  const escalaRows = await getFuncionarioEscalaByMatricula(cleanMatricula);
  const dataInicioPonto = escalaRows[0]?.dataInicioPonto || null;

  const [data, batidas] = await Promise.all([
    getTodayDate(),
    listTodayPunches(cleanMatricula, dataInicioPonto),
  ]);
  const escalaInfo = buildEscalaInfo(escalaRows);
  const feriadosRows = await listFeriadosByRange({ startDate: data, endDate: data });
  const esperadoMinutos = feriadosRows.length > 0 ? 0 : resolveEscalaExpectedMinutes(escalaInfo, data);

  return buildResumo({ matricula: cleanMatricula, data, batidas, esperadoMinutos });
}

async function getRegistrosPeriodo(user, query) {
  const cleanMatricula = getAuthenticatedMatricula(user);
  const range = resolvePeriodRange(query);
  const employeeRows = await getFuncionarioEscalaByMatricula(cleanMatricula);
  const dataInicioPonto = employeeRows[0]?.dataInicioPonto || null;
  const startDate = maxDateOnly(range.startDate, dataInicioPonto);
  const [batidas, feriadosRows] = await Promise.all([
    listPunchesByRange({
      matricula: cleanMatricula,
      startDate,
      endDate: range.endDate,
    }),
    listFeriadosByRange({
      startDate,
      endDate: range.endDate,
    }),
  ]);
  const escalaInfo = buildEscalaInfo(employeeRows);
  const feriadosMap = buildFeriadosMap(feriadosRows);
  const grouped = groupPunchesByDate({ matricula: cleanMatricula, batidas });
  const groupedByDate = new Map(grouped.map((row) => [row.data, row]));
  const shouldGenerateCalendar = range.periodo !== "geral";
  const dias = shouldGenerateCalendar
    ? listDates(startDate, range.endDate).map((data) => groupedByDate.get(data) || {
      matricula: cleanMatricula,
      data,
      entrada1: null,
      saida1: null,
      entrada2: null,
      saida2: null,
      totalBatidas: 0,
      limiteAtingido: false,
      proximaBatida: TIPOS[0],
    })
    : grouped;

  const diasComBatida = dias
    .map((row) => enrichPontoRow(row, escalaInfo, feriadosMap))
    .filter(hasPontoBatido)
    .sort((a, b) => b.data.localeCompare(a.data));

  return {
    matricula: cleanMatricula,
    escala: escalaInfo.escalaNome,
    periodo: range.periodo,
    inicio: range.startDate,
    fim: range.endDate,
    dias: diasComBatida,
  };
}

async function baterPonto(user, payload = {}) {
  if (user?.role === "admin") {
    throw createHttpError(403, "Administrador não registra ponto.");
  }

  const cleanMatricula = getAuthenticatedMatricula(user);
  const location = await resolvePunchLocation(payload);
  const escalaRows = await getFuncionarioEscalaByMatricula(cleanMatricula);
  const dataInicioPonto = escalaRows[0]?.dataInicioPonto || null;

  const lastPunch = await findLastPunch(cleanMatricula, dataInicioPonto);

  if (lastPunch && Number(lastPunch.segundos_desde_ultima) < 30) {
    throw createHttpError(429, "Aguarde 30 segundos para bater o ponto novamente.");
  }

  const todayPunches = await listTodayPunches(cleanMatricula, dataInicioPonto);

  if (todayPunches.length >= TIPOS.length) {
    throw createHttpError(400, "Limite de 4 batidas diárias atingido.");
  }

  const tipo = TIPOS[todayPunches.length];
  const registro = await insertPunch({ matricula: cleanMatricula, tipo, location });
  const proximaBatida = TIPOS[todayPunches.length + 1] || null;

  return {
    message: "Ponto registrado com sucesso.",
    registro: {
      id: registro.id,
      matricula: registro.matricula,
      data_ponto: registro.data_ponto,
      hora_ponto: registro.hora_ponto,
      tipo: registro.tipo,
      latitude: registro.latitude,
      longitude: registro.longitude,
      accuracy_meters: registro.accuracy_meters,
      location_captured_at: registro.location_captured_at,
    },
    proximaBatida,
  };
}

async function getAdminTodayApuracao(user, query = {}) {
  if (user?.role !== "admin") {
    throw createHttpError(403, "Acesso restrito ao administrador.");
  }

  if (query?.periodo || query?.inicio || query?.fim) {
    return getAdminApuracaoPeriodo(user, query);
  }

  const requestedDate = query.data ? parseDateOnly(query.data) : await getTodayDate();
  if (!requestedDate) {
    throw createHttpError(400, "Data de apuracao invalida.");
  }

  const [rows, feriadosRows, ajustesMap] = await Promise.all([
    listAdminTodayApuracao(requestedDate),
    listFeriadosByRange({ startDate: requestedDate, endDate: requestedDate }),
    listActiveAdjustmentsByRange({ matricula: "", startDate: requestedDate, endDate: requestedDate }),
  ]);
  const feriadosMap = buildFeriadosMap(feriadosRows);
  const data = rows[0]?.data || requestedDate;
  const funcionarios = rows.map((row) => {
    const totalBatidas = Number(row.totalBatidas || 0);

    return {
      matricula: row.matricula,
      nome: row.nome || `Matricula ${row.matricula}`,
      loja: row.loja || "Sem loja",
      escala: row.escalaNome || "Sem escala",
      data,
      entrada1: row.entrada1 || null,
      saida1: row.saida1 || null,
      entrada2: row.entrada2 || null,
      saida2: row.saida2 || null,
      totalBatidas,
      esperadoMinutos: resolveEscalaExpectedMinutes({
        tipo: row.escalaTipo || "fixa",
        configuracao: row.escalaConfiguracao || null,
        dataInicio: row.escalaDataInicio || row.dataInicioPonto || null,
        dataInicioPonto: row.dataInicioPonto || null,
        dias: new Map([[getDiaSemana(data), Number(row.esperadoMinutos || 0)]]),
      }, data),
    };
  }).map((row) => {
    const adjustment = ajustesMap.get(`${row.matricula}|${row.data}`);
    const adjustedRow = applyMonthlyAdjustment(row, adjustment);
    const enrichedRow = enrichPontoRow(adjustedRow, { escalaNome: row.escala, dias: new Map() }, feriadosMap);

    return suppressInProgressMonthlyBalance(overrideMonthlyAdjustmentStatus(enrichedRow));
  });

  const comBatida = funcionarios.filter((item) => item.totalBatidas > 0).length;
  const completos = funcionarios.filter((item) => (
    item.status === "Completo" || item.status === "Folga" || item.status === "Feriado" || item.status === "Feriado Trabalhado"
  )).length;
  const pendencias = funcionarios.filter((item) => (
    item.status === "Falta" || item.status === "Incompleto" || item.status === "Em andamento" || item.status === "Fora da escala"
  )).length;

  return {
    data,
    resumo: {
      funcionarios: funcionarios.length,
      comBatida,
      completos,
      pendencias,
    },
    funcionarios,
  };
}

function groupMonthlyRows(rows, startDate, endDate, feriadosMap = new Map(), ajustesMap = new Map()) {
  const funcionarios = new Map();

  for (const row of rows) {
    const matricula = row.matricula;
    if (!funcionarios.has(matricula)) {
      funcionarios.set(matricula, {
        matricula,
        nome: row.nome || `Matricula ${matricula}`,
        loja: row.loja || "Sem loja",
        escalaNome: row.escalaNome || "Sem escala",
        escalaTipo: row.escalaTipo || "fixa",
        escalaConfiguracao: row.escalaConfiguracao || null,
        dataInicioPonto: row.dataInicioPonto || null,
        diasEscala: new Map(),
        escalaHistorico: new Map(),
        batidas: new Map(),
      });
    }

    const funcionario = funcionarios.get(matricula);
    funcionario.dataInicioPonto = funcionario.dataInicioPonto || row.dataInicioPonto || null;

    if (row.diaSemana) {
      funcionario.diasEscala.set(Number(row.diaSemana), Number(row.metaMinutos || 0));

      const escalaInicio = row.escalaDataInicio || row.dataInicioPonto || "1900-01-01";
      if (!funcionario.escalaHistorico.has(escalaInicio)) {
        funcionario.escalaHistorico.set(escalaInicio, {
          escalaNome: row.escalaNome || "Sem escala",
          tipo: row.escalaTipo || "fixa",
          configuracao: row.escalaConfiguracao || null,
          dataInicio: escalaInicio,
          dias: new Map(),
        });
      }

      funcionario.escalaHistorico.get(escalaInicio).dias.set(Number(row.diaSemana), Number(row.metaMinutos || 0));
    }

    if (row.data_ponto && row.tipo) {
      if (!funcionario.batidas.has(row.data_ponto)) {
        funcionario.batidas.set(row.data_ponto, {
          matricula,
          data: row.data_ponto,
          entrada1: null,
          saida1: null,
          entrada2: null,
          saida2: null,
          totalBatidas: 0,
        });
      }

      const dia = funcionario.batidas.get(row.data_ponto);
      if (!dia[row.tipo]) {
        dia[row.tipo] = row.hora_ponto;
        dia.totalBatidas += 1;
      }
    }
  }

  return [...funcionarios.values()].map((funcionario) => {
    const historico = [...funcionario.escalaHistorico.entries()]
      .map(([dataInicio, escala]) => ({ dataInicio, ...escala }))
      .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
    const getEscalaInfo = (data) => {
      const selected = [...historico].reverse().find((escala) => escala.dataInicio <= data);

      return {
        escalaNome: selected?.escalaNome || funcionario.escalaNome,
        tipo: selected?.tipo || funcionario.escalaTipo || "fixa",
        configuracao: selected?.configuracao || funcionario.escalaConfiguracao || null,
        dataInicio: selected?.dataInicio || funcionario.dataInicioPonto,
        dias: selected?.dias || funcionario.diasEscala,
        dataInicioPonto: funcionario.dataInicioPonto,
      };
    };
    const dias = listDates(startDate, endDate)
      .map((data) => {
        const escalaInfo = getEscalaInfo(data);
        const expectedMinutes = resolveEscalaExpectedMinutes(escalaInfo, data);
        const row = funcionario.batidas.get(data) || {
          matricula: funcionario.matricula,
          data,
          entrada1: null,
          saida1: null,
          entrada2: null,
          saida2: null,
          totalBatidas: 0,
          esperadoMinutos: expectedMinutes,
        };

        const adjustment = ajustesMap.get(`${funcionario.matricula}|${data}`);
        const adjustedRow = applyMonthlyAdjustment(row, adjustment);
        const enrichedRow = enrichPontoRow(adjustedRow, escalaInfo, feriadosMap);

        return suppressInProgressMonthlyBalance(overrideMonthlyAdjustmentStatus(enrichedRow));
      });

    return {
      matricula: funcionario.matricula,
      nome: funcionario.nome,
      loja: funcionario.loja,
      escala: funcionario.escalaNome,
      dias,
    };
  });
}

function groupApuracaoRows(rows, startDate, endDate, { calendar = false, feriadosMap = new Map(), ajustesMap = new Map() } = {}) {
  const funcionarios = new Map();

  for (const row of rows) {
    const matricula = row.matricula;
    if (!funcionarios.has(matricula)) {
      funcionarios.set(matricula, {
        matricula,
        nome: row.nome || `Matricula ${matricula}`,
        loja: row.loja || "Sem loja",
        escalaNome: row.escalaNome || "Sem escala",
        escalaTipo: row.escalaTipo || "fixa",
        escalaConfiguracao: row.escalaConfiguracao || null,
        dataInicioPonto: row.dataInicioPonto || null,
        diasEscala: new Map(),
        escalaHistorico: new Map(),
        batidas: new Map(),
      });
    }

    const funcionario = funcionarios.get(matricula);
    funcionario.dataInicioPonto = funcionario.dataInicioPonto || row.dataInicioPonto || null;

    if (row.diaSemana) {
      funcionario.diasEscala.set(Number(row.diaSemana), Number(row.metaMinutos || 0));

      const escalaInicio = row.escalaDataInicio || row.dataInicioPonto || "1900-01-01";
      if (!funcionario.escalaHistorico.has(escalaInicio)) {
        funcionario.escalaHistorico.set(escalaInicio, {
          escalaNome: row.escalaNome || "Sem escala",
          tipo: row.escalaTipo || "fixa",
          configuracao: row.escalaConfiguracao || null,
          dataInicio: escalaInicio,
          dias: new Map(),
        });
      }

      funcionario.escalaHistorico.get(escalaInicio).dias.set(Number(row.diaSemana), Number(row.metaMinutos || 0));
    }

    if (row.data_ponto && row.tipo) {
      if (!funcionario.batidas.has(row.data_ponto)) {
        funcionario.batidas.set(row.data_ponto, {
          matricula,
          data: row.data_ponto,
          entrada1: null,
          saida1: null,
          entrada2: null,
          saida2: null,
          totalBatidas: 0,
        });
      }

      const dia = funcionario.batidas.get(row.data_ponto);
      if (!dia[row.tipo]) {
        dia[row.tipo] = row.hora_ponto;
        dia.totalBatidas += 1;
      }
    }
  }

  const flattened = [];

  for (const funcionario of funcionarios.values()) {
    const historico = [...funcionario.escalaHistorico.entries()]
      .map(([dataInicio, escala]) => ({ dataInicio, ...escala }))
      .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
    const getEscalaInfo = (data) => {
      const selected = [...historico].reverse().find((escala) => escala.dataInicio <= data);

      return {
        escalaNome: selected?.escalaNome || funcionario.escalaNome,
        tipo: selected?.tipo || funcionario.escalaTipo || "fixa",
        configuracao: selected?.configuracao || funcionario.escalaConfiguracao || null,
        dataInicio: selected?.dataInicio || funcionario.dataInicioPonto,
        dias: selected?.dias || funcionario.diasEscala,
        dataInicioPonto: funcionario.dataInicioPonto,
      };
    };
    const effectiveStartDate = maxDateOnly(startDate, funcionario.dataInicioPonto);
    const dates = (calendar ? listDates(effectiveStartDate, endDate) : [...funcionario.batidas.keys()].sort())
      .filter((data) => funcionario.batidas.has(data));

    for (const data of dates) {
      const row = funcionario.batidas.get(data) || {
        matricula: funcionario.matricula,
        data,
        entrada1: null,
        saida1: null,
        entrada2: null,
        saida2: null,
        totalBatidas: 0,
      };
      const adjustment = ajustesMap.get(`${funcionario.matricula}|${data}`);
      const escalaInfo = getEscalaInfo(data);
      const adjustedRow = applyMonthlyAdjustment(row, adjustment);
      const enriched = suppressInProgressMonthlyBalance(overrideMonthlyAdjustmentStatus(
        enrichPontoRow(adjustedRow, escalaInfo, feriadosMap)
      ));

      if (!hasPontoBatido(enriched)) {
        continue;
      }

      flattened.push({
        ...enriched,
        nome: funcionario.nome,
        loja: funcionario.loja,
      });
    }
  }

  return flattened.sort((a, b) => b.data.localeCompare(a.data) || a.nome.localeCompare(b.nome));
}

async function getAdminPontoDoMes(user, query = {}) {
  if (user?.role !== "admin") {
    throw createHttpError(403, "Acesso restrito ao administrador.");
  }

  const today = new Date();
  const ano = Number(query.ano || today.getFullYear());
  const mes = Number(query.mes || (today.getMonth() + 1));
  const matricula = query.matricula ? normalizeMatricula(query.matricula) : "";

  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw createHttpError(400, "Mes ou ano invalido.");
  }

  if (matricula && !validateMatricula(matricula)) {
    throw createHttpError(400, "Matricula invalida.");
  }

  const startDate = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const endDate = toDateOnly(new Date(Date.UTC(ano, mes, 0)));
  const [rows, feriadosRows, ajustesMap] = await Promise.all([
    listAdminMonthlyPunches({ matricula, startDate, endDate }),
    listFeriadosByRange({ startDate, endDate }),
    listActiveAdjustmentsByRange({ matricula, startDate, endDate }),
  ]);
  const feriadosMap = buildFeriadosMap(feriadosRows);
  const funcionarios = groupMonthlyRows(rows, startDate, endDate, feriadosMap, ajustesMap);
  const selected = funcionarios[0] || null;
  const dias = selected?.dias || [];
  const closedDias = dias.filter((dia) => dia.status);
  const resumo = {
    dias: dias.length,
    diasTrabalhados: closedDias.filter((dia) => dia.trabalhadoMinutos > 0).length,
    faltas: closedDias.filter((dia) => dia.status === "Falta").length,
    folgas: closedDias.filter((dia) => dia.status === "Folga").length,
    feriados: closedDias.filter((dia) => dia.statusCodigo === "feriado").length,
    aTrabalhar: closedDias.filter((dia) => dia.status === "A trabalhar").length,
    pendencias: closedDias.filter((dia) => dia.status === "Incompleto" || dia.status === "Em andamento").length,
    esperado: formatMinutes(closedDias.reduce((total, dia) => total + dia.esperadoMinutos, 0)),
    trabalhado: formatMinutes(closedDias.reduce((total, dia) => total + dia.trabalhadoMinutos, 0)),
    saldo: formatMinutes(closedDias.reduce((total, dia) => total + dia.saldoMinutos, 0), { signed: true }),
  };

  return {
    mes,
    ano,
    inicio: startDate,
    fim: endDate,
    funcionarios: funcionarios.map(({ dias: _dias, ...funcionario }) => funcionario),
    funcionario: selected ? {
      matricula: selected.matricula,
      nome: selected.nome,
      loja: selected.loja,
      escala: selected.escala,
    } : null,
    resumo,
    dias: dias.map((dia) => ({
      ...dia,
      diaSemana: DIA_NOMES[getDiaSemana(dia.data)],
    })),
  };
}

async function getAdminResumoFuncionarios(user, query = {}) {
  if (user?.role !== "admin") {
    throw createHttpError(403, "Acesso restrito ao administrador.");
  }

  const today = new Date();
  const ano = Number(query.ano || today.getFullYear());
  const mes = Number(query.mes || (today.getMonth() + 1));

  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw createHttpError(400, "Mes ou ano invalido.");
  }

  const startDate = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const endDate = toDateOnly(new Date(Date.UTC(ano, mes, 0)));
  const [rows, feriadosRows, ajustesMap] = await Promise.all([
    listAdminMonthlyPunches({ matricula: "", startDate, endDate }),
    listFeriadosByRange({ startDate, endDate }),
    listActiveAdjustmentsByRange({ matricula: "", startDate, endDate }),
  ]);
  const feriadosMap = buildFeriadosMap(feriadosRows);
  const historyRows = await listAdminMonthlyPunches({ matricula: "", startDate: "1900-01-01", endDate });
  const historyStartDate = historyRows.reduce((earliest, row) => {
    const candidates = [row.dataInicioPonto, row.data_ponto].filter(Boolean);

    for (const candidate of candidates) {
      if (!earliest || candidate < earliest) {
        return candidate;
      }
    }

    return earliest;
  }, startDate);
  const [historyFeriadosRows, historyAjustesMap] = await Promise.all([
    listFeriadosByRange({ startDate: historyStartDate, endDate }),
    listActiveAdjustmentsByRange({ matricula: "", startDate: historyStartDate, endDate }),
  ]);
  const historicoMap = new Map(
    groupMonthlyRows(historyRows, historyStartDate, endDate, buildFeriadosMap(historyFeriadosRows), historyAjustesMap)
      .map((funcionario) => [funcionario.matricula, summarizePontoDias(funcionario.dias)])
  );
  const funcionarios = groupMonthlyRows(rows, startDate, endDate, feriadosMap, ajustesMap).map((funcionario) => {
    const resumo = summarizePontoDias(funcionario.dias);
    const geral = historicoMap.get(funcionario.matricula) || summarizePontoDias([]);

    return {
      matricula: funcionario.matricula,
      nome: funcionario.nome,
      loja: funcionario.loja,
      escala: funcionario.escala,
      resumo,
      geral,
      dias: funcionario.dias.filter((dia) => dia.status).map((dia) => ({
        ...dia,
        diaSemana: DIA_NOMES[getDiaSemana(dia.data)],
      })),
    };
  });

  const resumo = {
    funcionarios: funcionarios.length,
    saldoMinutos: funcionarios.reduce((total, funcionario) => total + Number(funcionario.resumo.saldoMinutos || 0), 0),
    comDebito: funcionarios.filter((funcionario) => Number(funcionario.resumo.saldoMinutos || 0) < 0).length,
    pendencias: funcionarios.reduce((total, funcionario) => total + Number(funcionario.resumo.pendentes || 0), 0),
    faltas: funcionarios.reduce((total, funcionario) => total + Number(funcionario.resumo.faltas || 0), 0),
    saldoGeralMinutos: funcionarios.reduce((total, funcionario) => total + Number(funcionario.geral.saldoMinutos || 0), 0),
    diasTrabalhadosGeral: funcionarios.reduce((total, funcionario) => total + Number(funcionario.geral.trabalhados || 0), 0),
  };

  return {
    mes,
    ano,
    inicio: startDate,
    fim: endDate,
    resumo: {
      ...resumo,
      saldo: formatMinutes(resumo.saldoMinutos, { signed: true }),
      saldoGeral: formatMinutes(resumo.saldoGeralMinutos, { signed: true }),
    },
    funcionarios,
  };
}

async function getFuncionarioPontoDoMes(user, query = {}) {
  const matricula = getAuthenticatedMatricula(user);
  return getAdminPontoDoMes({ role: "admin" }, { ...query, matricula });
}

async function getAdminApuracaoPeriodo(user, query = {}) {
  if (user?.role !== "admin") {
    throw createHttpError(403, "Acesso restrito ao administrador.");
  }

  const range = resolveAdminApuracaoRange(query);
  const [rows, feriadosRows, ajustesMap] = await Promise.all([
    listAdminApuracaoRange({
      startDate: range.startDate,
      endDate: range.endDate,
    }),
    listFeriadosByRange({
      startDate: range.startDate,
      endDate: range.endDate,
    }),
    listActiveAdjustmentsByRange({
      matricula: "",
      startDate: range.startDate,
      endDate: range.endDate,
    }),
  ]);
  const feriadosMap = buildFeriadosMap(feriadosRows);
  const funcionarios = groupApuracaoRows(rows, range.startDate, range.endDate, {
    calendar: range.calendar,
    feriadosMap,
    ajustesMap,
  });
  const comBatida = funcionarios.filter((item) => item.totalBatidas > 0).length;
  const completos = funcionarios.filter((item) => (
    item.status === "Completo" || item.status === "Folga" || item.status === "Feriado" || item.status === "Feriado Trabalhado"
  )).length;
  const pendencias = funcionarios.filter((item) => (
    item.status === "Falta" || item.status === "Incompleto" || item.status === "Em andamento"
  )).length;

  return {
    data: range.startDate === range.endDate ? range.startDate : null,
    periodo: range.periodo,
    inicio: range.startDate,
    fim: range.endDate,
    resumo: {
      funcionarios: funcionarios.length,
      comBatida,
      completos,
      pendencias,
    },
    funcionarios,
  };
}

async function getDashboardResumo(user) {
  if (user?.role !== "admin") {
    throw createHttpError(403, "Acesso restrito ao administrador.");
  }

  const [apuracao, ultimasBatidas] = await Promise.all([
    getAdminTodayApuracao(user),
    listLatestPunches(),
  ]);
  const registrosHoje = apuracao.funcionarios.reduce((total, item) => total + item.totalBatidas, 0);
  const funcionariosEscalados = apuracao.funcionarios.filter((item) => (
    item.status !== "Folga" && item.status !== "Feriado"
  )).length;

  return {
    data: apuracao.data,
    resumo: {
      funcionariosAtivos: funcionariosEscalados,
      presentesHoje: apuracao.resumo.comBatida,
      registrosHoje,
      pendencias: apuracao.resumo.pendencias,
    },
    funcionarios: apuracao.funcionarios,
    ultimasBatidas: ultimasBatidas.map((item) => ({
      matricula: item.matricula,
      nome: item.nome || `Matricula ${item.matricula}`,
      data_ponto: item.data_ponto,
      hora_ponto: item.hora_ponto,
      tipo: item.tipo,
    })),
  };
}

module.exports = {
  baterPonto,
  getAdminApuracaoPeriodo,
  getAdminTodayApuracao,
  getAdminPontoDoMes,
  getAdminResumoFuncionarios,
  getDashboardResumo,
  getFuncionarioPontoDoMes,
  getRegistrosPeriodo,
  getTodayStatus,
};
