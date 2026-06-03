const { getPool, sql } = require("../../db/postgres");
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
  };
}

function mapFeriado(row) {
  if (!row) return null;

  return {
    data: row.data,
    descricao: row.descricao,
  };
}

async function ensureEscalasConfigColumn() {
  const pool = await getPool();
  await pool.request().query(`
    ALTER TABLE app_escalas ADD COLUMN IF NOT EXISTS configuracao_json text NULL
  `);
}

async function getTodayDate() {
  const pool = await getPool();
  const result = await pool.request().query(`SELECT to_char((now() AT TIME ZONE '${APP_TIME_ZONE}')::date, 'YYYY-MM-DD') AS data`);
  return result.recordset[0].data;
}

async function findLastPunch(matricula, startDate = null) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(20), matricula)
    .input("startDate", sql.Date, startDate)
    .query(`
      SELECT
        id,
        matricula,
        to_char(data_ponto, 'YYYY-MM-DD') AS data_ponto,
        to_char(hora_ponto, 'HH24:MI') AS hora_ponto,
        to_char(data_hora, 'YYYY-MM-DD HH24:MI:SS') AS data_hora,
        tipo,
        FLOOR(EXTRACT(EPOCH FROM ((now() AT TIME ZONE '${APP_TIME_ZONE}') - data_hora)))::int AS segundos_desde_ultima
      FROM app_ponto_registros
      WHERE matricula = @matricula
        AND data_ponto >= COALESCE(@startDate::date, DATE '1900-01-01')
      ORDER BY data_hora DESC, id DESC
      LIMIT 1
    `);

  return result.recordset[0] || null;
}

async function listTodayPunches(matricula, startDate = null) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(20), matricula)
    .input("startDate", sql.Date, startDate)
    .query(`
      SELECT
        id,
        matricula,
        to_char(data_ponto, 'YYYY-MM-DD') AS data_ponto,
        to_char(hora_ponto, 'HH24:MI') AS hora_ponto,
        to_char(data_hora, 'YYYY-MM-DD HH24:MI:SS') AS data_hora,
        tipo
      FROM app_ponto_registros
      WHERE matricula = @matricula
        AND data_ponto = (now() AT TIME ZONE '${APP_TIME_ZONE}')::date
        AND data_ponto >= COALESCE(@startDate::date, DATE '1900-01-01')
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
        to_char(data_ponto, 'YYYY-MM-DD') AS data_ponto,
        to_char(hora_ponto, 'HH24:MI') AS hora_ponto,
        to_char(data_hora, 'YYYY-MM-DD HH24:MI:SS') AS data_hora,
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
        e.id AS "escalaId",
        e.nome AS "escalaNome",
        e.tipo AS "escalaTipo",
        e.configuracao_json AS "escalaConfiguracao",
        to_char(escala_hist.data_inicio, 'YYYY-MM-DD') AS "escalaDataInicio",
        to_char(u."DataInicioPonto", 'YYYY-MM-DD') AS "dataInicioPonto",
        d.dia_semana AS "diaSemana",
        d.meta_minutos AS "metaMinutos"
      FROM ${table} u
      LEFT JOIN LATERAL (
        SELECT h.escala_id, h.data_inicio
        FROM app_funcionario_escalas h
        WHERE h.matricula = CAST(u.${matriculaColumn} AS varchar(20))
          AND h.data_inicio <= (now() AT TIME ZONE '${APP_TIME_ZONE}')::date
        ORDER BY h.data_inicio DESC, h.id DESC
        LIMIT 1
      ) escala_hist ON true
      LEFT JOIN app_escalas e ON e.id = COALESCE(escala_hist.escala_id, u."EscalaId")
      LEFT JOIN app_escala_dias d ON d.escala_id = e.id AND d.ativo = true
      WHERE CAST(u.${matriculaColumn} AS varchar(20)) = @matricula
      ORDER BY d.dia_semana ASC
    `);

  return result.recordset;
}

async function insertPunch({ matricula, tipo }) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(20), matricula)
    .input("tipo", sql.VarChar(20), tipo)
    .query(`
      INSERT INTO app_ponto_registros (matricula, data_ponto, hora_ponto, data_hora, tipo)
      VALUES (
        @matricula,
        (now() AT TIME ZONE '${APP_TIME_ZONE}')::date,
        (now() AT TIME ZONE '${APP_TIME_ZONE}')::time(0),
        (now() AT TIME ZONE '${APP_TIME_ZONE}')::timestamp(0),
        @tipo
      )
      RETURNING
        id,
        matricula,
        to_char(data_ponto, 'YYYY-MM-DD') AS data_ponto,
        to_char(hora_ponto, 'HH24:MI') AS hora_ponto,
        to_char(data_hora, 'YYYY-MM-DD HH24:MI:SS') AS data_hora,
        tipo
    `);

  return mapRegistro(result.recordset[0]);
}

async function listFeriadosByRange({ startDate, endDate }) {
  const pool = await getPool();
  const exists = await pool.request().query("SELECT to_regclass('public.app_feriados') IS NOT NULL AS \"exists\"");

  if (!exists.recordset[0]?.exists) {
    return [];
  }

  const result = await pool.request()
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate)
    .query(`
      SELECT
        to_char(data_feriado, 'YYYY-MM-DD') AS data,
        descricao
      FROM app_feriados
      WHERE ativo = true
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
        to_char(@apuracaoDate::date, 'YYYY-MM-DD') AS data,
        CAST(u.${matriculaColumn} AS varchar(20)) AS matricula,
        u.${nameColumn} AS nome,
        l.nome AS loja,
        e.id AS "escalaId",
        e.nome AS "escalaNome",
        e.tipo AS "escalaTipo",
        e.configuracao_json AS "escalaConfiguracao",
        to_char(escala_hist.data_inicio, 'YYYY-MM-DD') AS "escalaDataInicio",
        MAX(to_char(u."DataInicioPonto", 'YYYY-MM-DD')) AS "dataInicioPonto",
        ed.meta_minutos AS "esperadoMinutos",
        MAX(CASE WHEN p.tipo = 'entrada1' THEN to_char(p.hora_ponto, 'HH24:MI') END) AS entrada1,
        MAX(CASE WHEN p.tipo = 'saida1' THEN to_char(p.hora_ponto, 'HH24:MI') END) AS saida1,
        MAX(CASE WHEN p.tipo = 'entrada2' THEN to_char(p.hora_ponto, 'HH24:MI') END) AS entrada2,
        MAX(CASE WHEN p.tipo = 'saida2' THEN to_char(p.hora_ponto, 'HH24:MI') END) AS saida2,
        COUNT(p.id)::int AS "totalBatidas"
      FROM ${table} u
      LEFT JOIN app_lojas l ON l.id = u."LojaId"
      LEFT JOIN LATERAL (
        SELECT h.escala_id, h.data_inicio
        FROM app_funcionario_escalas h
        WHERE h.matricula = CAST(u.${matriculaColumn} AS varchar(20))
          AND h.data_inicio <= @apuracaoDate
        ORDER BY h.data_inicio DESC, h.id DESC
        LIMIT 1
      ) escala_hist ON true
      LEFT JOIN app_escalas e ON e.id = COALESCE(escala_hist.escala_id, u."EscalaId")
      LEFT JOIN app_escala_dias ed
        ON ed.escala_id = e.id
        AND ed.ativo = true
        AND ed.dia_semana = EXTRACT(ISODOW FROM @apuracaoDate::date)
      LEFT JOIN app_ponto_registros p
        ON p.matricula = CAST(u.${matriculaColumn} AS varchar(20))
        AND p.data_ponto = @apuracaoDate
      WHERE u.${activeColumn} = true
        AND LOWER(CAST(u.${roleColumn} AS varchar(50))) NOT IN ('admin', 'administrador', 'gestor')
        AND @apuracaoDate >= COALESCE(u."DataInicioPonto"::date, DATE '1900-01-01')
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
      e.id AS "escalaId",
      e.nome AS "escalaNome",
      e.tipo AS "escalaTipo",
      e.configuracao_json AS "escalaConfiguracao",
      to_char(h.data_inicio, 'YYYY-MM-DD') AS "escalaDataInicio",
      to_char(u."DataInicioPonto", 'YYYY-MM-DD') AS "dataInicioPonto",
      ed.dia_semana AS "diaSemana",
      ed.meta_minutos AS "metaMinutos",
      to_char(p.data_ponto, 'YYYY-MM-DD') AS data_ponto,
      to_char(p.hora_ponto, 'HH24:MI') AS hora_ponto,
      p.tipo
    FROM ${table} u
    LEFT JOIN app_lojas l ON l.id = u."LojaId"
    LEFT JOIN LATERAL (
      SELECT fh.escala_id, fh.data_inicio
      FROM app_funcionario_escalas fh
      WHERE fh.matricula = CAST(u.${matriculaColumn} AS varchar(20))
        AND fh.data_inicio <= @endDate
      ORDER BY fh.data_inicio DESC, fh.id DESC
      LIMIT 1
    ) h ON true
    LEFT JOIN app_escalas e ON e.id = COALESCE(h.escala_id, u."EscalaId")
    LEFT JOIN app_escala_dias ed ON ed.escala_id = e.id AND ed.ativo = true
    LEFT JOIN app_ponto_registros p
      ON p.matricula = CAST(u.${matriculaColumn} AS varchar(20))
      AND p.data_ponto >= @startDate
      AND p.data_ponto <= @endDate
      AND (u."DataInicioPonto" IS NULL OR p.data_ponto >= u."DataInicioPonto")
    WHERE u.${activeColumn} = true
      AND LOWER(CAST(u.${roleColumn} AS varchar(50))) NOT IN ('admin', 'administrador', 'gestor')
      ${employeeFilter}
    ORDER BY u.${nameColumn}, u.${matriculaColumn}, p.data_ponto, p.data_hora, p.id, ed.dia_semana
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
        p.matricula,
        u.${nameColumn} AS nome,
        to_char(p.data_ponto, 'YYYY-MM-DD') AS data_ponto,
        to_char(p.hora_ponto, 'HH24:MI') AS hora_ponto,
        p.tipo
      FROM app_ponto_registros p
      INNER JOIN ${table} u
        ON CAST(u.${matriculaColumn} AS varchar(20)) = p.matricula
      WHERE LOWER(CAST(u.${roleColumn} AS varchar(50))) NOT IN ('admin', 'administrador', 'gestor')
        AND (u."DataInicioPonto" IS NULL OR p.data_ponto >= u."DataInicioPonto")
      ORDER BY p.data_hora DESC, p.id DESC
      LIMIT @limit
    `);

  return result.recordset;
}

module.exports = {
  findLastPunch,
  getFuncionarioEscalaByMatricula,
  getTodayDate,
  insertPunch,
  isFeriado,
  listAdminApuracaoRange,
  listAdminTodayApuracao,
  listFeriadosByRange,
  listAdminMonthlyPunches,
  listLatestPunches,
  listPunchesByRange,
  listTodayPunches,
};
