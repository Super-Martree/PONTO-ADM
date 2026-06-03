const app = require("./app");
const env = require("./config/env");
const { ensureFuncionarioSchema } = require("./modules/funcionarios/funcionarios.repository");

async function start() {
  await ensureFuncionarioSchema();

  app.listen(env.port, env.host, () => {
    console.log(`API rodando em http://${env.host}:${env.port}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
