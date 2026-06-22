const { findFuncionarioById, listFuncionarios } = require("../funcionarios/funcionarios.repository");
const { getAdminResumoFuncionarios } = require("../ponto/ponto.service");
const { createManualEntry, listManualEntries } = require("./bancoHoras.repository");

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

function formatMinutes(totalMinutes, { signed = true } = {}) {
  const value = Number(totalMinutes || 0);
  const sign = value < 0 ? "-" : signed ? "+" : "";
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseMonth(query = {}) {
  const today = new Date();
  const ano = Number(query.ano || today.getFullYear());
  const mes = Number(query.mes || (today.getMonth() + 1));

  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw createHttpError(400, "Mes ou ano invalido.");
  }

  return { ano, mes };
}

function parseDateOnly(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : text;
}

function normalizeManualPayload(payload = {}) {
  const funcionarioId = Number(payload.funcionarioId);
  if (!Number.isInteger(funcionarioId) || funcionarioId <= 0) {
    throw createHttpError(400, "Funcionario invalido.");
  }

  const data = parseDateOnly(payload.data);
  if (!data) {
    throw createHttpError(400, "Data invalida.");
  }

  const quantidade = Number(payload.minutos);
  if (!Number.isInteger(quantidade) || quantidade <= 0 || quantidade > 1440) {
    throw createHttpError(400, "Informe uma quantidade de minutos entre 1 e 1440.");
  }

  const tipo = String(payload.tipo || "").toLowerCase();
  if (tipo !== "credito" && tipo !== "debito") {
    throw createHttpError(400, "Tipo deve ser credito ou debito.");
  }

  const descricao = String(payload.descricao || "").trim();
  if (!descricao || descricao.length > 250) {
    throw createHttpError(400, "Informe uma descricao com ate 250 caracteres.");
  }

  return {
    funcionarioId,
    data,
    minutos: tipo === "debito" ? -quantidade : quantidade,
    descricao,
  };
}

function manualByMatricula(entries = []) {
  const map = new Map();

  for (const entry of entries) {
    const matricula = String(entry.matricula || "");
    if (!map.has(matricula)) {
      map.set(matricula, []);
    }
    map.get(matricula).push({
      ...entry,
      origem: "manual",
      saldo: formatMinutes(entry.minutos),
    });
  }

  return map;
}

async function listarBancoHoras(user, query = {}) {
  const isAdmin = user?.role === "admin";
  const matriculaConsulta = isAdmin ? String(query.matricula || "") : String(user?.matricula || "");

  if (!isAdmin && !matriculaConsulta) {
    throw createHttpError(403, "Funcionario sem matricula autenticada.");
  }

  const { ano, mes } = parseMonth(query);
  const resumo = await getAdminResumoFuncionarios({ role: "admin" }, { ano, mes });
  const [manualEntries, manualEntriesGeral, todosFuncionarios] = await Promise.all([
    listManualEntries({
      startDate: resumo.inicio,
      endDate: resumo.fim,
      matricula: matriculaConsulta,
    }),
    listManualEntries({
      startDate: "1900-01-01",
      endDate: resumo.fim,
      matricula: matriculaConsulta,
    }),
    listFuncionarios(),
  ]);
  const manuais = manualByMatricula(manualEntries);
  const manuaisGeral = manualByMatricula(manualEntriesGeral);
  const filtroMatricula = matriculaConsulta;
  const resumoMap = new Map(resumo.funcionarios.map((funcionario) => [String(funcionario.matricula), funcionario]));
  const baseFuncionarios = todosFuncionarios
    .filter((funcionario) => funcionario.ativo)
    .filter((funcionario) => !filtroMatricula || String(funcionario.matricula) === filtroMatricula)
    .map((funcionario) => resumoMap.get(String(funcionario.matricula)) || {
      matricula: funcionario.matricula,
      nome: funcionario.nome,
      loja: funcionario.lojaNome || "Sem loja",
      escala: funcionario.escalaNome || "Sem escala",
      resumo: {},
      geral: {},
      dias: [],
    });

  const funcionarios = baseFuncionarios
    .map((funcionario) => {
      const entradasManuais = manuais.get(String(funcionario.matricula)) || [];
      const entradasManuaisGeral = manuaisGeral.get(String(funcionario.matricula)) || [];
      const dias = (funcionario.dias || [])
        .filter((dia) => dia.saldoMinutos !== null && Number(dia.saldoMinutos || 0) !== 0)
        .map((dia) => ({
          origem: "ponto",
          data: dia.data,
          diaSemana: dia.diaSemana,
          minutos: Number(dia.saldoMinutos || 0),
          saldo: dia.saldo || formatMinutes(dia.saldoMinutos),
          descricao: dia.status || "Saldo do ponto",
        }));
      const manualMinutos = entradasManuais.reduce((total, entry) => total + Number(entry.minutos || 0), 0);
      const manualGeralMinutos = entradasManuaisGeral.reduce((total, entry) => total + Number(entry.minutos || 0), 0);
      const pontoMinutos = dias.reduce((total, dia) => total + Number(dia.minutos || 0), 0);
      const saldoPeriodoMinutos = pontoMinutos + manualMinutos;
      const saldoGeralMinutos = Number(funcionario.geral?.saldoMinutos || 0) + manualGeralMinutos;

      return {
        matricula: funcionario.matricula,
        nome: funcionario.nome,
        loja: funcionario.loja,
        escala: funcionario.escala,
        saldoPontoMinutos: pontoMinutos,
        saldoManualMinutos: manualMinutos,
        saldoPeriodoMinutos,
        saldoGeralMinutos,
        saldoPonto: formatMinutes(pontoMinutos),
        saldoManual: formatMinutes(manualMinutos),
        saldoPeriodo: formatMinutes(saldoPeriodoMinutos),
        saldoGeral: formatMinutes(saldoGeralMinutos),
        movimentos: [...dias, ...entradasManuais].sort((a, b) => b.data.localeCompare(a.data)),
      };
    });

  return {
    ano,
    mes,
    inicio: resumo.inicio,
    fim: resumo.fim,
    resumo: {
      funcionarios: funcionarios.length,
      saldoPeriodoMinutos: funcionarios.reduce((total, item) => total + item.saldoPeriodoMinutos, 0),
      saldoManualMinutos: funcionarios.reduce((total, item) => total + item.saldoManualMinutos, 0),
    },
    funcionarios,
  };
}

async function criarLancamentoManual(user, payload = {}) {
  requireAdmin(user);
  const data = normalizeManualPayload(payload);
  const funcionario = await findFuncionarioById(data.funcionarioId);

  if (!funcionario) {
    throw createHttpError(404, "Funcionario nao encontrado.");
  }

  const lancamento = await createManualEntry({
    ...data,
    matricula: funcionario.matricula,
    criadoPorMatricula: user?.matricula || null,
    criadoPorNome: user?.name || user?.matricula || "Administrador",
  });

  return { lancamento };
}

module.exports = {
  criarLancamentoManual,
  listarBancoHoras,
};
