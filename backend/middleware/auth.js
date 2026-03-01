const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * JWT authentication middleware.
 * Verifies the token from Authorization header and attaches user to req.user.
 */
const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
            });
        }

        const token = authHeader.split(' ')[1];

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
