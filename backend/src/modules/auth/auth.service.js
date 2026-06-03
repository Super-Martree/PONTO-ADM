const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../../config/env");
const { findUserByMatricula } = require("./auth.repository");

const BCRYPT_PREFIXES = ["$2a$", "$2b$", "$2y$"];

function normalizeRole(value) {
  const role = String(value || "funcionario").trim().toLowerCase();

  if (["admin", "administrador", "gestor"].includes(role)) {
    return "admin";
  }

  return "funcionario";
}

async function passwordMatches(inputPassword, storedPassword) {
  const stored = String(storedPassword || "");

  if (!stored) return false;

  if (BCRYPT_PREFIXES.some((prefix) => stored.startsWith(prefix))) {
    return bcrypt.compare(inputPassword, stored);
  }

  const inputBuffer = Buffer.from(String(inputPassword));
  const storedBuffer = Buffer.from(stored);

  if (inputBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, storedBuffer);
}

async function login({ matricula, senha }) {
  const cleanMatricula = String(matricula || "").trim();
  const cleanSenha = String(senha || "");

  if (!/^[A-Za-z0-9._-]{1,30}$/.test(cleanMatricula) || cleanSenha.length < 1 || cleanSenha.length > 128) {
    return null;
  }

  const user = await findUserByMatricula(cleanMatricula);

  if (!user || user.active === false || user.active === 0) {
    return null;
  }

  const validPassword = await passwordMatches(cleanSenha, user.senha);

  if (!validPassword) {
    return null;
  }

  const publicUser = {
    matricula: String(user.matricula),
    name: user.name || `Matricula ${user.matricula}`,
    role: normalizeRole(user.role),
  };

  const token = jwt.sign(publicUser, env.jwt.secret, {
    audience: env.jwt.audience,
    issuer: env.jwt.issuer,
    jwtid: crypto.randomUUID(),
    expiresIn: env.jwt.expiresIn,
  });

  return { token, user: publicUser };
}

async function getUserFromMatricula(matricula) {
  const cleanMatricula = String(matricula || "").trim();
  const user = await findUserByMatricula(cleanMatricula);

  if (!user || user.active === false || user.active === 0) {
    return null;
  }

  return {
    matricula: String(user.matricula),
    name: user.name || `Matricula ${user.matricula}`,
    role: normalizeRole(user.role),
  };
}

module.exports = {
  getUserFromMatricula,
  login,
  passwordMatches,
};
