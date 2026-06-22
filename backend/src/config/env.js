const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }

  return value;
}

function validateJwtSecret(secret) {
  const weakDevSecret = "martree-ponto-local-dev-secret-change-me";
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && (secret === weakDevSecret || secret.length < 32)) {
    throw new Error("JWT_SECRET inseguro para producao. Use um segredo forte com pelo menos 32 caracteres.");
  }
}

const jwtSecret = required("JWT_SECRET");
validateJwtSecret(jwtSecret);

const defaultFrontendOrigins = [
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "http://192.168.18.75:3002",
];

const configuredFrontendOrigins = (process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 3335),
  frontendOrigins: [...new Set([...configuredFrontendOrigins, ...defaultFrontendOrigins])],
  db: {
    server: process.env.DB_HOST || process.env.SQLSERVER_HOST || required("DB_HOST"),
    port: Number(process.env.DB_PORT || process.env.SQLSERVER_PORT || 1433),
    database: process.env.DB_NAME || process.env.SQLSERVER_DATABASE || required("DB_NAME"),
    user: process.env.DB_USER || process.env.SQLSERVER_USER || required("DB_USER"),
    password: process.env.DB_PASSWORD || process.env.SQLSERVER_PASSWORD || required("DB_PASSWORD"),
    encrypt: String(process.env.DB_ENCRYPT || "false").toLowerCase() === "true",
    trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERTIFICATE || "true").toLowerCase() === "true",
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
    issuer: process.env.JWT_ISSUER || "martree-ponto-api",
    audience: process.env.JWT_AUDIENCE || "martree-ponto-web",
  },
  cookie: {
    name: process.env.AUTH_COOKIE_NAME || "martree_auth",
    secure: String(process.env.AUTH_COOKIE_SECURE || "false").toLowerCase() === "true",
    sameSite: process.env.AUTH_COOKIE_SAME_SITE || "strict",
  },
  auth: {
    table: process.env.AUTH_TABLE || "Usuarios",
    matriculaColumn: process.env.AUTH_MATRICULA_COLUMN || "Matricula",
    passwordColumn: process.env.AUTH_PASSWORD_COLUMN || "Senha",
    nameColumn: process.env.AUTH_NAME_COLUMN || "Nome",
    roleColumn: process.env.AUTH_ROLE_COLUMN || "Perfil",
    activeColumn: process.env.AUTH_ACTIVE_COLUMN || "Ativo",
  },
};
