const express = require('express');
const router = express.Router();
const path = require('path');
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const uploadLogo = require('../middleware/uploadLogo');
const CompanySettings = require('../models/CompanySettings');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// ── GET /api/settings — admin only ──────────────────────────────────────────
router.get('/', auth, checkRole('admin'), async (req, res) => {
    try {
        let settings = await CompanySettings.findOne({ where: { id: 1 } });
        if (!settings) {
            settings = await CompanySettings.create({ id: 1 });
        }
        return successResponse(res, settings);
    } catch (err) {
        console.error('GET /settings error:', err);
        return errorResponse(res, 'Error al obtener configuración.', 500);
    }
});

// ── PUT /api/settings — admin only ──────────────────────────────────────────
router.put('/', auth, checkRole('admin'), async (req, res) => {
    try {
        const allowed = [
            'company_name', 'address', 'city', 'state', 'zip',
            'email', 'phone', 'logo_url',
            'logo_horizontal_url', 'logo_square_url',
            'invoice_prefix', 'payment_terms_days', 'payment_instructions',
            'invoice_footer_note',
            'standard_hours_per_week', 'default_ot_multiplier',
            'default_payment_method', 'week_start_day',
            'notification_preferences',
        ];
        const updates = {};
        allowed.forEach(key => {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        });

        let settings = await CompanySettings.findOne({ where: { id: 1 } });
        if (!settings) {
            settings = await CompanySettings.create({ id: 1, ...updates });
        } else {
            await settings.update(updates);
        }
        return successResponse(res, settings, 'Configuración actualizada.');
    } catch (err) {
        console.error('PUT /settings error:', err);
        return errorResponse(res, 'Error al guardar configuración.', 500);
    }
});

// ── POST /api/settings/logo/horizontal — upload horizontal logo ──────────────
router.post(
    '/logo/horizontal',
    auth,
    checkRole('admin'),
    (req, res, next) => {
        uploadLogo.single('logo')(req, res, (err) => {
            if (err) {
                return errorResponse(res, err.message || 'Error al subir imagen.', 400);
            }
            next();
        });
    },
    async (req, res) => {
        try {
            if (!req.file) {
                return errorResponse(res, 'No se recibió ningún archivo.', 400);
            }
            const url = `/uploads/logos/${req.file.filename}`;
            let settings = await CompanySettings.findOne({ where: { id: 1 } });
            if (!settings) {
                settings = await CompanySettings.create({ id: 1, logo_horizontal_url: url });
            } else {
                await settings.update({ logo_horizontal_url: url });
            }
            return successResponse(res, { url }, 'Logo horizontal actualizado.');
        } catch (err) {
            console.error('POST /settings/logo/horizontal error:', err);
            return errorResponse(res, 'Error al guardar logo.', 500);
        }
    },
);

// ── POST /api/settings/logo/square — upload square logo ─────────────────────
router.post(
    '/logo/square',
    auth,
    checkRole('admin'),
    (req, res, next) => {
        uploadLogo.single('logo')(req, res, (err) => {
            if (err) {
                return errorResponse(res, err.message || 'Error al subir imagen.', 400);
            }
            next();
        });
    },
    async (req, res) => {
        try {
            if (!req.file) {
                return errorResponse(res, 'No se recibió ningún archivo.', 400);
            }
            const url = `/uploads/logos/${req.file.filename}`;
            let settings = await CompanySettings.findOne({ where: { id: 1 } });
            if (!settings) {
                settings = await CompanySettings.create({ id: 1, logo_square_url: url });
            } else {
                await settings.update({ logo_square_url: url });
            }
            return successResponse(res, { url }, 'Logo cuadrado actualizado.');
        } catch (err) {
            console.error('POST /settings/logo/square error:', err);
            return errorResponse(res, 'Error al guardar logo.', 500);
        }
    },
);

// ── PUT /api/settings/change-password — admin only ──────────────────────────
router.put('/change-password', auth, checkRole('admin'), async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return errorResponse(res, 'current_password y new_password son requeridos.', 400);
    }
    if (new_password.length < 6) {
        return errorResponse(res, 'La nueva contraseña debe tener al menos 6 caracteres.', 400);
    }
    try {
        const user = await User.findByPk(req.user.id);
        if (!user) return errorResponse(res, 'Usuario no encontrado.', 404);

        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) return errorResponse(res, 'Contraseña actual incorrecta.', 401);

        const hash = await bcrypt.hash(new_password, 10);
        await user.update({ password_hash: hash });
        return successResponse(res, null, 'Contraseña actualizada correctamente.');
    } catch (err) {
        console.error('PUT /settings/change-password error:', err);
        return errorResponse(res, 'Error al cambiar contraseña.', 500);
    }
});

module.exports = router;
