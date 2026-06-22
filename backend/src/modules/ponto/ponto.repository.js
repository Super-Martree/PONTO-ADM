const { getPool, sql } = require("../../db/postgres");
const { ensureEscalasConfigColumn, ensureEscalasSemanaisSchema, ensureLocaisPermitidosSchema, ensurePontoLocationColumns } = require("../../db/schema");
const env = require("../../config/env");
const { sqlIdentifier } = require("../../utils/identifier");

const APP_TIME_ZONE = "America/Sao_Paulo";

function mapRegistro(row) {
  if (!row) return null;

  return {
    id: row.id,
    matricula: row.matricula,
    data_ponto: row.data_ponto,
    hora_ponto: row.hora_ponto,
    tipo: row.tipo,
    data_hora: row.data_hora,
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    accuracy_meters: row.accuracy_meters === null || row.accuracy_meters === undefined ? null : Number(row.accuracy_meters),
    location_captured_at: row.location_captured_at || null,
  };
}

function mapFeriado(row) {
  if (!row) return null;

  return {
    data: row.data,
    descricao: row.descricao,
  };
}

async function getTodayDate() {
  const pool = await getPool();
  const result = await pool.request().query("SELECT CONVERT(varchar(10), CAST(SYSDATETIME() AS date), 23) AS data");
  return result.recordset[0].data;
}

async function findLastPunch(matricula, startDate = null) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(20), matricula)
    .input("startDate", sql.Date, startDate)
    .query(`
      SELECT
        TOP (1)
        id,
        matricula,
        CONVERT(varchar(10), data_ponto, 23) AS data_ponto,
        CONVERT(varchar(5), hora_ponto, 108) AS hora_ponto,
        CONVERT(varchar(19), data_hora, 120) AS data_hora,
        tipo,
        DATEDIFF(second, data_hora, SYSDATETIME()) AS segundos_desde_ultima
      FROM app_ponto_registros
      WHERE matricula = @matricula
        AND data_ponto >= COALESCE(@startDate, CONVERT(date, '19000101'))
      ORDER BY data_hora DESC, id DESC
    `);

  return result.recordset[0] || null;
}

async function listTodayPunches(matricula, startDate = null) {
  await ensurePontoLocationColumns();
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(20), matricula)
    .input("startDate", sql.Date, startDate)
    .query(`
      SELECT
        id,
        matricula,
        CONVERT(varchar(10), data_ponto, 23) AS data_ponto,
        CONVERT(varchar(5), hora_ponto, 108) AS hora_ponto,
        CONVERT(varchar(19), data_hora, 120) AS data_hora,
        tipo,
        latitude,
        longitude,
        accuracy_meters,
        CONVERT(varchar(19), location_captured_at, 120) AS location_captured_at
      FROM app_ponto_registros
      WHERE matricula = @matricula
        AND data_ponto = CAST(SYSDATETIME() AS date)
        AND data_ponto >= COALESCE(@startDate, CONVERT(date, '19000101'))
      ORDER BY data_hora ASC, id ASC
    `);

  return result.recordset.map(mapRegistro);
}

async function listPunchesByRange({ matricula, startDate, endDate }) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(20), matricula)
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate)
    .query(`
      SELECT
        id,
        matricula,
        CONVERT(varchar(10), data_ponto, 23) AS data_ponto,
        CONVERT(varchar(5), hora_ponto, 108) AS hora_ponto,
        CONVERT(varchar(19), data_hora, 120) AS data_hora,
        tipo
      FROM app_ponto_registros
      WHERE matricula = @matricula
        AND data_ponto >= @startDate
        AND data_ponto <= @endDate
      ORDER BY data_ponto DESC, data_hora ASC, id ASC
    `);

  return result.recordset.map(mapRegistro);
}

async function getFuncionarioEscalaByMatricula(matricula) {
  await ensureEscalasConfigColumn();
  const table = sqlIdentifier(env.auth.table);
  const matriculaColumn = sqlIdentifier(env.auth.matriculaColumn);
  const nameColumn = sqlIdentifier(env.auth.nameColumn);
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(20), matricula)
    .query(`
      SELECT
        CAST(u.${matriculaColumn} AS varchar(20)) AS matricula,
        u.${nameColumn} AS nome,
        e.id AS [escalaId],
        e.nome AS [escalaNome],
        e.tipo AS [escalaTipo],
        e.configuracao_json AS [escalaConfiguracao],
        CONVERT(varchar(10), escala_hist.data_inicio, 23) AS [escalaDataInicio],
        CONVERT(varchar(10), u.[DataInicioPonto], 23) AS [dataInicioPonto],
        d.dia_semana AS [diaSemana],
        d.meta_minutos AS [metaMinutos]
      FROM ${table} u
      OUTER APPLY (
        SELECT TOP (1) h.escala_id, h.data_inicio
        FROM app_funcionario_escalas h
        WHERE h.matricula = CAST(u.${matriculaColumn} AS varchar(20))
          AND h.data_inicio <= CAST(SYSDATETIME() AS date)
        ORDER BY h.data_inicio DESC, h.id DESC
      ) escala_hist
      OUTER APPLY (
        SELECT TOP (1) CAST(1 AS bit) AS has_history
        FROM app_funcionario_escalas h
        WHERE h.matricula = CAST(u.${matriculaColumn} AS varchar(20))
      ) escala_historico
      LEFT JOIN app_escalas e ON e.id = CASE WHEN escala_historico.has_history = 1 THEN escala_hist.escala_id ELSE u.[EscalaId] END
      LEFT JOIN app_escala_dias d ON d.escala_id = e.id AND d.ativo = 1
      WHERE CAST(u.${matriculaColumn} AS varchar(20)) = @matricula
      ORDER BY d.dia_semana ASC
    `);

  return result.recordset;
}

async function listActiveAllowedPunchLocations() {
  await ensureLocaisPermitidosSchema();
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      id,
      nome,
      latitude,
      longitude,
      raio_metros AS [raioMetros]
    FROM app_ponto_locais_permitidos
    WHERE ativo = 1
    ORDER BY nome ASC, id ASC
  `);

  return result.recordset.map((row) => ({
    id: row.id,
    nome: row.nome,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    raioMetros: Number(row.raioMetros || 0),
  }));
}

async function insertPunch({ matricula, tipo, location }) {
  await ensurePontoLocationColumns();
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(20), matricula)
    .input("tipo", sql.VarChar(20), tipo)
    .input("latitude", sql.VarChar(30), location?.latitude ?? null)
    .input("longitude", sql.VarChar(30), location?.longitude ?? null)
    .input("accuracyMeters", sql.VarChar(30), location?.accuracyMeters ?? null)
    .input("capturedAt", sql.VarChar(30), location?.capturedAt ?? null)
    .query(`
      INSERT INTO app_ponto_registros (
        matricula,
        data_ponto,
        hora_ponto,
        data_hora,
        tipo,
        latitude,
        longitude,
        accuracy_meters,
        location_captured_at
      )
      OUTPUT
        inserted.id,
        inserted.matricula,
        CONVERT(varchar(10), inserted.data_ponto, 23) AS data_ponto,
        CONVERT(varchar(5), inserted.hora_ponto, 108) AS hora_ponto,
        CONVERT(varchar(19), inserted.data_hora, 120) AS data_hora,
        inserted.tipo,
        inserted.latitude,
        inserted.longitude,
        inserted.accuracy_meters,
        CONVERT(varchar(19), inserted.location_captured_at, 120) AS location_captured_at
      VALUES (
        @matricula,
        CAST(SYSDATETIME() AS date),
        CAST(SYSDATETIME() AS time(0)),
        CAST(SYSDATETIME() AS datetime2(0)),
        @tipo,
        @latitude,
        @longitude,
        @accuracyMeters,
        COALESCE(TRY_CONVERT(datetime2(0), @capturedAt, 127), CAST(SYSDATETIME() AS datetime2(0)))
      )
    `);

  return mapRegistro(result.recordset[0]);
}

async function listFeriadosByRange({ startDate, endDate }) {
  const pool = await getPool();
  const exists = await pool.request().query("SELECT CASE WHEN OBJECT_ID('dbo.app_feriados', 'U') IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS [exists]");

  if (!exists.recordset[0]?.exists) {
    return [];
  }

  const result = await pool.request()
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate)
    .query(`
      SELECT
        CONVERT(varchar(10), data_feriado, 23) AS data,
        descricao
      FROM app_feriados
      WHERE ativo = 1
        AND data_feriado >= @startDate
        AND data_feriado <= @endDate
      ORDER BY data_feriado ASC
    `);

  return result.recordset.map(mapFeriado);
}

async function isFeriado(date) {
  const feriados = await listFeriadosByRange({ startDate: date, endDate: date });
  return feriados.length > 0;
}

async function listAdminTodayApuracao(apuracaoDate) {
  await ensureEscalasConfigColumn();
  const table = sqlIdentifier(env.auth.table);
  const matriculaColumn = sqlIdentifier(env.auth.matriculaColumn);
  const nameColumn = sqlIdentifier(env.auth.nameColumn);
  const roleColumn = sqlIdentifier(env.auth.roleColumn);
  const activeColumn = sqlIdentifier(env.auth.activeColumn);
  const pool = await getPool();

  const result = await pool.request()
    .input("apuracaoDate", sql.Date, apuracaoDate)
    .query(`
      SELECT
        CONVERT(varchar(10), @apuracaoDate, 23) AS data,
        CAST(u.${matriculaColumn} AS varchar(20)) AS matricula,
        u.${nameColumn} AS nome,
        l.nome AS loja,
        e.id AS [escalaId],
        e.nome AS [escalaNome],
        e.tipo AS [escalaTipo],
        e.configuracao_json AS [escalaConfiguracao],
        CONVERT(varchar(10), escala_hist.data_inicio, 23) AS [escalaDataInicio],
        MAX(CONVERT(varchar(10), u.[DataInicioPonto], 23)) AS [dataInicioPonto],
        ed.meta_minutos AS [esperadoMinutos],
        MAX(CASE WHEN p.tipo = 'entrada1' THEN CONVERT(varchar(5), p.hora_ponto, 108) END) AS entrada1,
        MAX(CASE WHEN p.tipo = 'saida1' THEN CONVERT(varchar(5), p.hora_ponto, 108) END) AS saida1,
        MAX(CASE WHEN p.tipo = 'entrada2' THEN CONVERT(varchar(5), p.hora_ponto, 108) END) AS entrada2,
        MAX(CASE WHEN p.tipo = 'saida2' THEN CONVERT(varchar(5), p.hora_ponto, 108) END) AS saida2,
        COUNT(p.id) AS [totalBatidas]
      FROM ${table} u
      LEFT JOIN app_lojas l ON l.id = u.[LojaId]
      OUTER APPLY (
        SELECT TOP (1) h.escala_id, h.data_inicio
        FROM app_funcionario_escalas h
        WHERE h.matricula = CAST(u.${matriculaColumn} AS varchar(20))
          AND h.data_inicio <= @apuracaoDate
        ORDER BY h.data_inicio DESC, h.id DESC
      ) escala_hist
      OUTER APPLY (
        SELECT TOP (1) CAST(1 AS bit) AS has_history
        FROM app_funcionario_escalas h
        WHERE h.matricula = CAST(u.${matriculaColumn} AS varchar(20))
      ) escala_historico
      LEFT JOIN app_escalas e ON e.id = CASE WHEN escala_historico.has_history = 1 THEN escala_hist.escala_id ELSE u.[EscalaId] END
      LEFT JOIN app_escala_dias ed
        ON ed.escala_id = e.id
        AND ed.ativo = 1
        AND ed.dia_semana = ((DATEPART(weekday, @apuracaoDate) + @@DATEFIRST + 5) % 7) + 1
      LEFT JOIN app_ponto_registros p
        ON p.matricula = CAST(u.${matriculaColumn} AS varchar(20))
        AND p.data_ponto = @apuracaoDate
      WHERE u.${activeColumn} = 1
        AND LOWER(CAST(u.${roleColumn} AS varchar(50))) NOT IN ('admin', 'administrador', 'gestor')
        AND @apuracaoDate >= COALESCE(CAST(u.[DataInicioPonto] AS date), CONVERT(date, '19000101'))
      GROUP BY u.${matriculaColumn}, u.${nameColumn}, l.nome, e.id, e.nome, e.tipo, e.configuracao_json, escala_hist.data_inicio, ed.meta_minutos
      ORDER BY u.${nameColumn}, u.${matriculaColumn}
    `);

  return result.recordset;
}

async function listAdminMonthlyPunches({ matricula, startDate, endDate }) {
  await ensureEscalasConfigColumn();
  const table = sqlIdentifier(env.auth.table);
  const matriculaColumn = sqlIdentifier(env.auth.matriculaColumn);
  const nameColumn = sqlIdentifier(env.auth.nameColumn);
  const roleColumn = sqlIdentifier(env.auth.roleColumn);
  const activeColumn = sqlIdentifier(env.auth.activeColumn);
  const pool = await getPool();
  const request = pool.request()
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate);

  const employeeFilter = matricula
    ? `AND CAST(u.${matriculaColumn} AS varchar(20)) = @matricula`
    : "";

  if (matricula) {
    request.input("matricula", sql.VarChar(20), matricula);
  }

  const result = await request.query(`
    SELECT
      CAST(u.${matriculaColumn} AS varchar(20)) AS matricula,
      u.${nameColumn} AS nome,
      l.nome AS loja,
      e.id AS [escalaId],
      e.nome AS [escalaNome],
      e.tipo AS [escalaTipo],
      e.configuracao_json AS [escalaConfiguracao],
      CONVERT(varchar(10), h.data_inicio, 23) AS [escalaDataInicio],
      CONVERT(varchar(10), u.[DataInicioPonto], 23) AS [dataInicioPonto],
      ed.dia_semana AS [diaSemana],
      ed.meta_minutos AS [metaMinutos],
      CONVERT(varchar(10), p.data_ponto, 23) AS data_ponto,
      CONVERT(varchar(5), p.hora_ponto, 108) AS hora_ponto,
      p.tipo
    FROM ${table} u
    LEFT JOIN app_lojas l ON l.id = u.[LojaId]
    OUTER APPLY (
      SELECT TOP (1) fh.escala_id, fh.data_inicio
      FROM app_funcionario_escalas fh
      WHERE fh.matricula = CAST(u.${matriculaColumn} AS varchar(20))
        AND fh.data_inicio <= @endDate
      ORDER BY fh.data_inicio DESC, fh.id DESC
    ) h
    OUTER APPLY (
      SELECT TOP (1) CAST(1 AS bit) AS has_history
      FROM app_funcionario_escalas fh
      WHERE fh.matricula = CAST(u.${matriculaColumn} AS varchar(20))
    ) escala_historico
    LEFT JOIN app_escalas e ON e.id = CASE WHEN escala_historico.has_history = 1 THEN h.escala_id ELSE u.[EscalaId] END
    LEFT JOIN app_escala_dias ed ON ed.escala_id = e.id AND ed.ativo = 1
    LEFT JOIN app_ponto_registros p
      ON p.matricula = CAST(u.${matriculaColumn} AS varchar(20))
      AND p.data_ponto >= @startDate
      AND p.data_ponto <= @endDate
      AND (u.[DataInicioPonto] IS NULL OR p.data_ponto >= u.[DataInicioPonto])
    WHERE u.${activeColumn} = 1
      AND LOWER(CAST(u.${roleColumn} AS varchar(50))) NOT IN ('admin', 'administrador', 'gestor')
      ${employeeFilter}
    ORDER BY u.${nameColumn}, u.${matriculaColumn}, p.data_ponto, p.data_hora, p.id, ed.dia_semana
  `);

  return result.recordset;
}

async function listEscalasSemanaisByRange({ matricula, startDate, endDate }) {
  await Promise.all([ensureEscalasConfigColumn(), ensureEscalasSemanaisSchema()]);
  const pool = await getPool();
  const request = pool.request()
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate);
  const employeeFilter = matricula ? "AND s.matricula = @matricula" : "";

  if (matricula) {
    request.input("matricula", sql.VarChar(20), matricula);
  }

  const result = await request.query(`
    SELECT
      s.matricula,
      s.id AS [semanalId],
      CONVERT(varchar(10), s.semana_inicio, 23) AS [semanaInicio],
      CONVERT(varchar(10), s.semana_fim, 23) AS [semanaFim],
      e.id AS [escalaId],
      e.nome AS [escalaNome],
      e.tipo AS [escalaTipo],
      e.configuracao_json AS [escalaConfiguracao],
      d.dia_semana AS [diaSemana],
      d.meta_minutos AS [metaMinutos]
    FROM app_funcionario_escalas_semanais s
    INNER JOIN app_escalas e ON e.id = s.escala_id AND e.ativo = 1
    LEFT JOIN app_escala_dias d ON d.escala_id = e.id AND d.ativo = 1
    WHERE s.semana_inicio <= @endDate
      AND s.semana_fim >= @startDate
      ${employeeFilter}
    ORDER BY s.matricula, s.semana_inicio ASC, s.id ASC, d.dia_semana ASC
  `);

  return result.recordset;
}

async function listAdminApuracaoRange({ startDate, endDate }) {
  return listAdminMonthlyPunches({ matricula: "", startDate, endDate });
}

async function listLatestPunches(limit = 6) {
  const table = sqlIdentifier(env.auth.table);
  const matriculaColumn = sqlIdentifier(env.auth.matriculaColumn);
  const nameColumn = sqlIdentifier(env.auth.nameColumn);
  const roleColumn = sqlIdentifier(env.auth.roleColumn);
  const pool = await getPool();

  const result = await pool.request()
    .input("limit", sql.Int, limit)
    .query(`
      SELECT
        TOP (@limit)
        p.matricula,
        u.${nameColumn} AS nome,
        CONVERT(varchar(10), p.data_ponto, 23) AS data_ponto,
        CONVERT(varchar(5), p.hora_ponto, 108) AS hora_ponto,
        p.tipo
      FROM app_ponto_registros p
      INNER JOIN ${table} u
        ON CAST(u.${matriculaColumn} AS varchar(20)) = p.matricula
      WHERE LOWER(CAST(u.${roleColumn} AS varchar(50))) NOT IN ('admin', 'administrador', 'gestor')
        AND (u.[DataInicioPonto] IS NULL OR p.data_ponto >= u.[DataInicioPonto])
      ORDER BY p.data_hora DESC, p.id DESC
    `);

  return result.recordset;
}

module.exports = {
  findLastPunch,
  getFuncionarioEscalaByMatricula,
  getTodayDate,
  insertPunch,
  isFeriado,
  listEscalasSemanaisByRange,
  listActiveAllowedPunchLocations,
  listAdminApuracaoRange,
  listAdminTodayApuracao,
  listFeriadosByRange,
  listAdminMonthlyPunches,
  listLatestPunches,
  listPunchesByRange,
  listTodayPunches,
};
