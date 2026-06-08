const { getPool, sql } = require("../../db/postgres");
const { ensureConfiguracoesSchema } = require("../../db/schema");

const LOCALIZACAO_KEY = "validacao_localizacao_ativa";

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

module.exports = {
  getLocalizacaoConfig,
  updateLocalizacaoConfig,
};
