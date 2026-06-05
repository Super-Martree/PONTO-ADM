const { getPool, sql } = require("../../db/postgres");
const { ensureEscalasConfigColumn } = require("../../db/schema");

const DIA_NOMES = {
  1: "Segunda",
  2: "Terca",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sabado",
  7: "Domingo",
};

function formatMinutes(minutes) {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function parseConfiguracao(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapDia(row) {
  const meta = Number(row.meta_minutos || 0);

  return {
    dia_semana: Number(row.dia_semana),
    dia_nome: DIA_NOMES[row.dia_semana],
    meta_minutos: meta,
    meta_formatada: formatMinutes(meta),
    trabalha: meta > 0,
  };
}

function mapEscalas(rows) {
  const escalas = new Map();

  for (const row of rows) {
    if (!escalas.has(row.id)) {
      escalas.set(row.id, {
        id: row.id,
        nome: row.nome,
        tipo: row.tipo,
        ativo: Boolean(row.ativo),
        configuracao: parseConfiguracao(row.configuracao_json),
        created_at: row.created_at,
        updated_at: row.updated_at,
        dias: [],
      });
    }

    if (row.dia_semana) {
      escalas.get(row.id).dias.push(mapDia(row));
    }
  }

  for (const escala of escalas.values()) {
    escala.dias.sort((a, b) => a.dia_semana - b.dia_semana);
  }

  return [...escalas.values()];
}

async function listEscalas() {
  await ensureEscalasConfigColumn();
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      e.id,
      e.nome,
      e.tipo,
      e.ativo,
      e.configuracao_json,
      to_char(e.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
      to_char(e.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
      d.dia_semana,
      d.meta_minutos
    FROM app_escalas e
    LEFT JOIN app_escala_dias d ON d.escala_id = e.id
    ORDER BY e.ativo DESC, e.nome ASC, d.dia_semana ASC
  `);

  return mapEscalas(result.recordset);
}

async function findEscalaById(id) {
  await ensureEscalasConfigColumn();
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .query(`
      SELECT
        e.id,
        e.nome,
        e.tipo,
        e.ativo,
        e.configuracao_json,
        to_char(e.created_at, 'YYYY-MM-DD HH24:MI:SS') AS created_at,
        to_char(e.updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
        d.dia_semana,
        d.meta_minutos
      FROM app_escalas e
      LEFT JOIN app_escala_dias d ON d.escala_id = e.id
      WHERE e.id = @id
      ORDER BY d.dia_semana ASC
    `);

  return mapEscalas(result.recordset)[0] || null;
}

async function createEscala(data) {
  await ensureEscalasConfigColumn();
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    const escalaResult = await new sql.Request(transaction)
      .input("nome", sql.VarChar(150), data.nome)
      .input("tipo", sql.VarChar(30), data.tipo)
      .input("ativo", sql.Bit, data.ativo)
      .input("configuracaoJson", sql.NVarChar(sql.MAX), JSON.stringify(data.configuracao || null))
      .query(`
        INSERT INTO app_escalas (nome, tipo, ativo, configuracao_json)
        VALUES (@nome, @tipo, @ativo, @configuracaoJson)
        RETURNING id
      `);

    const escalaId = escalaResult.recordset[0].id;

    for (const dia of data.dias) {
      await new sql.Request(transaction)
        .input("escalaId", sql.Int, escalaId)
        .input("diaSemana", sql.TinyInt, dia.dia_semana)
        .input("metaMinutos", sql.Int, dia.meta_minutos)
        .query(`
          INSERT INTO app_escala_dias (escala_id, dia_semana, meta_minutos, ativo)
          VALUES (@escalaId, @diaSemana, @metaMinutos, true)
        `);
    }

    await transaction.commit();
    return findEscalaById(escalaId);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function updateEscala(id, data) {
  await ensureEscalasConfigColumn();
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  await transaction.begin();

  try {
    await new sql.Request(transaction)
      .input("id", sql.Int, id)
      .input("nome", sql.VarChar(150), data.nome)
      .input("tipo", sql.VarChar(30), data.tipo)
      .input("ativo", sql.Bit, data.ativo)
      .input("configuracaoJson", sql.NVarChar(sql.MAX), JSON.stringify(data.configuracao || null))
      .query(`
        UPDATE app_escalas
        SET nome = @nome,
            tipo = @tipo,
            ativo = @ativo,
            configuracao_json = @configuracaoJson,
            updated_at = now()
        WHERE id = @id
      `);

    for (const dia of data.dias) {
      await new sql.Request(transaction)
        .input("escalaId", sql.Int, id)
        .input("diaSemana", sql.TinyInt, dia.dia_semana)
        .input("metaMinutos", sql.Int, dia.meta_minutos)
        .query(`
          INSERT INTO app_escala_dias (escala_id, dia_semana, meta_minutos, ativo)
          VALUES (@escalaId, @diaSemana, @metaMinutos, true)
          ON CONFLICT (escala_id, dia_semana)
          DO UPDATE SET meta_minutos = EXCLUDED.meta_minutos, ativo = true
        `);
    }

    await transaction.commit();
    return findEscalaById(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function updateEscalaStatus(id, ativo) {
  const pool = await getPool();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .input("ativo", sql.Bit, ativo)
    .query(`
      UPDATE app_escalas
      SET ativo = @ativo, updated_at = now()
      WHERE id = @id
      RETURNING id
    `);

  if (!result.recordset[0]) return null;
  return findEscalaById(result.recordset[0].id);
}

module.exports = {
  findEscalaById,
  listEscalas,
  createEscala,
  updateEscala,
  updateEscalaStatus,
};
