const { getPool, sql } = require("../../db/postgres");
const env = require("../../config/env");
const { sqlIdentifier } = require("../../utils/identifier");

async function ensureAjustesSchema({ required = false } = {}) {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT to_regclass('public.app_ponto_ajustes') IS NOT NULL AS "existsTable"
  `);
  const existsTable = Boolean(result.recordset[0]?.existsTable);

  if (!existsTable && required) {
    const error = new Error("Tabela de ajustes de ponto nao encontrada. Execute backend/docs/supabase-schema.sql no Supabase.");
    error.status = 503;
    throw error;
  }

  return existsTable;
}

async function getAjustesCapabilities() {
  const existsTable = await ensureAjustesSchema();
  if (!existsTable) {
    return {
      existsTable: false,
      hasMetaOverride: false,
      supportsEscalaOverride: false,
    };
  }

  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'app_ponto_ajustes'
          AND column_name = 'meta_minutos_override'
      ) AS "hasMetaOverride",
      COALESCE((
        SELECT pg_get_constraintdef(c.oid) LIKE '%MARCAR_TRABALHO%'
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND t.relname = 'app_ponto_ajustes'
          AND c.conname = 'ck_app_ponto_ajustes_tipo'
        LIMIT 1
      ), true) AS "supportsEscalaOverride"
  `);

  return {
    existsTable: true,
    hasMetaOverride: Boolean(result.recordset[0]?.hasMetaOverride),
    supportsEscalaOverride: Boolean(result.recordset[0]?.supportsEscalaOverride),
  };
}

function mapAjuste(row) {
  if (!row) return null;

  return {
    id: row.id,
    funcionarioId: row.funcionarioId,
    matricula: row.matricula,
    data: row.data,
    entrada1: row.entrada1,
    saida1: row.saida1,
    entrada2: row.entrada2,
    saida2: row.saida2,
    tipoAjuste: row.tipoAjuste,
    metaMinutosOverride: row.metaMinutosOverride,
    motivo: row.motivo,
    observacao: row.observacao,
    ativo: Boolean(row.ativo),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

async function ensureEscalasConfigColumn() {
  const pool = await getPool();
  await pool.request().query(`
    ALTER TABLE app_escalas ADD COLUMN IF NOT EXISTS configuracao_json text NULL
  `);
}

async function findFuncionarioContextById(funcionarioId) {
  await ensureEscalasConfigColumn();
  const table = sqlIdentifier(env.auth.table);
  const matriculaColumn = sqlIdentifier(env.auth.matriculaColumn);
  const nameColumn = sqlIdentifier(env.auth.nameColumn);
  const roleColumn = sqlIdentifier(env.auth.roleColumn);
  const activeColumn = sqlIdentifier(env.auth.activeColumn);
  const pool = await getPool();
  const result = await pool.request()
    .input("funcionarioId", sql.Int, funcionarioId)
    .query(`
      SELECT
        u."Id" AS "funcionarioId",
        CAST(u.${matriculaColumn} AS varchar(20)) AS matricula,
        u.${nameColumn} AS nome,
        u."LojaId" AS "lojaId",
        l.nome AS loja,
        e.id AS "escalaId",
        e.nome AS "escalaNome",
        e.tipo AS "escalaTipo",
        e.configuracao_json AS "escalaConfiguracao",
        to_char(escala_hist.data_inicio, 'YYYY-MM-DD') AS "escalaDataInicio",
        to_char(u."DataInicioPonto", 'YYYY-MM-DD') AS "dataInicioPonto",
        d.dia_semana AS "diaSemana",
        d.meta_minutos AS "metaMinutos"
      FROM ${table} u
      LEFT JOIN app_lojas l ON l.id = u."LojaId"
      LEFT JOIN LATERAL (
        SELECT h.escala_id, h.data_inicio
        FROM app_funcionario_escalas h
        WHERE h.matricula = CAST(u.${matriculaColumn} AS varchar(20))
          AND h.data_inicio <= current_date
        ORDER BY h.data_inicio DESC, h.id DESC
        LIMIT 1
      ) escala_hist ON true
      LEFT JOIN app_escalas e ON e.id = COALESCE(escala_hist.escala_id, u."EscalaId")
      LEFT JOIN app_escala_dias d ON d.escala_id = e.id AND d.ativo = true
      WHERE u."Id" = @funcionarioId
        AND u.${activeColumn} = true
        AND LOWER(CAST(u.${roleColumn} AS varchar(50))) NOT IN ('admin', 'administrador', 'gestor')
      ORDER BY d.dia_semana ASC
    `);

  return result.recordset;
}

async function listOriginalPunches({ matricula, startDate, endDate }) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(20), matricula)
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate)
    .query(`
      SELECT
        to_char(data_ponto, 'YYYY-MM-DD') AS data,
        to_char(hora_ponto, 'HH24:MI') AS hora,
        tipo
      FROM app_ponto_registros
      WHERE matricula = @matricula
        AND data_ponto >= @startDate
        AND data_ponto <= @endDate
      ORDER BY data_ponto ASC, data_hora ASC, id ASC
    `);

  return result.recordset;
}

function metaOverrideSelect(capabilities) {
  return capabilities.hasMetaOverride
    ? "meta_minutos_override AS \"metaMinutosOverride\""
    : "CAST(NULL AS int) AS \"metaMinutosOverride\"";
}

function ajusteSelect(capabilities) {
  return `
    id,
    funcionario_id AS "funcionarioId",
    matricula,
    to_char(data_ponto, 'YYYY-MM-DD') AS data,
    to_char(entrada1, 'HH24:MI') AS entrada1,
    to_char(saida1, 'HH24:MI') AS saida1,
    to_char(entrada2, 'HH24:MI') AS entrada2,
    to_char(saida2, 'HH24:MI') AS saida2,
    tipo_ajuste AS "tipoAjuste",
    ${metaOverrideSelect(capabilities)},
    motivo,
    observacao,
    ativo,
    COALESCE(created_by, 'Usuario nao registrado') AS "createdBy",
    to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS "createdAt"
  `;
}

async function listActiveAdjustments({ funcionarioId, startDate, endDate }) {
  const existsTable = await ensureAjustesSchema();
  if (!existsTable) return new Map();

  const capabilities = await getAjustesCapabilities();
  const pool = await getPool();
  const result = await pool.request()
    .input("funcionarioId", sql.Int, funcionarioId)
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate)
    .query(`
      SELECT ${ajusteSelect(capabilities)}
      FROM app_ponto_ajustes
      WHERE funcionario_id = @funcionarioId
        AND data_ponto >= @startDate
        AND data_ponto <= @endDate
        AND ativo = true
      ORDER BY data_ponto ASC, id DESC
    `);

  const byDate = new Map();
  for (const row of result.recordset) {
    if (!byDate.has(row.data)) {
      byDate.set(row.data, mapAjuste(row));
    }
  }
  return byDate;
}

async function listAdjustmentsHistory({ funcionarioId, startDate, endDate }) {
  const existsTable = await ensureAjustesSchema();
  if (!existsTable) return new Map();

  const capabilities = await getAjustesCapabilities();
  const pool = await getPool();
  const result = await pool.request()
    .input("funcionarioId", sql.Int, funcionarioId)
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate)
    .query(`
      SELECT ${ajusteSelect(capabilities)}
      FROM app_ponto_ajustes
      WHERE funcionario_id = @funcionarioId
        AND data_ponto >= @startDate
        AND data_ponto <= @endDate
      ORDER BY data_ponto ASC, created_at ASC, id ASC
    `);

  const byDate = new Map();
  for (const row of result.recordset) {
    const ajuste = mapAjuste(row);
    if (!byDate.has(ajuste.data)) {
      byDate.set(ajuste.data, []);
    }
    byDate.get(ajuste.data).push({
      ...ajuste,
      numero: byDate.get(ajuste.data).length + 1,
    });
  }
  return byDate;
}

async function findActiveAdjustmentByDate({ funcionarioId, data }) {
  const existsTable = await ensureAjustesSchema();
  if (!existsTable) return null;

  const capabilities = await getAjustesCapabilities();
  const pool = await getPool();
  const result = await pool.request()
    .input("funcionarioId", sql.Int, funcionarioId)
    .input("data", sql.Date, data)
    .query(`
      SELECT ${ajusteSelect(capabilities)}
      FROM app_ponto_ajustes
      WHERE funcionario_id = @funcionarioId
        AND data_ponto = @data
        AND ativo = true
      ORDER BY id DESC
      LIMIT 1
    `);

  return mapAjuste(result.recordset[0]);
}

async function listActiveAdjustmentsByRange({ matricula, startDate, endDate }) {
  const existsTable = await ensureAjustesSchema();
  if (!existsTable) return new Map();

  const capabilities = await getAjustesCapabilities();
  const pool = await getPool();
  const request = pool.request()
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate);
  const matriculaFilter = matricula ? "AND matricula = @matricula" : "";

  if (matricula) {
    request.input("matricula", sql.VarChar(20), matricula);
  }

  const result = await request.query(`
    SELECT ${ajusteSelect(capabilities)}
    FROM app_ponto_ajustes
    WHERE data_ponto >= @startDate
      AND data_ponto <= @endDate
      AND ativo = true
      ${matriculaFilter}
    ORDER BY data_ponto ASC, id DESC
  `);

  const byMatriculaDate = new Map();
  for (const row of result.recordset) {
    const key = `${row.matricula}|${row.data}`;
    if (!byMatriculaDate.has(key)) {
      byMatriculaDate.set(key, mapAjuste(row));
    }
  }
  return byMatriculaDate;
}

async function saveAdjustment({ funcionarioId, matricula, data, payload, createdBy }) {
  await ensureAjustesSchema({ required: true });
  const capabilities = await getAjustesCapabilities();
  const isEscalaOverride = payload.tipoAjuste === "MARCAR_FOLGA" || payload.tipoAjuste === "MARCAR_TRABALHO";
  if (isEscalaOverride && !capabilities.supportsEscalaOverride) {
    const error = new Error("Banco ainda nao aceita ajuste de escala. Execute backend/docs/supabase-schema.sql no Supabase.");
    error.status = 503;
    throw error;
  }
  if (payload.tipoAjuste === "MARCAR_TRABALHO" && !capabilities.hasMetaOverride) {
    const error = new Error("Banco ainda nao possui meta_minutos_override. Execute backend/docs/supabase-schema.sql no Supabase.");
    error.status = 503;
    throw error;
  }

  const transaction = new sql.Transaction();
  await transaction.begin();

  try {
    await new sql.Request(transaction.client)
      .input("funcionarioId", sql.Int, funcionarioId)
      .input("data", sql.Date, data)
      .query(`
        UPDATE app_ponto_ajustes
        SET ativo = false, updated_at = now()
        WHERE funcionario_id = @funcionarioId
          AND data_ponto = @data
          AND ativo = true
      `);

    const metaColumnInsert = capabilities.hasMetaOverride ? "meta_minutos_override, " : "";
    const metaColumnValue = capabilities.hasMetaOverride ? "@metaMinutosOverride, " : "";

    const result = await new sql.Request(transaction.client)
      .input("funcionarioId", sql.Int, funcionarioId)
      .input("matricula", sql.VarChar(20), matricula)
      .input("data", sql.Date, data)
      .input("entrada1", sql.VarChar(5), payload.entrada1 || null)
      .input("saida1", sql.VarChar(5), payload.saida1 || null)
      .input("entrada2", sql.VarChar(5), payload.entrada2 || null)
      .input("saida2", sql.VarChar(5), payload.saida2 || null)
      .input("tipoAjuste", sql.VarChar(40), payload.tipoAjuste)
      .input("metaMinutosOverride", sql.Int, payload.metaMinutosOverride || null)
      .input("motivo", sql.VarChar(200), payload.motivo)
      .input("observacao", sql.VarChar(500), payload.observacao || null)
      .input("createdBy", sql.VarChar(120), createdBy || null)
      .query(`
        INSERT INTO app_ponto_ajustes (
          funcionario_id, matricula, data_ponto,
          entrada1, saida1, entrada2, saida2,
          tipo_ajuste, ${metaColumnInsert}motivo, observacao, created_by
        )
        VALUES (
          @funcionarioId, @matricula, @data,
          @entrada1::time, @saida1::time, @entrada2::time, @saida2::time,
          @tipoAjuste, ${metaColumnValue}@motivo, @observacao, @createdBy
        )
        RETURNING ${ajusteSelect(capabilities)}
      `);

    await transaction.commit();
    return mapAjuste(result.recordset[0]);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function clearAdjustment({ funcionarioId, data, ajusteId = null }) {
  await ensureAjustesSchema({ required: true });
  const transaction = new sql.Transaction();
  await transaction.begin();

  try {
    const selectedResult = await new sql.Request(transaction.client)
      .input("funcionarioId", sql.Int, funcionarioId)
      .input("data", sql.Date, data)
      .input("ajusteId", sql.BigInt, ajusteId)
      .query(`
        SELECT id, ativo
        FROM app_ponto_ajustes
        WHERE funcionario_id = @funcionarioId
          AND data_ponto = @data
          AND (@ajusteId::bigint IS NULL OR id = @ajusteId)
          AND (@ajusteId::bigint IS NOT NULL OR ativo = true)
        ORDER BY id DESC
        LIMIT 1
      `);
    const selected = selectedResult.recordset[0];

    if (!selected) {
      await transaction.rollback();
      return { changed: 0, mode: "none" };
    }

    const latestResult = await new sql.Request(transaction.client)
      .input("funcionarioId", sql.Int, funcionarioId)
      .input("data", sql.Date, data)
      .query(`
        SELECT id
        FROM app_ponto_ajustes
        WHERE funcionario_id = @funcionarioId
          AND data_ponto = @data
        ORDER BY id DESC
        LIMIT 1
      `);
    const latestId = latestResult.recordset[0]?.id || null;

    if (!Boolean(selected.ativo)) {
      const activeResult = await new sql.Request(transaction.client)
        .input("funcionarioId", sql.Int, funcionarioId)
        .input("data", sql.Date, data)
        .query(`
          SELECT id
          FROM app_ponto_ajustes
          WHERE funcionario_id = @funcionarioId
            AND data_ponto = @data
            AND ativo = true
          ORDER BY id DESC
          LIMIT 1
        `);
      const hasActive = Boolean(activeResult.recordset[0]);

      if (hasActive || Number(selected.id) !== Number(latestId)) {
        await transaction.rollback();
        return { changed: 0, mode: "not_latest" };
      }

      await new sql.Request(transaction.client)
        .input("id", sql.BigInt, selected.id)
        .query(`
          DELETE FROM app_ponto_ajustes
          WHERE id = @id
        `);

      await transaction.commit();
      return {
        changed: 1,
        mode: "delete_inactive",
        restoredId: null,
      };
    }

    const previousResult = await new sql.Request(transaction.client)
      .input("funcionarioId", sql.Int, funcionarioId)
      .input("data", sql.Date, data)
      .input("selectedId", sql.BigInt, selected.id)
      .query(`
        SELECT id
        FROM app_ponto_ajustes
        WHERE funcionario_id = @funcionarioId
          AND data_ponto = @data
          AND id < @selectedId
        ORDER BY id DESC
        LIMIT 1
      `);
    const restored = previousResult.recordset[0]?.id || null;

    await new sql.Request(transaction.client)
      .input("id", sql.BigInt, selected.id)
      .query(`
        DELETE FROM app_ponto_ajustes
        WHERE id = @id
      `);

    if (restored) {
      await new sql.Request(transaction.client)
        .input("funcionarioId", sql.Int, funcionarioId)
        .input("data", sql.Date, data)
        .query(`
          UPDATE app_ponto_ajustes
          SET ativo = false, updated_at = now()
          WHERE funcionario_id = @funcionarioId
            AND data_ponto = @data
        `);

      await new sql.Request(transaction.client)
        .input("id", sql.BigInt, restored)
        .query(`
          UPDATE app_ponto_ajustes
          SET ativo = true, updated_at = now()
          WHERE id = @id
        `);
    }

    await transaction.commit();
    return {
      changed: 1,
      mode: "undo",
      restoredId: restored,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  clearAdjustment,
  ensureAjustesSchema,
  findActiveAdjustmentByDate,
  findFuncionarioContextById,
  listActiveAdjustments,
  listAdjustmentsHistory,
  listActiveAdjustmentsByRange,
  listOriginalPunches,
  saveAdjustment,
};
