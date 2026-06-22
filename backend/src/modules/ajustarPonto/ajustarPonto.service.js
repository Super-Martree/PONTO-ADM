const {
  clearAdjustment,
  findActiveAdjustmentByDate,
  findFuncionarioContextById,
  listActiveAdjustments,
  listAdjustmentsHistory,
  listOriginalPunches,
  saveAdjustment,
} = require("./ajustarPonto.repository");
const { listEscalasSemanaisByRange, listFeriadosByRange } = require("../ponto/ponto.repository");
const { resolveEscalaExpectedMinutes } = require("../escalas/escalaRuntime");

const TIPOS_AJUSTE = new Set([
  "ALTERAR_BATIDA",
  "JUSTIFICAR_FALTA",
  "ABONAR_DIA",
  "FALTA_DESCONTADA",
  "PAGO_EM_FOLHA",
  "MARCAR_FERIADO",
  "MARCAR_FOLGA",
  "MARCAR_TRABALHO",
]);

const TOTAL_BATIDAS_DIA = 4;

const TIPOS_SEM_HORARIO = new Set([
  "JUSTIFICAR_FALTA",
  "ABONAR_DIA",
  "FALTA_DESCONTADA",
  "PAGO_EM_FOLHA",
  "MARCAR_FERIADO",
  "MARCAR_FOLGA",
  "MARCAR_TRABALHO",
]);

const TIPOS_BLOQUEIAM_SOBREPOSICAO = new Set([
  "FALTA_DESCONTADA",
  "PAGO_EM_FOLHA",
  "MARCAR_FERIADO",
]);

const LABEL_TIPO_AJUSTE = {
  FALTA_DESCONTADA: "Falta descontada",
  PAGO_EM_FOLHA: "Pago em folha",
  MARCAR_FERIADO: "Feriado pago",
};

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

function requireAdmin(user) {
  if (user?.role !== "admin") {
    throw createHttpError(403, "Acesso restrito ao administrador.");
  }
}

function parseId(value, label = "ID") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw createHttpError(400, `${label} invalido.`);
  }
  return id;
}

function parseMonth(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw createHttpError(400, "Mes invalido. Use o formato YYYY-MM.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || month < 1 || month > 12) {
    throw createHttpError(400, "Mes invalido.");
  }

  return {
    ano: year,
    mes: month,
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: toDateOnly(new Date(Date.UTC(year, month, 0))),
  };
}

function parseDateOnly(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : text;
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
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

function getDiaSemana(dateText) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

const PENDING_PROBLEM_STATUSES = new Set(["FALTA", "INCOMPLETO", "TRABALHO_EM_FERIADO"]);

function isClosedPendingDay(data, status) {
  return Boolean(data) && data < getLocalDateOnly() && PENDING_PROBLEM_STATUSES.has(status);
}

function formatMinutes(totalMinutes, { signed = false } = {}) {
  const value = Number(totalMinutes || 0);
  const sign = value < 0 ? "-" : signed ? "+" : "";
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(value) {
  if (!value) return null;
  const [hours, minutes] = String(value).split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return (hours * 60) + minutes;
}

function normalizeTime(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseMetaMinutosOverride(value) {
  if (value === null || value === undefined || value === "") return null;
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 1440) {
    return null;
  }
  return minutes;
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

function buildFuncionario(rows) {
  const first = rows[0];
  if (!first) return null;

  const diasEscala = new Map();
  for (const row of rows) {
    if (row.diaSemana) {
      diasEscala.set(Number(row.diaSemana), Number(row.metaMinutos || 0));
    }
  }

  return {
    id: first.funcionarioId,
    matricula: first.matricula,
    nome: first.nome,
    lojaId: first.lojaId,
    loja: first.loja || "Sem loja",
    escalaId: first.escalaId,
    escala: first.escalaNome || "Sem escala",
    escalaTipo: first.escalaTipo || "fixa",
    escalaConfiguracao: first.escalaConfiguracao || null,
    escalaDataInicio: first.escalaDataInicio || first.dataInicioPonto || null,
    dataInicioPonto: first.dataInicioPonto || null,
    diasEscala,
  };
}

function buildEscalasSemanais(rows = []) {
  const byWeek = new Map();

  for (const row of rows) {
    const weekKey = `${row.semanaInicio}|${row.semanalId}`;
    if (!byWeek.has(weekKey)) {
      byWeek.set(weekKey, {
        semanalId: row.semanalId,
        semanaInicio: row.semanaInicio,
        semanaFim: row.semanaFim,
        escala: row.escalaNome || "Sem escala",
        escalaTipo: row.escalaTipo || "fixa",
        escalaConfiguracao: row.escalaConfiguracao || null,
        escalaDataInicio: row.semanaInicio,
        diasEscala: new Map(),
      });
    }

    if (row.diaSemana) {
      byWeek.get(weekKey).diasEscala.set(Number(row.diaSemana), Number(row.metaMinutos || 0));
    }
  }

  return [...byWeek.values()].sort((a, b) => a.semanaInicio.localeCompare(b.semanaInicio) || a.semanalId - b.semanalId);
}

function applyEscalaSemanal(funcionario, data) {
  const semanal = [...(funcionario.escalasSemanais || [])].reverse().find((item) => (
    item.semanaInicio <= data && item.semanaFim >= data
  ));

  return semanal ? { ...funcionario, ...semanal } : funcionario;
}

function groupPunches(punches) {
  const grouped = new Map();

  for (const punch of punches) {
    if (!grouped.has(punch.data)) {
      grouped.set(punch.data, {
        entrada1: null,
        saida1: null,
        entrada2: null,
        saida2: null,
        totalBatidas: 0,
      });
    }

    const row = grouped.get(punch.data);
    if (!row[punch.tipo]) {
      row[punch.tipo] = punch.hora;
      row.totalBatidas += 1;
    }
  }

  return grouped;
}

function buildRow({ funcionario, data, punches, adjustment, adjustmentHistory = [], feriado }) {
  const diaSemanaNumero = getDiaSemana(data);
  const escalaFuncionario = applyEscalaSemanal(funcionario, data);
  const escalaMinutosOriginal = resolveEscalaExpectedMinutes({
    tipo: escalaFuncionario.escalaTipo,
    configuracao: escalaFuncionario.escalaConfiguracao,
    dataInicio: escalaFuncionario.escalaDataInicio,
    dataInicioPonto: escalaFuncionario.dataInicioPonto,
    dias: escalaFuncionario.diasEscala,
  }, data);
  const original = punches.get(data) || {};
  const adjusted = Boolean(adjustment);
  const tipoAjuste = adjustment?.tipoAjuste || null;
  const originalValues = {
    originalEntrada1: original.entrada1 || null,
    originalSaida1: original.saida1 || null,
    originalEntrada2: original.entrada2 || null,
    originalSaida2: original.saida2 || null,
  };
  const activeHistoryItem = adjustment
    ? adjustmentHistory.find((item) => Number(item.id) === Number(adjustment.id))
    : null;
  const auditInfo = {
    ajusteNumero: activeHistoryItem?.numero || (adjustment ? adjustmentHistory.length : null),
    ajusteTotal: adjustmentHistory.length,
    ajustesHistorico: adjustmentHistory.map((item) => ({
      ...item,
      ...originalValues,
    })),
  };
  const escalaMinutos = tipoAjuste === "MARCAR_FOLGA"
    ? 0
    : tipoAjuste === "MARCAR_TRABALHO"
      ? Number(adjustment?.metaMinutosOverride || escalaMinutosOriginal || 480)
      : escalaMinutosOriginal;
  const adjustmentHasPunches = ["entrada1", "saida1", "entrada2", "saida2"].some((key) => adjustment?.[key]);
  const preserveOriginalPunches = tipoAjuste === "PAGO_EM_FOLHA"
    || ((tipoAjuste === "MARCAR_FOLGA" || tipoAjuste === "MARCAR_TRABALHO") && !adjustmentHasPunches);
  const values = adjusted && !preserveOriginalPunches
    ? {
      entrada1: adjustment.entrada1 || null,
      saida1: adjustment.saida1 || null,
      entrada2: adjustment.entrada2 || null,
      saida2: adjustment.saida2 || null,
    }
    : {
      entrada1: original.entrada1 || null,
      saida1: original.saida1 || null,
      entrada2: original.entrada2 || null,
      saida2: original.saida2 || null,
    };
  const totalBatidas = ["entrada1", "saida1", "entrada2", "saida2"].filter((key) => values[key]).length;
  const isFeriado = Boolean(feriado) || tipoAjuste === "MARCAR_FERIADO";
  const isFolga = tipoAjuste !== "MARCAR_TRABALHO" && (tipoAjuste === "MARCAR_FOLGA" || (!isFeriado && escalaMinutos <= 0));
  const tipoDia = isFeriado ? "Feriado" : isFolga ? "Folga" : "Trabalha";
  const esperadoMinutos = (isFeriado || isFolga || tipoAjuste === "ABONAR_DIA" || tipoAjuste === "FALTA_DESCONTADA") ? 0 : escalaMinutos;
  const trabalhadoMinutos = calculateWorkedMinutes(values);

  if (funcionario.dataInicioPonto && data < funcionario.dataInicioPonto) {
    return {
      data,
      diaSemana: DIA_NOMES[diaSemanaNumero],
      tipoDia,
      horarioPrevisto: "-",
      entrada1: values.entrada1,
      saida1: values.saida1,
      entrada2: values.entrada2,
      saida2: values.saida2,
      ...originalValues,
      horasPrevistas: formatMinutes(0),
      horasRealizadas: formatMinutes(trabalhadoMinutos),
      saldo: null,
      esperadoMinutos: 0,
      trabalhadoMinutos,
      saldoMinutos: null,
      status: null,
      pendente: false,
      ajustado: adjusted,
      ...auditInfo,
      tipoAjuste,
      metaMinutosOverride: adjustment?.metaMinutosOverride || null,
      motivo: adjustment?.motivo || null,
      observacao: adjustment?.observacao || null,
      ajusteCriadoPor: adjustment?.createdBy || null,
      ajusteCriadoEm: adjustment?.createdAt || null,
      feriado: feriado?.descricao || null,
    };
  }

  const isFuture = data > getLocalDateOnly();

  if (!adjusted && isFuture && totalBatidas === 0) {
    const status = isFeriado ? "FERIADO" : isFolga ? "FOLGA" : "A_TRABALHAR";

    return {
      data,
      diaSemana: DIA_NOMES[diaSemanaNumero],
      tipoDia,
      horarioPrevisto: esperadoMinutos > 0 ? formatMinutes(esperadoMinutos) : "-",
      entrada1: null,
      saida1: null,
      entrada2: null,
      saida2: null,
      ...originalValues,
      horasPrevistas: formatMinutes(esperadoMinutos),
      horasRealizadas: formatMinutes(0),
      saldo: null,
      esperadoMinutos,
      trabalhadoMinutos: 0,
      saldoMinutos: null,
      status,
      pendente: false,
      ajustado: false,
      ...auditInfo,
      tipoAjuste: null,
      metaMinutosOverride: null,
      motivo: null,
      observacao: null,
      ajusteCriadoPor: null,
      ajusteCriadoEm: null,
      feriado: feriado?.descricao || null,
    };
  }

  const saldoCalculadoMinutos = trabalhadoMinutos - esperadoMinutos;
  const saldoMinutos = (tipoAjuste === "ABONAR_DIA" || tipoAjuste === "FALTA_DESCONTADA" || tipoAjuste === "MARCAR_FERIADO")
    ? 0
    : tipoAjuste === "PAGO_EM_FOLHA"
      ? Math.min(saldoCalculadoMinutos, 0)
      : saldoCalculadoMinutos;
  let status = "TRABALHADO";
  let pendente = false;
  const isToday = data === getLocalDateOnly();
  const isInProgress = !tipoAjuste && esperadoMinutos > 0 && isToday && totalBatidas < TOTAL_BATIDAS_DIA;

  if (tipoAjuste === "JUSTIFICAR_FALTA") {
    status = "FALTA_JUSTIFICADA";
  } else if (tipoAjuste === "ABONAR_DIA") {
    status = "ATESTADO";
  } else if (tipoAjuste === "FALTA_DESCONTADA") {
    status = "FALTA_DESCONTADA";
  } else if (tipoAjuste === "PAGO_EM_FOLHA") {
    status = "PAGO_EM_FOLHA";
  } else if (tipoAjuste === "MARCAR_FERIADO") {
    status = "FERIADO_PAGO";
  } else if (isFeriado && totalBatidas === 0) {
    status = "FERIADO";
  } else if (isFolga && totalBatidas === 0) {
    status = "FOLGA";
  } else if (isFeriado && totalBatidas > 0) {
    status = "TRABALHO_EM_FERIADO";
  } else if (isFolga && totalBatidas > 0) {
    status = "TRABALHO_EM_FOLGA";
  } else if (isInProgress) {
    status = "EM_ANDAMENTO";
  } else if (esperadoMinutos > 0 && totalBatidas === 0) {
    status = "FALTA";
  } else if (totalBatidas % 2 !== 0) {
    status = "INCOMPLETO";
  }

  pendente = isClosedPendingDay(data, status);

  return {
    data,
    diaSemana: DIA_NOMES[diaSemanaNumero],
    tipoDia,
    horarioPrevisto: esperadoMinutos > 0 ? formatMinutes(esperadoMinutos) : "-",
    entrada1: values.entrada1,
    saida1: values.saida1,
    entrada2: values.entrada2,
    saida2: values.saida2,
    ...originalValues,
    horasPrevistas: formatMinutes(esperadoMinutos),
    horasRealizadas: formatMinutes(trabalhadoMinutos),
    saldo: isInProgress ? null : formatMinutes(saldoMinutos, { signed: true }),
    esperadoMinutos,
    trabalhadoMinutos,
    saldoMinutos: isInProgress ? null : saldoMinutos,
    status,
    pendente,
    ajustado: adjusted,
    ...auditInfo,
    tipoAjuste,
    metaMinutosOverride: adjustment?.metaMinutosOverride || null,
    motivo: adjustment?.motivo || null,
    observacao: adjustment?.observacao || null,
    ajusteCriadoPor: adjustment?.createdBy || null,
    ajusteCriadoEm: adjustment?.createdAt || null,
    feriado: feriado?.descricao || null,
  };
}

async function montarGrade({ funcionarioId, month }) {
  const range = parseMonth(month);
  const funcionarioRows = await findFuncionarioContextById(funcionarioId);
  const funcionario = buildFuncionario(funcionarioRows);

  if (!funcionario) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  const startDate = range.startDate;
  const [punchesRows, ajustesMap, ajustesHistoricoMap, feriadosRows, semanaisRows] = await Promise.all([
    listOriginalPunches({ matricula: funcionario.matricula, startDate, endDate: range.endDate }),
    listActiveAdjustments({ funcionarioId, startDate, endDate: range.endDate }),
    listAdjustmentsHistory({ funcionarioId, startDate, endDate: range.endDate }),
    listFeriadosByRange({ startDate, endDate: range.endDate }),
    listEscalasSemanaisByRange({ matricula: funcionario.matricula, startDate, endDate: range.endDate }),
  ]);
  funcionario.escalasSemanais = buildEscalasSemanais(semanaisRows);
  const punches = groupPunches(punchesRows);
  const feriadosMap = new Map(feriadosRows.map((feriado) => [feriado.data, feriado]));
  const dias = listDates(startDate, range.endDate).map((data) => buildRow({
    funcionario,
    data,
    punches,
    adjustment: ajustesMap.get(data),
    adjustmentHistory: ajustesHistoricoMap.get(data) || [],
    feriado: feriadosMap.get(data),
  }));

  return {
    funcionario: {
      id: funcionario.id,
      matricula: funcionario.matricula,
      nome: funcionario.nome,
      lojaId: funcionario.lojaId,
      loja: funcionario.loja,
      escalaId: funcionario.escalaId,
      escala: funcionario.escala,
    },
    mes: `${range.ano}-${String(range.mes).padStart(2, "0")}`,
    inicio: startDate,
    fim: range.endDate,
    resumo: {
      dias: dias.length,
      pendentes: dias.filter((dia) => dia.pendente).length,
      faltas: dias.filter((dia) => dia.status === "FALTA").length,
      incompletos: dias.filter((dia) => dia.status === "INCOMPLETO").length,
      ajustados: dias.filter((dia) => dia.ajustado).length,
      saldo: formatMinutes(dias.reduce((total, dia) => total + Number(dia.saldoMinutos || 0), 0), { signed: true }),
    },
    dias,
  };
}

function normalizePayload(payload = {}) {
  const tipoAjuste = String(payload.tipoAjuste || "").trim().toUpperCase();
  const motivo = String(payload.motivo || "").trim();
  const observacao = String(payload.observacao || "").trim();
  const metaMinutosOverride = parseMetaMinutosOverride(payload.metaMinutosOverride);

  if (!TIPOS_AJUSTE.has(tipoAjuste)) {
    throw createHttpError(400, "Tipo de ajuste obrigatorio ou invalido.");
  }

  if (!motivo) {
    throw createHttpError(400, "Motivo obrigatorio.");
  }

  if (tipoAjuste === "MARCAR_TRABALHO" && metaMinutosOverride === null) {
    throw createHttpError(400, "Informe as horas previstas para marcar trabalho.");
  }

  const times = {
    entrada1: normalizeTime(payload.entrada1),
    saida1: normalizeTime(payload.saida1),
    entrada2: normalizeTime(payload.entrada2),
    saida2: normalizeTime(payload.saida2),
  };

  for (const [field, value] of Object.entries(times)) {
    if (value === null) {
      throw createHttpError(400, `Horario invalido em ${field}. Use HH:mm.`);
    }
  }

  const filled = Object.values(times).filter(Boolean);
  if (!TIPOS_SEM_HORARIO.has(tipoAjuste) && filled.length === 0) {
    throw createHttpError(400, "Informe pelo menos uma batida para este tipo de ajuste.");
  }

  const normalizedTimes = tipoAjuste === "ALTERAR_BATIDA"
    ? times
    : { entrada1: "", saida1: "", entrada2: "", saida2: "" };

  const ordered = [normalizedTimes.entrada1, normalizedTimes.saida1, normalizedTimes.entrada2, normalizedTimes.saida2].filter(Boolean).map(timeToMinutes);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index] <= ordered[index - 1]) {
      throw createHttpError(400, "A ordem dos horarios deve ser entrada1 < saida1 < entrada2 < saida2.");
    }
  }

  return {
    ...normalizedTimes,
    tipoAjuste,
    metaMinutosOverride: tipoAjuste === "MARCAR_TRABALHO" ? metaMinutosOverride : null,
    motivo,
    observacao,
  };
}

async function listarAjustarPonto(user, query = {}) {
  requireAdmin(user);
  const funcionarioId = parseId(query.funcionarioId, "Funcionario");
  return montarGrade({ funcionarioId, month: query.mes });
}

async function salvarAjustePonto(user, params = {}, payload = {}) {
  requireAdmin(user);
  const funcionarioId = parseId(params.funcionarioId, "Funcionario");
  const data = parseDateOnly(params.data);
  if (!data) {
    throw createHttpError(400, "Data invalida.");
  }

  const funcionarioRows = await findFuncionarioContextById(funcionarioId);
  const funcionario = buildFuncionario(funcionarioRows);
  if (!funcionario) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  const activeAdjustment = await findActiveAdjustmentByDate({ funcionarioId, data });
  if (activeAdjustment && TIPOS_BLOQUEIAM_SOBREPOSICAO.has(activeAdjustment.tipoAjuste)) {
    const label = LABEL_TIPO_AJUSTE[activeAdjustment.tipoAjuste] || "Ajuste ativo";
    throw createHttpError(409, `${label} bloqueia novos ajustes nesta data. Desfaca esse ajuste antes de lancar outro.`);
  }

  const normalizedPayload = normalizePayload(payload);
  const currentGrade = await montarGrade({ funcionarioId, month: data.slice(0, 7) });
  const currentDay = currentGrade.dias.find((item) => item.data === data);
  if (currentDay?.status === "TRABALHADO" && normalizedPayload.tipoAjuste !== "ALTERAR_BATIDA") {
    throw createHttpError(400, "Dia trabalhado permite apenas alterar batidas.");
  }

  const adjustment = await saveAdjustment({
    funcionarioId,
    matricula: funcionario.matricula,
    data,
    payload: normalizedPayload,
    createdBy: user?.name || user?.matricula || "admin",
  });
  const month = data.slice(0, 7);
  const grade = await montarGrade({ funcionarioId, month });
  const dia = grade.dias.find((item) => item.data === data) || null;

  return {
    message: "Ajuste salvo com sucesso.",
    ajuste: adjustment,
    dia,
    resumo: grade.resumo,
  };
}

async function desfazerAjustePonto(user, params = {}) {
  requireAdmin(user);
  const funcionarioId = parseId(params.funcionarioId, "Funcionario");
  const ajusteId = params.ajusteId ? parseId(params.ajusteId, "Ajuste") : null;
  const data = parseDateOnly(params.data);
  if (!data) {
    throw createHttpError(400, "Data invalida.");
  }

  const funcionarioRows = await findFuncionarioContextById(funcionarioId);
  const funcionario = buildFuncionario(funcionarioRows);
  if (!funcionario) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  const result = await clearAdjustment({ funcionarioId, data, ajusteId });
  if (!result.changed) {
    if (result.mode === "not_latest") {
      throw createHttpError(400, "So e possivel desfazer o ultimo ajuste da lista. Desfaca na ordem 4, 3, 2, 1.");
    }
    throw createHttpError(404, "Ajuste nao encontrado para desfazer.");
  }

  const month = data.slice(0, 7);
  const grade = await montarGrade({ funcionarioId, month });
  const dia = grade.dias.find((item) => item.data === data) || null;

  return {
    message: "Ajuste desfeito com sucesso.",
    dia,
    resumo: grade.resumo,
  };
}

module.exports = {
  desfazerAjustePonto,
  listarAjustarPonto,
  salvarAjustePonto,
};
