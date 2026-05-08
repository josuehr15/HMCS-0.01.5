const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User, Worker } = require('../models');
const { getNotifications, streamNotifications } = require('../controllers/notificationController');
const auth = require('../middleware/auth');

// ─── Auth middleware para SSE ─────────────────────────────────────────────────
// SEC-002: Preferir httpOnly cookie sobre query param para no exponer el JWT
// en logs del servidor, browser history ni redes intermedias.
// Fallback a query param mantenido por compatibilidad con clientes que no tengan
// la cookie seteada (primer login, cross-origin dev).
const authSSE = async (req, res, next) => {
    try {
        // Primero: cookie httpOnly (más seguro)
        // Segundo: query param (fallback — se eliminará en v2)
        const token = req.cookies?.hmcs_token || req.query.token;
        if (!token) {
            res.status(401).end('Unauthorized');
            return;
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password_hash'] },
        });
        if (!user || !user.is_active) {
            res.status(401).end('Unauthorized');
            return;
        }
        // Contractors deben tener worker activo
        if (user.role === 'contractor') {
            const worker = await Worker.findOne({ where: { user_id: user.id } });
            if (!worker || worker.status !== 'active') {
                res.status(403).end('Forbidden');
                return;
            }
        }
        req.user = user;
        next();
    } catch (err) {
        res.status(401).end('Unauthorized');
    }
};

// GET /api/notifications        → REST (fallback / uso manual)
router.get('/', auth, getNotifications);

// GET /api/notifications/stream → SSE tiempo real
// IMPORTANTE: debe ir ANTES de cualquier ruta con parámetros dinámicos
router.get('/stream', authSSE, streamNotifications);

module.exports = router;
