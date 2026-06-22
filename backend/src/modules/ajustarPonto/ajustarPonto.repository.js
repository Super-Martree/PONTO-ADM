const { getPool, sql } = require("../../db/postgres");
const { ensureEscalasConfigColumn } = require("../../db/schema");
const env = require("../../config/env");
const { sqlIdentifier } = require("../../utils/identifier");

async function ensureAjustesSchema({ required = false } = {}) {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT CASE WHEN OBJECT_ID('dbo.app_ponto_ajustes', 'U') IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS [existsTable]
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
      CASE WHEN EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.app_ponto_ajustes')
          AND name = 'meta_minutos_override'
      ) THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS [hasMetaOverride],
      CAST(1 AS bit) AS [supportsEscalaOverride]
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
        u.[Id] AS [funcionarioId],
        CAST(u.${matriculaColumn} AS varchar(20)) AS matricula,
        u.${nameColumn} AS nome,
        u.[LojaId] AS [lojaId],
        l.nome AS loja,
        e.id AS [escalaId],
        e.nome AS [escalaNome],
        e.tipo AS [escalaTipo],
        e.configuracao_json AS [escalaConfiguracao],
        CONVERT(varchar(10), escala_hist.data_inicio, 23) AS [escalaDataInicio],
        CONVERT(varchar(10), u.[DataInicioPonto], 23) AS [dataInicioPonto],
        d.dia_semana AS [diaSemana],
        d.meta_minutos AS [metaMinutos]
      FROM ${table} u
      LEFT JOIN app_lojas l ON l.id = u.[LojaId]
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
      WHERE u.[Id] = @funcionarioId
        AND u.${activeColumn} = 1
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
        CONVERT(varchar(10), data_ponto, 23) AS data,
        CONVERT(varchar(5), hora_ponto, 108) AS hora,
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
    ? "meta_minutos_override AS [metaMinutosOverride]"
    : "CAST(NULL AS int) AS [metaMinutosOverride]";
}

function ajusteSelect(capabilities) {
  return `
    id,
    funcionario_id AS [funcionarioId],
    matricula,
    CONVERT(varchar(10), data_ponto, 23) AS data,
    CONVERT(varchar(5), entrada1, 108) AS entrada1,
    CONVERT(varchar(5), saida1, 108) AS saida1,
    CONVERT(varchar(5), entrada2, 108) AS entrada2,
    CONVERT(varchar(5), saida2, 108) AS saida2,
    tipo_ajuste AS [tipoAjuste],
    ${metaOverrideSelect(capabilities)},
    motivo,
    observacao,
    ativo,
    COALESCE(created_by, 'Usuario nao registrado') AS [createdBy],
    CONVERT(varchar(19), created_at, 120) AS [createdAt]
  `;
}

function ajusteOutputSelect(capabilities) {
  const metaOutput = capabilities.hasMetaOverride
    ? "inserted.meta_minutos_override AS [metaMinutosOverride]"
    : "CAST(NULL AS int) AS [metaMinutosOverride]";

  return `
    inserted.id,
    inserted.funcionario_id AS [funcionarioId],
    inserted.matricula,
    CONVERT(varchar(10), inserted.data_ponto, 23) AS data,
    CONVERT(varchar(5), inserted.entrada1, 108) AS entrada1,
    CONVERT(varchar(5), inserted.saida1, 108) AS saida1,
    CONVERT(varchar(5), inserted.entrada2, 108) AS entrada2,
    CONVERT(varchar(5), inserted.saida2, 108) AS saida2,
    inserted.tipo_ajuste AS [tipoAjuste],
    ${metaOutput},
    inserted.motivo,
    inserted.observacao,
    inserted.ativo,
    COALESCE(inserted.created_by, 'Usuario nao registrado') AS [createdBy],
    CONVERT(varchar(19), inserted.created_at, 120) AS [createdAt]
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
        AND ativo = 1
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
        AND ativo = 1
      ORDER BY id DESC
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
      AND ativo = 1
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

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await new sql.Request(transaction)
      .input("funcionarioId", sql.Int, funcionarioId)
      .input("data", sql.Date, data)
      .query(`
        UPDATE app_ponto_ajustes
        SET ativo = 0, updated_at = SYSDATETIME()
        WHERE funcionario_id = @funcionarioId
          AND data_ponto = @data
          AND ativo = 1
      `);

    const metaColumnInsert = capabilities.hasMetaOverride ? "meta_minutos_override, " : "";
    const metaColumnValue = capabilities.hasMetaOverride ? "@metaMinutosOverride, " : "";

    const result = await new sql.Request(transaction)
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
        OUTPUT ${ajusteOutputSelect(capabilities)}
        VALUES (
          @funcionarioId, @matricula, @data,
          TRY_CONVERT(time(0), @entrada1), TRY_CONVERT(time(0), @saida1), TRY_CONVERT(time(0), @entrada2), TRY_CONVERT(time(0), @saida2),
          @tipoAjuste, ${metaColumnValue}@motivo, @observacao, @createdBy
        )
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
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const selectedResult = await new sql.Request(transaction)
      .input("funcionarioId", sql.Int, funcionarioId)
      .input("data", sql.Date, data)
      .input("ajusteId", sql.BigInt, ajusteId)
      .query(`
        SELECT TOP (1) id, ativo
        FROM app_ponto_ajustes
        WHERE funcionario_id = @funcionarioId
          AND data_ponto = @data
          AND (@ajusteId IS NULL OR id = @ajusteId)
          AND (@ajusteId IS NOT NULL OR ativo = 1)
        ORDER BY id DESC
      `);
    const selected = selectedResult.recordset[0];

    if (!selected) {
      await transaction.rollback();
      return { changed: 0, mode: "none" };
    }

    const latestResult = await new sql.Request(transaction)
      .input("funcionarioId", sql.Int, funcionarioId)
      .input("data", sql.Date, data)
      .query(`
        SELECT TOP (1) id
        FROM app_ponto_ajustes
        WHERE funcionario_id = @funcionarioId
          AND data_ponto = @data
        ORDER BY id DESC
      `);
    const latestId = latestResult.recordset[0]?.id || null;

    if (!Boolean(selected.ativo)) {
      const activeResult = await new sql.Request(transaction)
        .input("funcionarioId", sql.Int, funcionarioId)
        .input("data", sql.Date, data)
        .query(`
          SELECT TOP (1) id
          FROM app_ponto_ajustes
          WHERE funcionario_id = @funcionarioId
            AND data_ponto = @data
            AND ativo = 1
          ORDER BY id DESC
        `);
      const hasActive = Boolean(activeResult.recordset[0]);

      if (hasActive || Number(selected.id) !== Number(latestId)) {
        await transaction.rollback();
        return { changed: 0, mode: "not_latest" };
      }

      await new sql.Request(transaction)
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

    const previousResult = await new sql.Request(transaction)
      .input("funcionarioId", sql.Int, funcionarioId)
      .input("data", sql.Date, data)
      .input("selectedId", sql.BigInt, selected.id)
      .query(`
        SELECT TOP (1) id
        FROM app_ponto_ajustes
        WHERE funcionario_id = @funcionarioId
          AND data_ponto = @data
          AND id < @selectedId
        ORDER BY id DESC
      `);
    const restored = previousResult.recordset[0]?.id || null;

    await new sql.Request(transaction)
      .input("id", sql.BigInt, selected.id)
      .query(`
        DELETE FROM app_ponto_ajustes
        WHERE id = @id
      `);

    if (restored) {
      await new sql.Request(transaction)
        .input("funcionarioId", sql.Int, funcionarioId)
        .input("data", sql.Date, data)
        .query(`
          UPDATE app_ponto_ajustes
          SET ativo = 0, updated_at = SYSDATETIME()
          WHERE funcionario_id = @funcionarioId
            AND data_ponto = @data
        `);

      await new sql.Request(transaction)
        .input("id", sql.BigInt, restored)
        .query(`
          UPDATE app_ponto_ajustes
          SET ativo = 1, updated_at = SYSDATETIME()
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
