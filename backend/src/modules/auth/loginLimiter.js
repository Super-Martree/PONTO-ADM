const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map();

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function getKey(req) {
  const matricula = String(req.body?.matricula || "").trim().toLowerCase();
  return `${getClientIp(req)}:${matricula || "unknown"}`;
}

function pruneExpired(now) {
  for (const [key, entry] of attempts.entries()) {
    if (entry.expiresAt <= now) {
      attempts.delete(key);
    }
  }
}

function loginLimiter(req, res, next) {
  const now = Date.now();
  pruneExpired(now);

  const key = getKey(req);
  const entry = attempts.get(key);

  if (entry && entry.count >= MAX_ATTEMPTS && entry.expiresAt > now) {
    const retryAfter = Math.ceil((entry.expiresAt - now) / 1000);
    res.set("Retry-After", String(retryAfter));
    res.status(429).json({ message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    return;
  }

  req.loginLimitKey = key;
  next();
}

function registerFailedLogin(key) {
  if (!key) return;

  const now = Date.now();
  const current = attempts.get(key);

  attempts.set(key, {
    count: current && current.expiresAt > now ? current.count + 1 : 1,
    expiresAt: now + WINDOW_MS,
  });
}

function registerSuccessfulLogin(key) {
  if (key) {
    attempts.delete(key);
  }
}

module.exports = {
  loginLimiter,
  registerFailedLogin,
  registerSuccessfulLogin,
};
