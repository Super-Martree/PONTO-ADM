const { getPool, sql } = require("../../db/postgres");
const { ensureEscalasSemanaisSchema } = require("../../db/schema");

async function ensureFuncionarioSchema() {
  const pool = await getPool();
  await pool.request().query(`
    IF COL_LENGTH('dbo.Usuarios', 'LojaId') IS NULL
      ALTER TABLE dbo.Usuarios ADD LojaId int NULL;

    IF COL_LENGTH('dbo.Usuarios', 'SetorId') IS NULL
      ALTER TABLE dbo.Usuarios ADD SetorId int NULL;

    IF COL_LENGTH('dbo.Usuarios', 'EscalaId') IS NULL
      ALTER TABLE dbo.Usuarios ADD EscalaId int NULL;

    IF COL_LENGTH('dbo.Usuarios', 'DataInicioPonto') IS NULL
      ALTER TABLE dbo.Usuarios ADD DataInicioPonto date NULL;

    IF OBJECT_ID('dbo.app_funcionario_escalas', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.app_funcionario_escalas (
        id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_funcionario_escalas PRIMARY KEY,
        matricula varchar(30) NOT NULL,
        escala_id int NULL,
        data_inicio date NOT NULL,
        created_at datetime2(0) NOT NULL CONSTRAINT DF_app_funcionario_escalas_created_at DEFAULT SYSDATETIME(),
        updated_at datetime2(0) NOT NULL CONSTRAINT DF_app_funcionario_escalas_updated_at DEFAULT SYSDATETIME(),
        CONSTRAINT UX_app_funcionario_escalas_matricula_data UNIQUE (matricula, data_inicio)
      );
    END;

    INSERT INTO app_funcionario_escalas (matricula, escala_id, data_inicio)
    SELECT
      CAST(u.Matricula AS varchar(30)),
      u.EscalaId,
      COALESCE(CAST(u.DataInicioPonto AS date), CONVERT(date, '19000101'))
    FROM dbo.Usuarios u
    WHERE u.EscalaId IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM app_funcionario_escalas h
        WHERE h.matricula = CAST(u.Matricula AS varchar(30))
      );

    IF OBJECT_ID('dbo.app_funcionario_auditoria', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.app_funcionario_auditoria (
        id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_app_funcionario_auditoria PRIMARY KEY,
        funcionario_id int NOT NULL,
        matricula varchar(30) NOT NULL,
        campo varchar(80) NOT NULL,
        valor_anterior varchar(255) NULL,
        valor_novo varchar(255) NULL,
        alterado_por_matricula varchar(30) NULL,
        alterado_por_nome varchar(120) NULL,
        alterado_em datetime2(0) NOT NULL CONSTRAINT DF_app_funcionario_auditoria_alterado_em DEFAULT SYSDATETIME()
      );
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'ix_app_funcionario_auditoria_funcionario'
        AND object_id = OBJECT_ID('dbo.app_funcionario_auditoria')
    )
      CREATE INDEX ix_app_funcionario_auditoria_funcionario
        ON dbo.app_funcionario_auditoria (funcionario_id, alterado_em DESC);
  `);
}

function mapFuncionario(row) {
  if (!row) return null;

  return {
    id: row.id,
    matricula: row.matricula,
    nome: row.nome,
    perfil: row.perfil,
    ativo: Boolean(row.ativo),
    lojaId: row.lojaId,
    lojaNome: row.lojaNome,
    setorId: row.setorId,
    escalaId: row.escalaId,
    escalaNome: row.escalaNome,
    escalaDataInicio: row.escalaDataInicio,
    dataInicioPonto: row.dataInicioPonto,
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

const FUNCIONARIO_SELECT = `
  SELECT
    u.[Id] AS id,
    u.[Matricula] AS matricula,
    u.[Nome] AS nome,
    u.[Perfil] AS perfil,
    u.[Ativo] AS ativo,
    u.[LojaId] AS [lojaId],
    l.nome AS [lojaNome],
    u.[SetorId] AS [setorId],
    e.id AS [escalaId],
    e.nome AS [escalaNome],
    CONVERT(varchar(10), escala_atual.data_inicio, 23) AS [escalaDataInicio],
    CONVERT(varchar(10), u.[DataInicioPonto], 23) AS [dataInicioPonto],
    CONVERT(varchar(19), u.[CriadoEm], 120) AS [criadoEm],
    CONVERT(varchar(19), u.[AtualizadoEm], 120) AS [atualizadoEm]
  FROM [Usuarios] u
  LEFT JOIN app_lojas l ON l.id = u.[LojaId]
  OUTER APPLY (
    SELECT TOP (1) h.escala_id, h.data_inicio
    FROM app_funcionario_escalas h
    WHERE h.matricula = CAST(u.[Matricula] AS varchar(30))
      AND h.data_inicio <= CAST(SYSDATETIME() AS date)
    ORDER BY h.data_inicio DESC, h.id DESC
  ) escala_atual
  OUTER APPLY (
    SELECT TOP (1) CAST(1 AS bit) AS has_history
    FROM app_funcionario_escalas h
    WHERE h.matricula = CAST(u.[Matricula] AS varchar(30))
  ) escala_historico
  LEFT JOIN app_escalas e ON e.id = CASE WHEN escala_historico.has_history = 1 THEN escala_atual.escala_id ELSE u.[EscalaId] END
`;

async function listFuncionarios() {
  const pool = await getPool();
  const result = await pool.request().query(`
    ${FUNCIONARIO_SELECT}
    WHERE LOWER(CAST(u.[Perfil] AS varchar(50))) NOT IN ('admin', 'administrador', 'gestor')
    ORDER BY u.[Ativo] DESC, u.[Nome] ASC, u.[Matricula] ASC
  `);

  return result.recordset.map(mapFuncionario);
}

async function findFuncionarioById(id) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query(`
      ${FUNCIONARIO_SELECT}
      WHERE u.[Id] = @id
    `);

  return mapFuncionario(result.recordset[0]);
}

async function findFuncionarioByMatricula(matricula) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(30), matricula)
    .query(`
      SELECT TOP (1) [Id] AS id, [Matricula] AS matricula
      FROM [Usuarios]
      WHERE [Matricula] = @matricula
    `);

  return result.recordset[0] || null;
}

async function getNextMatricula() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT CAST(COALESCE(MAX(TRY_CONVERT(int, [Matricula])), 1000) + 1 AS varchar(30)) AS matricula
    FROM [Usuarios]
    WHERE TRY_CONVERT(int, [Matricula]) IS NOT NULL
  `);

  return result.recordset[0].matricula;
}

async function createFuncionario(data) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(30), data.matricula)
    .input("senha", sql.VarChar(255), data.senha)
    .input("nome", sql.VarChar(120), data.nome)
    .input("perfil", sql.VarChar(30), "funcionario")
    .input("ativo", sql.Bit, data.ativo)
    .input("lojaId", sql.Int, data.lojaId)
    .input("setorId", sql.Int, data.setorId)
    .input("escalaId", sql.Int, data.escalaId)
    .input("dataInicioPonto", sql.VarChar(10), data.dataInicioPonto)
    .query(`
      INSERT INTO [Usuarios] (
        [Matricula], [Senha], [Nome], [Perfil], [Ativo],
        [LojaId], [SetorId], [EscalaId], [DataInicioPonto]
      )
      OUTPUT inserted.[Id] AS id
      VALUES (@matricula, @senha, @nome, @perfil, @ativo, @lojaId, @setorId, @escalaId, @dataInicioPonto)
    `);

  return findFuncionarioById(result.recordset[0].id);
}

async function upsertFuncionarioEscalaHistorico({ matricula, escalaId, dataInicio }) {
  if (!matricula || !dataInicio) return;

  const pool = await getPool();
  await pool.request()
    .input("matricula", sql.VarChar(30), matricula)
    .input("escalaId", sql.Int, escalaId)
    .input("dataInicio", sql.VarChar(10), dataInicio)
    .query(`
      MERGE app_funcionario_escalas AS target
      USING (
        SELECT @matricula AS matricula, @escalaId AS escala_id, CAST(@dataInicio AS date) AS data_inicio
      ) AS source
        ON target.matricula = source.matricula
       AND target.data_inicio = source.data_inicio
      WHEN MATCHED THEN
        UPDATE SET escala_id = source.escala_id, updated_at = SYSDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (matricula, escala_id, data_inicio)
        VALUES (source.matricula, source.escala_id, source.data_inicio);
    `);
}

async function deleteFuncionarioEscalasAfter({ matricula, dataInicio }) {
  if (!matricula || !dataInicio) return 0;

  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(30), matricula)
    .input("dataInicio", sql.VarChar(10), dataInicio)
    .query(`
      DELETE FROM app_funcionario_escalas
      WHERE matricula = @matricula
        AND data_inicio > CAST(@dataInicio AS date)
    `);

  return result.rowsAffected?.[0] || 0;
}

async function findFuncionarioEscalaAnterior({ matricula, dataInicio }) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(30), matricula)
    .input("dataInicio", sql.VarChar(10), dataInicio)
    .query(`
      SELECT
        TOP (1)
        h.escala_id AS [escalaId],
        e.nome AS [escalaNome],
        CONVERT(varchar(10), h.data_inicio, 23) AS [dataInicio]
      FROM app_funcionario_escalas h
      LEFT JOIN app_escalas e ON e.id = h.escala_id
      WHERE h.matricula = @matricula
        AND h.data_inicio < CAST(@dataInicio AS date)
      ORDER BY h.data_inicio DESC, h.id DESC
    `);

  return result.recordset[0] || null;
}

async function listFuncionarioEscalasHistorico(matricula) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(30), matricula)
    .query(`
      SELECT
        h.id,
        h.matricula,
        h.escala_id AS [escalaId],
        e.nome AS [escalaNome],
        CONVERT(varchar(10), h.data_inicio, 23) AS [dataInicio],
        CONVERT(varchar(19), h.created_at, 120) AS [criadoEm],
        CONVERT(varchar(19), h.updated_at, 120) AS [atualizadoEm]
      FROM app_funcionario_escalas h
      LEFT JOIN app_escalas e ON e.id = h.escala_id
      WHERE h.matricula = @matricula
      ORDER BY h.data_inicio DESC, h.id DESC
    `);

  return result.recordset;
}

async function deleteFuncionarioEscalaHistorico({ matricula, historicoId }) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(30), matricula)
    .input("historicoId", sql.Int, historicoId)
    .query(`
      DELETE FROM app_funcionario_escalas
      WHERE id = @historicoId
        AND matricula = @matricula
    `);

  return result.rowsAffected?.[0] || 0;
}

async function findLatestFuncionarioEscalaHistorico(matricula) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(30), matricula)
    .query(`
      SELECT
        TOP (1)
        h.escala_id AS [escalaId],
        e.nome AS [escalaNome],
        CONVERT(varchar(10), h.data_inicio, 23) AS [dataInicio]
      FROM app_funcionario_escalas h
      LEFT JOIN app_escalas e ON e.id = h.escala_id
      WHERE h.matricula = @matricula
      ORDER BY h.data_inicio DESC, h.id DESC
    `);

  return result.recordset[0] || null;
}

async function findCurrentFuncionarioEscalaHistorico(matricula) {
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(30), matricula)
    .query(`
      SELECT
        TOP (1)
        h.escala_id AS [escalaId],
        e.nome AS [escalaNome],
        CONVERT(varchar(10), h.data_inicio, 23) AS [dataInicio]
      FROM app_funcionario_escalas h
      LEFT JOIN app_escalas e ON e.id = h.escala_id
      WHERE h.matricula = @matricula
        AND h.data_inicio <= CAST(SYSDATETIME() AS date)
      ORDER BY h.data_inicio DESC, h.id DESC
    `);

  return result.recordset[0] || null;
}

async function updateFuncionario(id, data) {
  const pool = await getPool();
  const setClauses = [
    "[Nome] = @nome",
    "[Ativo] = @ativo",
    "[LojaId] = @lojaId",
    "[SetorId] = @setorId",
    "[EscalaId] = @escalaId",
  ];

  if (data.dataInicioPonto) {
    setClauses.push("[DataInicioPonto] = @dataInicioPonto");
  }

  if (data.senha) {
    setClauses.push("[Senha] = @senha");
  }

  setClauses.push("[AtualizadoEm] = SYSDATETIME()");

  const result = await pool.request()
    .input("id", sql.Int, id)
    .input("nome", sql.VarChar(120), data.nome)
    .input("ativo", sql.Bit, data.ativo)
    .input("lojaId", sql.Int, data.lojaId)
    .input("setorId", sql.Int, data.setorId)
    .input("escalaId", sql.Int, data.escalaId)
    .input("dataInicioPonto", sql.VarChar(10), data.dataInicioPonto)
    .input("senha", sql.VarChar(255), data.senha)
    .query(`
      UPDATE [Usuarios]
      SET ${setClauses.join(", ")}
      OUTPUT inserted.[Id] AS id
      WHERE [Id] = @id
    `);

  if (!result.recordset[0]) return null;
  return findFuncionarioById(result.recordset[0].id);
}

async function updateFuncionarioStatus(id, ativo) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .input("ativo", sql.Bit, ativo)
    .query(`
      UPDATE [Usuarios]
      SET [Ativo] = @ativo, [AtualizadoEm] = SYSDATETIME()
      OUTPUT inserted.[Id] AS id
      WHERE [Id] = @id
    `);

  if (!result.recordset[0]) return null;
  return findFuncionarioById(result.recordset[0].id);
}

async function updateFuncionarioEscala(id, escalaId) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .input("escalaId", sql.Int, escalaId)
    .query(`
      UPDATE [Usuarios]
      SET [EscalaId] = @escalaId, [AtualizadoEm] = SYSDATETIME()
      OUTPUT inserted.[Id] AS id
      WHERE [Id] = @id
    `);

  if (!result.recordset[0]) return null;
  return findFuncionarioById(result.recordset[0].id);
}

async function insertFuncionarioAuditoria(rows = []) {
  if (!rows.length) return;

  const pool = await getPool();

  for (const row of rows) {
    await pool.request()
      .input("funcionarioId", sql.Int, row.funcionarioId)
      .input("matricula", sql.VarChar(30), row.matricula)
      .input("campo", sql.VarChar(80), row.campo)
      .input("valorAnterior", sql.NVarChar(255), row.valorAnterior)
      .input("valorNovo", sql.NVarChar(255), row.valorNovo)
      .input("alteradoPorMatricula", sql.VarChar(30), row.alteradoPorMatricula)
      .input("alteradoPorNome", sql.NVarChar(120), row.alteradoPorNome)
      .query(`
        INSERT INTO app_funcionario_auditoria (
          funcionario_id,
          matricula,
          campo,
          valor_anterior,
          valor_novo,
          alterado_por_matricula,
          alterado_por_nome
        )
        VALUES (
          @funcionarioId,
          @matricula,
          @campo,
          @valorAnterior,
          @valorNovo,
          @alteradoPorMatricula,
          @alteradoPorNome
        )
      `);
  }
}

async function listFuncionarioAuditoria(funcionarioId) {
  const pool = await getPool();
  const result = await pool.request()
    .input("funcionarioId", sql.Int, funcionarioId)
    .query(`
      SELECT TOP (100)
        id,
        funcionario_id AS [funcionarioId],
        matricula,
        campo,
        valor_anterior AS [valorAnterior],
        valor_novo AS [valorNovo],
        alterado_por_matricula AS [alteradoPorMatricula],
        alterado_por_nome AS [alteradoPorNome],
        CONVERT(varchar(19), alterado_em, 120) AS [alteradoEm]
      FROM app_funcionario_auditoria
      WHERE funcionario_id = @funcionarioId
      ORDER BY alterado_em DESC, id DESC
    `);

  return result.recordset;
}

async function listFuncionarioEscalasSemanais(matricula) {
  await ensureEscalasSemanaisSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(30), matricula)
    .query(`
      SELECT
        s.id,
        s.matricula,
        s.escala_id AS [escalaId],
        e.nome AS [escalaNome],
        CONVERT(varchar(10), s.semana_inicio, 23) AS [semanaInicio],
        CONVERT(varchar(10), s.semana_fim, 23) AS [semanaFim],
        s.motivo,
        CONVERT(varchar(19), s.created_at, 120) AS [criadoEm],
        CONVERT(varchar(19), s.updated_at, 120) AS [atualizadoEm]
      FROM app_funcionario_escalas_semanais s
      INNER JOIN app_escalas e ON e.id = s.escala_id
      WHERE s.matricula = @matricula
      ORDER BY s.semana_inicio DESC, s.id DESC
    `);

  return result.recordset;
}

async function upsertFuncionarioEscalaSemanal({ matricula, escalaId, semanaInicio, semanaFim, motivo }) {
  await ensureEscalasSemanaisSchema();
  const pool = await getPool();
  await pool.request()
    .input("matricula", sql.VarChar(30), matricula)
    .input("escalaId", sql.Int, escalaId)
    .input("semanaInicio", sql.VarChar(10), semanaInicio)
    .input("semanaFim", sql.VarChar(10), semanaFim)
    .input("motivo", sql.NVarChar(255), motivo || null)
    .query(`
      MERGE app_funcionario_escalas_semanais AS target
      USING (
        SELECT
          @matricula AS matricula,
          @escalaId AS escala_id,
          CAST(@semanaInicio AS date) AS semana_inicio,
          CAST(@semanaFim AS date) AS semana_fim,
          @motivo AS motivo
      ) AS source
        ON target.matricula = source.matricula
       AND target.semana_inicio = source.semana_inicio
      WHEN MATCHED THEN
        UPDATE SET
          escala_id = source.escala_id,
          semana_fim = source.semana_fim,
          motivo = source.motivo,
          updated_at = SYSDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (matricula, escala_id, semana_inicio, semana_fim, motivo)
        VALUES (source.matricula, source.escala_id, source.semana_inicio, source.semana_fim, source.motivo);
    `);
}

async function deleteFuncionarioEscalaSemanal({ matricula, semanalId }) {
  await ensureEscalasSemanaisSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input("matricula", sql.VarChar(30), matricula)
    .input("semanalId", sql.Int, semanalId)
    .query(`
      DELETE FROM app_funcionario_escalas_semanais
      WHERE id = @semanalId
        AND matricula = @matricula
    `);

  return result.rowsAffected?.[0] || 0;
}

module.exports = {
  createFuncionario,
  deleteFuncionarioEscalasAfter,
  deleteFuncionarioEscalaSemanal,
  ensureFuncionarioSchema,
  findFuncionarioEscalaAnterior,
  findCurrentFuncionarioEscalaHistorico,
  findLatestFuncionarioEscalaHistorico,
  findFuncionarioById,
  findFuncionarioByMatricula,
  getNextMatricula,
  insertFuncionarioAuditoria,
  listFuncionarioEscalasHistorico,
  listFuncionarioEscalasSemanais,
  listFuncionarioAuditoria,
  listFuncionarios,
  deleteFuncionarioEscalaHistorico,
  updateFuncionario,
  updateFuncionarioEscala,
  updateFuncionarioStatus,
  upsertFuncionarioEscalaHistorico,
  upsertFuncionarioEscalaSemanal,
};
