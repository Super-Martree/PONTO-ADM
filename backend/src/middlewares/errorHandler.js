const DB_ERROR_CODES = new Set([
  "ECONNCLOSED",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEOUT",
  "ELOGIN",
  "ENOTFOUND",
  "ENOCONN",
  "ENOTOPEN",
  "ESOCKET",
]);

function isDatabaseConnectionError(error) {
  if (!error) return false;

  if (error.name === "ConnectionError") return true;
  if (DB_ERROR_CODES.has(error.code)) return true;
  if (DB_ERROR_CODES.has(error.originalError?.code)) return true;

  return false;
}

function getOperation(req) {
  return req.method === "GET" || req.method === "HEAD" ? "consulta" : "update";
}

function getDatabaseMessage(operation) {
  if (operation === "consulta") {
    return "Nao foi possivel consultar os dados porque o sistema esta sem conexao com o banco de dados. Verifique a conexao com o Supabase e tente novamente.";
  }

  return "Nao foi possivel concluir o update porque o sistema esta sem conexao com o banco de dados. Verifique a conexao com o Supabase e tente novamente.";
}

function errorHandler(error, req, res, next) {
  console.error(error);

  if (isDatabaseConnectionError(error)) {
    const operation = getOperation(req);

    res.status(503).json({
      code: "DB_CONNECTION_ERROR",
      operation,
      message: getDatabaseMessage(operation),
    });
    return;
  }

  if (error.type === "entity.parse.failed" || error.status === 400 || error.statusCode === 400) {
    res.status(400).json({
      message: "JSON invalido na requisicao.",
    });
    return;
  }

  res.status(500).json({
    message: "Erro interno no servidor.",
  });
}

module.exports = errorHandler;
