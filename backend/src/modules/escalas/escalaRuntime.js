const DIAS_KEYS = {
  1: "segunda",
  2: "terca",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sabado",
  7: "domingo",
};

function parseConfiguracao(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getDiaSemana(dateText) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function diffDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function hoursToMinutes(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.round(number * 60);
}

function resolveEscalaExpectedMinutes(escalaInfo = {}, dateText) {
  const tipo = escalaInfo.tipo || "fixa";
  const config = parseConfiguracao(escalaInfo.configuracao || escalaInfo.configuracaoJson);
  const diaSemana = getDiaSemana(dateText);
  const diaKey = DIAS_KEYS[diaSemana];

  if (!config) {
    return escalaInfo.dias?.get(diaSemana) ?? 0;
  }

  if (tipo === "fixa") {
    return Array.isArray(config.diasAtivos) && config.diasAtivos.includes(diaKey)
      ? hoursToMinutes(config.horasPorDia)
      : 0;
  }

  if (tipo === "flexivel") {
    const value = config.dias?.[diaKey];
    return value === null || value === undefined ? 0 : hoursToMinutes(value);
  }

  if (tipo === "ciclo") {
    const semanas = Array.isArray(config.semanas) && config.semanas.length ? config.semanas : [];
    if (!semanas.length) return escalaInfo.dias?.get(diaSemana) ?? 0;

    const anchor = escalaInfo.dataInicio || escalaInfo.dataInicioPonto || "1900-01-01";
    const weekIndex = Math.max(0, Math.floor(diffDays(anchor, dateText) / 7)) % semanas.length;
    const value = semanas[weekIndex]?.dias?.[diaKey];
    return value === null || value === undefined ? 0 : hoursToMinutes(value);
  }

  return escalaInfo.dias?.get(diaSemana) ?? 0;
}

module.exports = {
  resolveEscalaExpectedMinutes,
};
