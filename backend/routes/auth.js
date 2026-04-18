const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login, me, logout } = require('../controllers/authController');
const auth = require('../middleware/auth');

// SEC-002: Rate limiting on login — max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.',
    },
});

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login — rate limited
router.post('/login', loginLimiter, login);

// GET /api/auth/me — returns current user from cookie/token (SEC-001)
router.get('/me', auth, me);

// POST /api/auth/logout — clears httpOnly cookie
router.post('/logout', logout);

module.exports = router;
