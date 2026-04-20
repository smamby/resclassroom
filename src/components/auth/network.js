const rateLimit = require('express-rate-limit');
const { Router } = require('express');
const AuthController = require('./controller');

const router = Router();
let _controller;

function getController() {
  if (!_controller) {
    _controller = new AuthController();
  }
  return _controller;
}

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // Máximo 5 intentos
    message: { error: 'Too many login attempts. Please try again in 15 minutes' },
    standardHeaders: true, // Retorna headers RateLimit-*
    legacyHeaders: false,
    // Identificador único por IP + email (opcional, más preciso)
    keyGenerator: (req) => {
        const email = req.body?.email || 'unknown';
        return `${req.ip}:${email}`;
    },
    // No contar los intentos exitosos (opcional)
    skipSuccessfulRequests: true
});

router.post('/register', (req, res) => getController().register(req, res));
router.post('/login', loginLimiter, (req, res) => getController().login(req, res));
router.post('/logout', (req, res) => getController().logout(req, res));

module.exports = router;
