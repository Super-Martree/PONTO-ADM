const sql = require("mssql");
const env = require("../config/env");

const config = {
  server: env.db.server,
  port: env.db.port,
  database: env.db.database,
  user: env.db.user,
  password: env.db.password,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 600000,
  },
  options: {
    encrypt: env.db.encrypt,
    trustServerCertificate: env.db.trustServerCertificate,
  },
};

let poolPromise = null;

async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }

  return poolPromise;
}

async function warmPool() {
  const pool = await getPool();
  await pool.request().query("SELECT 1 AS ok");
}

module.exports = {
  getPool,
  sql,
  warmPool,
};
