const { Pool } = require("pg");
const env = require("../config/env");

const pool = new Pool({
  connectionString: env.db.url,
  ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 600000,
  keepAlive: true,
});

function toPgQuery(query, params) {
  const values = [];
  const indexes = new Map();

  const text = query.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) {
      return match;
    }

    if (!indexes.has(name)) {
      indexes.set(name, values.length + 1);
      values.push(params[name]);
    }

    return `$${indexes.get(name)}`;
  });

  return { text, values };
}

class PgRequest {
  constructor(client = pool) {
    this.client = client?.client || client;
    this.params = {};
  }

  input(name, _type, value) {
    this.params[name] = value;
    return this;
  }

  async query(query) {
    const { text, values } = toPgQuery(query, this.params);
    const result = await this.client.query(text, values);

    return {
      recordset: result.rows,
      rowsAffected: [result.rowCount],
    };
  }
}

class PgTransaction {
  constructor() {
    this.client = null;
  }

  async begin() {
    this.client = await pool.connect();
    await this.client.query("BEGIN");
  }

  async commit() {
    if (!this.client) return;
    try {
      await this.client.query("COMMIT");
    } finally {
      this.client.release();
      this.client = null;
    }
  }

  async rollback() {
    if (!this.client) return;
    try {
      await this.client.query("ROLLBACK");
    } finally {
      this.client.release();
      this.client = null;
    }
  }
}

function typeFactory() {
  return undefined;
}

const sql = {
  BigInt: typeFactory,
  Bit: typeFactory,
  Date: typeFactory,
  Int: typeFactory,
  MAX: "max",
  NVarChar: typeFactory,
  Request: PgRequest,
  TinyInt: typeFactory,
  Transaction: PgTransaction,
  VarChar: typeFactory,
};

async function getPool() {
  return {
    request() {
      return new PgRequest(pool);
    },
    query(query, values) {
      return pool.query(query, values);
    },
  };
}

async function warmPool() {
  await pool.query("SELECT 1");
}

module.exports = {
  getPool,
  sql,
  warmPool,
};
