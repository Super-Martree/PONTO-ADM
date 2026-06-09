const { getPool, sql } = require("../../db/postgres");
const { ensureConfiguracoesSchema, ensureLocaisPermitidosSchema } = require("../../db/schema");

const LOCALIZACAO_KEY = "validacao_localizacao_ativa";

function mapLocalPermitido(row) {
  if (!row) return null;

  return {
    id: row.id,
    nome: row.nome,
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    raioMetros: Number(row.raioMetros || 0),
    ativo: Boolean(row.ativo),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getLocalizacaoConfig() {
  await ensureConfiguracoesSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input("chave", sql.VarChar(80), LOCALIZACAO_KEY)
    .query(`
      SELECT valor
      FROM app_configuracoes
      WHERE chave = @chave
    `);

  return {
    validacaoLocalizacaoAtiva: result.recordset[0]?.valor === "true",
  };
}

async function updateLocalizacaoConfig({ validacaoLocalizacaoAtiva }) {
  await ensureConfiguracoesSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input("chave", sql.VarChar(80), LOCALIZACAO_KEY)
    .input("valor", sql.VarChar(10), validacaoLocalizacaoAtiva ? "true" : "false")
    .query(`
      INSERT INTO app_configuracoes (chave, valor, updated_at)
      VALUES (@chave, @valor, now())
      ON CONFLICT (chave)
      DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
      RETURNING valor
    `);

  return {
    validacaoLocalizacaoAtiva: result.recordset[0]?.valor === "true",
  };
}

async function listLocaisPermitidos() {
  await ensureLocaisPermitidosSchema();
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      id,
      nome,
      latitude,
      longitude,
      raio_metros AS "raioMetros",
      ativo,
      to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
      to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
    FROM app_ponto_locais_permitidos
    ORDER BY ativo DESC, nome ASC, id ASC
  `);

  return result.recordset.map(mapLocalPermitido);
}

async function createLocalPermitido(data) {
  await ensureLocaisPermitidosSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input("nome", sql.VarChar(120), data.nome)
    .input("latitude", sql.VarChar(30), data.latitude)
    .input("longitude", sql.VarChar(30), data.longitude)
    .input("raioMetros", sql.Int, data.raioMetros)
    .input("ativo", sql.Bit, data.ativo)
    .query(`
      INSERT INTO app_ponto_locais_permitidos (
        nome,
        latitude,
        longitude,
        raio_metros,
        ativo
      )
      VALUES (@nome, @latitude, @longitude, @raioMetros, @ativo)
      RETURNING
        id,
        nome,
        latitude,
        longitude,
        raio_metros AS "raioMetros",
        ativo,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
    `);

  return mapLocalPermitido(result.recordset[0]);
}

async function updateLocalPermitido(id, data) {
  await ensureLocaisPermitidosSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .input("nome", sql.VarChar(120), data.nome)
    .input("latitude", sql.VarChar(30), data.latitude)
    .input("longitude", sql.VarChar(30), data.longitude)
    .input("raioMetros", sql.Int, data.raioMetros)
    .input("ativo", sql.Bit, data.ativo)
    .query(`
      UPDATE app_ponto_locais_permitidos
      SET
        nome = @nome,
        latitude = @latitude,
        longitude = @longitude,
        raio_metros = @raioMetros,
        ativo = @ativo,
        updated_at = now()
      WHERE id = @id
      RETURNING
        id,
        nome,
        latitude,
        longitude,
        raio_metros AS "raioMetros",
        ativo,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
    `);

  return mapLocalPermitido(result.recordset[0]);
}

async function deleteLocalPermitido(id) {
  await ensureLocaisPermitidosSchema();
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query(`
      DELETE FROM app_ponto_locais_permitidos
      WHERE id = @id
    `);

  return result.rowsAffected?.[0] || 0;
}

module.exports = {
  createLocalPermitido,
  deleteLocalPermitido,
  getLocalizacaoConfig,
  listLocaisPermitidos,
  updateLocalPermitido,
  updateLocalizacaoConfig,
};
