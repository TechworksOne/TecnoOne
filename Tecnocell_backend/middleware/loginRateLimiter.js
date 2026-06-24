const rateLimit = require('express-rate-limit');

const loginRateLimiter = rateLimit({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5),

  standardHeaders: true,
  legacyHeaders: false,

  // Solo cuenta intentos fallidos. Si el login fue exitoso, no castiga al usuario.
  skipSuccessfulRequests: true,

  message: {
    message: 'Demasiados intentos de inicio de sesión. Intente nuevamente en unos minutos.',
  },

  handler: (req, res, next, options) => {
    return res.status(options.statusCode).json(options.message);
  },
});

module.exports = loginRateLimiter;
