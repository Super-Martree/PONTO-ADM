const app = require("./app");
const env = require("./config/env");
const { warmPool } = require("./db/postgres");
const { ensureFuncionarioSchema } = require("./modules/funcionarios/funcionarios.repository");

async function start() {
  const startedAt = Date.now();
  await warmPool();
  await ensureFuncionarioSchema();

  app.listen(env.port, env.host, () => {
    console.log(`API rodando em http://${env.host}:${env.port}`);
    console.log(`Banco aquecido e schema verificado em ${Date.now() - startedAt}ms`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
