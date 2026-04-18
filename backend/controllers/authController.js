const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Worker } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// SEC-001: cookie options — httpOnly prevents JS access (XSS protection)
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
};

/**
 * Register a new user.
 * POST /api/auth/register
 */
const register = async (req, res) => {
    try {
        const { email, password, role, preferred_language } = req.body;

        if (!email || !password || !role) {
            return errorResponse(res, 'Email, password, and role are required.', 400);
        }

        const validRoles = ['admin', 'contractor', 'client'];
        if (!validRoles.includes(role)) {
            return errorResponse(res, `Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return errorResponse(res, 'Email is already registered.', 409);
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const user = await User.create({
            email,
            password_hash,
            role,
            preferred_language: preferred_language || 'es',
        });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // SEC-001: set httpOnly cookie
        res.cookie('hmcs_token', token, cookieOptions);

        return successResponse(res, {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                preferred_language: user.preferred_language,
            },
            token, // still returned in body for backward compat with existing frontend
        }, 'User registered successfully.', 201);
    } catch (error) {
        console.error('Register error:', error);
        return errorResponse(res, 'Internal server error.', 500);
    }
};

/**
 * Login an existing user.
 * POST /api/auth/login
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return errorResponse(res, 'Email and password are required.', 400);
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return errorResponse(res, 'Invalid credentials.', 401);
        }

        if (!user.is_active) {
            return errorResponse(res, 'Tu acceso está suspendido.', 403);
        }

        // CRITICAL RULE: If user is a contractor, check worker status
        if (user.role === 'contractor') {
            const worker = await Worker.findOne({ where: { user_id: user.id } });
            if (worker && worker.status === 'inactive') {
                return errorResponse(res, 'Tu acceso está suspendido.', 403);
            }
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return errorResponse(res, 'Invalid credentials.', 401);
        }

        await user.update({ last_login_at: new Date() });

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        // SEC-001: set httpOnly cookie
        res.cookie('hmcs_token', token, cookieOptions);

        return successResponse(res, {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                preferred_language: user.preferred_language,
            },
            token, // still returned in body for backward compat
        }, 'Login successful.');
    } catch (error) {
        console.error('Login error:', error);
        return errorResponse(res, 'Internal server error.', 500);
    }
};

/**
 * Get current authenticated user.
 * GET /api/auth/me
 * SEC-001: allows frontend to restore session from cookie on page load.
 */
const me = async (req, res) => {
    try {
        return successResponse(res, {
            user: {
                id: req.user.id,
                email: req.user.email,
                role: req.user.role,
                preferred_language: req.user.preferred_language,
            },
        }, 'Authenticated.');
    } catch (error) {
        console.error('Me error:', error);
        return errorResponse(res, 'Internal server error.', 500);
    }
};

/**
 * Logout — clear the httpOnly cookie.
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
    res.clearCookie('hmcs_token', { ...cookieOptions, maxAge: 0 });
    return successResponse(res, null, 'Logged out successfully.');
};

module.exports = { register, login, me, logout };
