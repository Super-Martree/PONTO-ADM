const { getPool, sql } = require("../../db/postgres");
const { ensureLocaisPermitidosSchema } = require("../../db/schema");

function mapLoja(row) {
  if (!row) return null;

  return {
    id: row.id,
    codigo: row.codigo,
    nome: row.nome,
    cidade: row.cidade,
    bairro: row.bairro,
    cnpj: row.cnpj,
    ativo: Boolean(row.ativo),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

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

async function listLojas({ ativo } = {}) {
  const pool = await getPool();
  const request = pool.request();
  let where = "";

  if (ativo !== undefined) {
    request.input("ativo", sql.Bit, ativo);
    where = "WHERE ativo = @ativo";
  }

  const result = await request.query(`
    SELECT
      id,
      codigo,
      nome,
      cidade,
      bairro,
      cnpj,
      ativo,
      to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
      to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
    FROM app_lojas
    ${where}
    ORDER BY ativo DESC, nome ASC, codigo ASC
  `);

  return result.recordset.map(mapLoja);
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

async function findLojaById(id) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query(`
      SELECT
        id,
        codigo,
        nome,
        cidade,
        bairro,
        cnpj,
        ativo,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
      FROM app_lojas
      WHERE id = @id
    `);

  return mapLoja(result.recordset[0]);
}

async function findLojaByCodigo(codigo) {
  const pool = await getPool();
  const result = await pool.request()
    .input("codigo", sql.Int, codigo)
    .query(`
      SELECT id, codigo
      FROM app_lojas
      WHERE codigo = @codigo
      LIMIT 1
    `);

  return result.recordset[0] || null;
}

async function getNextCodigo() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT COALESCE(MAX(codigo), 0) + 1 AS codigo
    FROM app_lojas
  `);

  return result.recordset[0].codigo;
}

async function createLoja(data) {
  const pool = await getPool();
  const result = await pool.request()
    .input("codigo", sql.Int, data.codigo)
    .input("nome", sql.VarChar(150), data.nome)
    .input("cidade", sql.VarChar(100), data.cidade)
    .input("bairro", sql.VarChar(100), data.bairro || null)
    .input("cnpj", sql.VarChar(20), data.cnpj || null)
    .input("ativo", sql.Bit, data.ativo)
    .query(`
      INSERT INTO app_lojas (codigo, nome, cidade, bairro, cnpj, ativo)
      VALUES (@codigo, @nome, @cidade, @bairro, @cnpj, @ativo)
      RETURNING
        id,
        codigo,
        nome,
        cidade,
        bairro,
        cnpj,
        ativo,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
    `);

  return mapLoja(result.recordset[0]);
}

async function updateLoja(id, data) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .input("codigo", sql.Int, data.codigo)
    .input("nome", sql.VarChar(150), data.nome)
    .input("cidade", sql.VarChar(100), data.cidade)
    .input("bairro", sql.VarChar(100), data.bairro || null)
    .input("cnpj", sql.VarChar(20), data.cnpj || null)
    .input("ativo", sql.Bit, data.ativo)
    .query(`
      UPDATE app_lojas
      SET
        codigo = @codigo,
        nome = @nome,
        cidade = @cidade,
        bairro = @bairro,
        cnpj = @cnpj,
        ativo = @ativo,
        updated_at = now()
      WHERE id = @id
      RETURNING
        id,
        codigo,
        nome,
        cidade,
        bairro,
        cnpj,
        ativo,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
    `);

  return mapLoja(result.recordset[0]);
}

async function updateLojaStatus(id, ativo) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .input("ativo", sql.Bit, ativo)
    .query(`
      UPDATE app_lojas
      SET ativo = @ativo, updated_at = now()
      WHERE id = @id
      RETURNING
        id,
        codigo,
        nome,
        cidade,
        bairro,
        cnpj,
        ativo,
        to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
    `);

  return mapLoja(result.recordset[0]);
}

module.exports = {
  createLoja,
  createLocalPermitido,
  deleteLocalPermitido,
  findLojaByCodigo,
  findLojaById,
  getNextCodigo,
  listLocaisPermitidos,
  listLojas,
  updateLoja,
  updateLocalPermitido,
  updateLojaStatus,
};
