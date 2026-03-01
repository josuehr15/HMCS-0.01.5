const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Worker } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Register a new user.
 * POST /api/auth/register
 */
const register = async (req, res) => {
    try {
        const { email, password, role, preferred_language } = req.body;

        // Validate required fields
        if (!email || !password || !role) {
            return errorResponse(res, 'Email, password, and role are required.', 400);
        }

        // Validate role
        const validRoles = ['admin', 'contractor', 'client'];
        if (!validRoles.includes(role)) {
            return errorResponse(res, `Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
        }

        // Check if email already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return errorResponse(res, 'Email is already registered.', 409);
        }

        // Hash password with bcrypt
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            email,
            password_hash,
            role,
            preferred_language: preferred_language || 'es',
        });

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        return successResponse(res, {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                preferred_language: user.preferred_language,
            },
            token,
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

        // Validate required fields
        if (!email || !password) {
            return errorResponse(res, 'Email and password are required.', 400);
        }

        // Find user by email
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return errorResponse(res, 'Invalid credentials.', 401);
        }

        // Check if user account is active
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

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return errorResponse(res, 'Invalid credentials.', 401);
        }

        // Update last login timestamp
        await user.update({ last_login_at: new Date() });

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        return successResponse(res, {
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                preferred_language: user.preferred_language,
            },
            token,
        }, 'Login successful.');
    } catch (error) {
        console.error('Login error:', error);
        return errorResponse(res, 'Internal server error.', 500);
    }
};

module.exports = { register, login };
