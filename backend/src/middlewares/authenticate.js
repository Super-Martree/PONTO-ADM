const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { parseCookies } = require("../utils/cookies");

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[env.cookie.name];
  const authToken = type === "Bearer" ? token : cookieToken;

  if (!authToken) {
    res.status(401).json({ message: "Token ausente." });
    return;
  }

  try {
    req.user = jwt.verify(authToken, env.jwt.secret, {
      audience: env.jwt.audience,
      issuer: env.jwt.issuer,
    });
    next();
  } catch {
    res.status(401).json({ message: "Token invalido." });
  }
}

module.exports = authenticate;
