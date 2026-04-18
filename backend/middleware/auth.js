const jwt = require('jsonwebtoken');
const { User, Worker } = require('../models');

/**
 * JWT authentication middleware.
 * SEC-001: Reads token from httpOnly cookie (preferred) or Authorization header (fallback).
 * BUG-007: If user is a contractor, also verifies that worker.status === 'active'.
 */
const auth = async (req, res, next) => {
    try {
        // SEC-001: prefer httpOnly cookie, fall back to Authorization header
        let token = req.cookies?.hmcs_token;
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password_hash'] },
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. User not found.',
            });
        }

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Tu acceso está suspendido.',
            });
        }

        // BUG-007: For contractors, verify worker.status === 'active' on every request.
        // This catches cases where a worker is deactivated after login while their token is still valid.
        if (user.role === 'contractor') {
            const worker = await Worker.findOne({
                where: { user_id: user.id },
                attributes: ['id', 'status'],
            });
            if (worker && worker.status === 'inactive') {
                return res.status(403).json({
                    success: false,
                    message: 'Tu acceso está suspendido.',
                });
            }
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired.',
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token.',
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Internal server error during authentication.',
        });
    }
};

module.exports = auth;
