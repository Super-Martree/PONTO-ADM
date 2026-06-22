const { getPool, sql } = require("../../db/postgres");

function mapFeriado(row) {
  if (!row) return null;

  return {
    id: row.id,
    data: row.data,
    diaSemana: row.diaSemana,
    descricao: row.descricao,
    ativo: Boolean(row.ativo),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function hasFeriadosTable() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT CASE WHEN OBJECT_ID('dbo.app_feriados', 'U') IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS [exists]
  `);
  return Boolean(result.recordset[0]?.exists);
}

async function listFeriados() {
  const exists = await hasFeriadosTable();

  if (!exists) {
    return [];
  }

  const pool = await getPool();
  const result = await pool.request().query(`
      SELECT
        id,
      CONVERT(varchar(10), data_feriado, 23) AS data,
      CASE (((DATEPART(weekday, data_feriado) + @@DATEFIRST + 5) % 7) + 1)
        WHEN 1 THEN 'Segunda'
        WHEN 2 THEN 'Terca'
        WHEN 3 THEN 'Quarta'
        WHEN 4 THEN 'Quinta'
        WHEN 5 THEN 'Sexta'
        WHEN 6 THEN 'Sabado'
        WHEN 7 THEN 'Domingo'
      END AS [diaSemana],
      descricao,
      ativo,
      CONVERT(varchar(19), created_at, 120) AS created_at,
      CONVERT(varchar(19), updated_at, 120) AS updated_at
    FROM app_feriados
    ORDER BY data_feriado ASC, id ASC
  `);

  return result.recordset.map(mapFeriado);
}

async function findFeriadoById(id) {
  const exists = await hasFeriadosTable();

  if (!exists) {
    return null;
  }

  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query(`
      SELECT
        id,
        CONVERT(varchar(10), data_feriado, 23) AS data,
        CASE (((DATEPART(weekday, data_feriado) + @@DATEFIRST + 5) % 7) + 1)
          WHEN 1 THEN 'Segunda'
          WHEN 2 THEN 'Terca'
          WHEN 3 THEN 'Quarta'
          WHEN 4 THEN 'Quinta'
          WHEN 5 THEN 'Sexta'
          WHEN 6 THEN 'Sabado'
          WHEN 7 THEN 'Domingo'
        END AS [diaSemana],
        descricao,
        ativo,
        CONVERT(varchar(19), created_at, 120) AS created_at,
        CONVERT(varchar(19), updated_at, 120) AS updated_at
      FROM app_feriados
      WHERE id = @id
    `);

  return mapFeriado(result.recordset[0]);
}

async function createFeriado(data) {
  const pool = await getPool();
  const result = await pool.request()
    .input("data", sql.Date, data.data)
    .input("descricao", sql.VarChar(150), data.descricao)
    .input("ativo", sql.Bit, data.ativo)
    .query(`
      INSERT INTO app_feriados (data_feriado, descricao, ativo)
      OUTPUT inserted.id
      VALUES (@data, @descricao, @ativo)
    `);

  return findFeriadoById(result.recordset[0].id);
}

async function updateFeriado(id, data) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .input("data", sql.Date, data.data)
    .input("descricao", sql.VarChar(150), data.descricao)
    .input("ativo", sql.Bit, data.ativo)
    .query(`
      UPDATE app_feriados
      SET data_feriado = @data,
          descricao = @descricao,
          ativo = @ativo,
          updated_at = SYSDATETIME()
      OUTPUT inserted.id
      WHERE id = @id
    `);

  if (!result.recordset[0]) return null;
  return findFeriadoById(result.recordset[0].id);
}

async function updateFeriadoStatus(id, ativo) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .input("ativo", sql.Bit, ativo)
    .query(`
      UPDATE app_feriados
      SET ativo = @ativo,
          updated_at = SYSDATETIME()
      OUTPUT inserted.id
      WHERE id = @id
    `);

  if (!result.recordset[0]) return null;
  return findFeriadoById(result.recordset[0].id);
}

module.exports = {
  createFeriado,
  findFeriadoById,
  hasFeriadosTable,
  listFeriados,
  updateFeriado,
  updateFeriadoStatus,
};
