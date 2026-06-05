const { getPool } = require("./postgres");

let escalasConfigColumnPromise = null;

function resetPromiseOnFailure(promise, reset) {
  promise.catch(() => {
    reset();
  });
  return promise;
}

async function runEnsureEscalasConfigColumn() {
  const pool = await getPool();
  await pool.request().query(`
    ALTER TABLE app_escalas ADD COLUMN IF NOT EXISTS configuracao_json text NULL
  `);
}

function ensureEscalasConfigColumn() {
  if (!escalasConfigColumnPromise) {
    escalasConfigColumnPromise = resetPromiseOnFailure(
      runEnsureEscalasConfigColumn(),
      () => {
        escalasConfigColumnPromise = null;
      }
    );
  }

  return escalasConfigColumnPromise;
}

module.exports = {
  ensureEscalasConfigColumn,
};
