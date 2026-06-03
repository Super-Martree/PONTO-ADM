const express = require("express");
const { getUserFromMatricula, login } = require("./auth.service");
const authenticate = require("../../middlewares/authenticate");
const env = require("../../config/env");
const { parseDurationMs } = require("../../utils/cookies");
const {
  loginLimiter,
  registerFailedLogin,
  registerSuccessfulLogin,
} = require("./loginLimiter");

const router = express.Router();

const authCookieOptions = {
  httpOnly: true,
  secure: env.cookie.secure,
  sameSite: env.cookie.sameSite,
  maxAge: parseDurationMs(env.jwt.expiresIn),
  path: "/",
};

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const result = await login(req.body || {});

    if (!result) {
      registerFailedLogin(req.loginLimitKey);
      res.status(401).json({ message: "Credenciais invalidas." });
      return;
    }

    registerSuccessfulLogin(req.loginLimitKey);
    res.cookie(env.cookie.name, result.token, authCookieOptions);
    res.json({ user: result.user });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await getUserFromMatricula(req.user?.matricula);

    if (!user) {
      res.status(401).json({ message: "Sessao invalida." });
      return;
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie(env.cookie.name, { ...authCookieOptions, maxAge: undefined });
  res.status(204).send();
});

module.exports = router;
