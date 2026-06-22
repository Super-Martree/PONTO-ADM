const { getPool, sql } = require("../../db/postgres");

async function ensureBancoHorasSchema() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID('dbo.app_banco_horas_lancamentos', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.app_banco_horas_lancamentos (
        id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_banco_horas_lancamentos PRIMARY KEY,
        funcionario_id int NULL,
        matricula varchar(30) NOT NULL,
        data_lancamento date NOT NULL,
        minutos int NOT NULL,
        descricao varchar(250) NOT NULL,
        criado_por_matricula varchar(30) NULL,
        criado_por_nome varchar(120) NULL,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_app_banco_horas_lancamentos_created DEFAULT SYSDATETIME()
      );
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_app_banco_horas_lancamentos_matricula_data'
        AND object_id = OBJECT_ID('dbo.app_banco_horas_lancamentos')
    )
      CREATE INDEX ix_app_banco_horas_lancamentos_matricula_data
        ON dbo.app_banco_horas_lancamentos (matricula, data_lancamento);
  `);
}

function mapLancamento(row) {
  return {
    id: row.id,
    funcionarioId: row.funcionarioId,
    matricula: row.matricula,
    data: row.data,
    minutos: Number(row.minutos || 0),
    descricao: row.descricao,
    criadoPorMatricula: row.criadoPorMatricula,
    criadoPorNome: row.criadoPorNome,
    criadoEm: row.criadoEm,
  };
}

async function listManualEntries({ startDate, endDate, matricula = "" }) {
  await ensureBancoHorasSchema();
  const pool = await getPool();
  const request = pool.request()
    .input("startDate", sql.Date, startDate)
    .input("endDate", sql.Date, endDate);
  const matriculaFilter = matricula ? "AND matricula = @matricula" : "";

  if (matricula) {
    request.input("matricula", sql.VarChar(30), matricula);
  }

  const result = await request.query(`
    SELECT
      id,
      funcionario_id AS [funcionarioId],
      matricula,
      CONVERT(varchar(10), data_lancamento, 23) AS data,
      minutos,
      descricao,
      criado_por_matricula AS [criadoPorMatricula],
      criado_por_nome AS [criadoPorNome],
      CONVERT(varchar(19), created_at, 120) AS [criadoEm]
    FROM app_banco_horas_lancamentos
    WHERE data_lancamento >= @startDate
      AND data_lancamento <= @endDate
      ${matriculaFilter}
    ORDER BY data_lancamento DESC, id DESC
  `);

  return result.recordset.map(mapLancamento);
}

async function createManualEntry(data) {
  await ensureBancoHorasSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input("funcionarioId", sql.Int, data.funcionarioId || null)
    .input("matricula", sql.VarChar(30), data.matricula)
    .input("data", sql.Date, data.data)
    .input("minutos", sql.Int, data.minutos)
    .input("descricao", sql.VarChar(250), data.descricao)
    .input("criadoPorMatricula", sql.VarChar(30), data.criadoPorMatricula || null)
    .input("criadoPorNome", sql.VarChar(120), data.criadoPorNome || null)
    .query(`
      INSERT INTO app_banco_horas_lancamentos (
        funcionario_id,
        matricula,
        data_lancamento,
        minutos,
        descricao,
        criado_por_matricula,
        criado_por_nome
      )
      OUTPUT
        inserted.id,
        inserted.funcionario_id AS [funcionarioId],
        inserted.matricula,
        CONVERT(varchar(10), inserted.data_lancamento, 23) AS data,
        inserted.minutos,
        inserted.descricao,
        inserted.criado_por_matricula AS [criadoPorMatricula],
        inserted.criado_por_nome AS [criadoPorNome],
        CONVERT(varchar(19), inserted.created_at, 120) AS [criadoEm]
      VALUES (
        @funcionarioId,
        @matricula,
        @data,
        @minutos,
        @descricao,
        @criadoPorMatricula,
        @criadoPorNome
      )
    `);

  return mapLancamento(result.recordset[0]);
}

module.exports = {
  createManualEntry,
  ensureBancoHorasSchema,
  listManualEntries,
};
