const env = require("../../config/env");
const { getPool, sql } = require("../../db/postgres");
const { sqlIdentifier } = require("../../utils/identifier");

async function findUserByMatricula(matricula) {
  const table = sqlIdentifier(env.auth.table);
  const matriculaColumn = sqlIdentifier(env.auth.matriculaColumn);
  const passwordColumn = sqlIdentifier(env.auth.passwordColumn);
  const nameColumn = sqlIdentifier(env.auth.nameColumn);
  const roleColumn = sqlIdentifier(env.auth.roleColumn);
  const activeColumn = sqlIdentifier(env.auth.activeColumn);
  const pool = await getPool();

  const result = await pool.request()
    .input("matricula", sql.VarChar, matricula)
    .query(`
      SELECT
        ${matriculaColumn} AS matricula,
        ${passwordColumn} AS senha,
        ${nameColumn} AS name,
        ${roleColumn} AS role,
        ${activeColumn} AS active
      FROM ${table}
      WHERE ${matriculaColumn} = @matricula
      LIMIT 1
    `);

  return result.recordset[0] || null;
}

module.exports = {
  findUserByMatricula,
};
