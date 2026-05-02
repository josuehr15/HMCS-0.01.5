const { Op } = require('sequelize');
const { User, Worker, Trade, Assignment, TimeEntry, InvoiceLine, PayrollLine } = require('../models');
const { sequelize } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const generateWorkerCode = require('../utils/generateWorkerCode');
const bcrypt = require('bcryptjs');

/**
 * GET /api/workers
 * Query params:
 *   ?status=active|inactive        → filter by status
 *   ?include_inactive=true         → include inactive (but never deleted_at workers)
 *   ?trade_id=N                    → filter by trade
 *   ?availability=...              → filter by availability
 *   ?page=1&limit=50               → DEUDA-002: pagination (default: no limit for backward compat)
 *
 * DEFAULT: only workers with is_active=true AND deleted_at IS NULL
 * Workers with deleted_at set are NEVER returned — permanently hidden.
 */
const getAllWorkers = async (req, res) => {
    try {
        const { status, trade_id, availability, include_inactive, page, limit } = req.query;

        // Base condition: never show permanently-deleted workers
        const where = { deleted_at: null };

        if (status === 'inactive') {
            where.is_active = false;
        } else if (include_inactive === 'true') {
            // Show all (active + inactive) — but still not deleted
        } else {
            where.is_active = true;
        }

        if (trade_id) where.trade_id = trade_id;
        if (availability) where.availability = availability;

        // DEUDA-002: optional pagination
        const pageNum = parseInt(page, 10) || null;
        const limitNum = Math.min(parseInt(limit, 10) || 500, 500); // hard cap at 500
        const offset = pageNum ? (pageNum - 1) * limitNum : 0;
        const paginationOpts = pageNum ? { limit: limitNum, offset } : {};

        const { count, rows: workers } = await Worker.findAndCountAll({
            where,
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language', 'is_active'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
            ],
            order: [['first_name', 'ASC'], ['last_name', 'ASC']],
            ...paginationOpts,
            distinct: true,
        });

        return res.json({
            success: true,
            data: workers,
            total: count,
            page: pageNum || 1,
            limit: limitNum,
            message: 'Workers retrieved successfully.',
        });
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve workers.', 500);
    }
};

/**
 * GET /api/workers/:id
 */
const getWorkerById = async (req, res) => {
    try {
        const worker = await Worker.findOne({
            where: { id: req.params.id, deleted_at: null },
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language', 'is_active', 'last_login_at'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
                { model: Assignment, as: 'assignments' },
            ],
        });
        if (!worker) return errorResponse(res, 'Worker not found.', 404);
        return successResponse(res, worker, 'Worker retrieved successfully.');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve worker.', 500);
    }
};

/**
 * GET /api/workers/:id/stats
 * Hours and earnings this month + all time (approved entries only).
 */
const getWorkerStats = async (req, res) => {
    try {
        const worker = await Worker.findByPk(req.params.id);
        if (!worker) return errorResponse(res, 'Worker not found.', 404);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthEntries = await TimeEntry.findAll({
            where: {
                worker_id: worker.id,
                status: 'approved',
                clock_in: { [Op.gte]: startOfMonth },
            },
        });

        let totalHoursMonth = 0;
        monthEntries.forEach(e => { if (e.total_hours) totalHoursMonth += parseFloat(e.total_hours); });
        const totalEarnedMonth = totalHoursMonth * parseFloat(worker.hourly_rate);

        const allEntries = await TimeEntry.findAll({
            where: { worker_id: worker.id, status: 'approved' },
        });
        let totalHoursAll = 0;
        allEntries.forEach(e => { if (e.total_hours) totalHoursAll += parseFloat(e.total_hours); });
        const totalEarnedAll = totalHoursAll * parseFloat(worker.hourly_rate);

        return successResponse(res, {
            total_hours_this_month: Math.round(totalHoursMonth * 10) / 10,
            total_earned_this_month: Math.round(totalEarnedMonth * 100) / 100,
            total_hours_all_time: Math.round(totalHoursAll * 10) / 10,
            total_earned_all_time: Math.round(totalEarnedAll * 100) / 100,
        }, 'Worker stats retrieved.');
    } catch (error) {
        // Non-critical — return zeros so cards still render
        return successResponse(res, {
            total_hours_this_month: 0, total_earned_this_month: 0,
            total_hours_all_time: 0, total_earned_all_time: 0,
        }, 'Stats unavailable.');
    }
};

/**
 * GET /api/workers/:id/linked-data
 * Count all records linked to this worker across all tables.
 */
const getWorkerLinkedData = async (req, res) => {
    try {
        const worker = await Worker.findByPk(req.params.id);
        if (!worker) return errorResponse(res, 'Worker not found.', 404);

        const wid = worker.id;
        const [assignments, timeEntries, invoiceLines, payrollLines] = await Promise.all([
            Assignment.count({ where: { worker_id: wid } }).catch(() => 0),
            TimeEntry.count({ where: { worker_id: wid } }).catch(() => 0),
            InvoiceLine.count({ where: { worker_id: wid } }).catch(() => 0),
            PayrollLine.count({ where: { worker_id: wid } }).catch(() => 0),
        ]);

        const total = assignments + timeEntries + invoiceLines + payrollLines;

        return successResponse(res, {
            assignments, time_entries: timeEntries, invoice_lines: invoiceLines, payroll_lines: payrollLines,
            total,
            can_hard_delete: total === 0,
        }, 'Linked data counts retrieved.');
    } catch (error) {
        return errorResponse(res, 'Failed to get linked data.', 500);
    }
};

/**
 * POST /api/workers
 * Create a new worker + user, OR reactivate if email belongs to soft-deleted worker.
 */
const createWorker = async (req, res) => {
    try {
        const {
            email, password, first_name, last_name, phone, trade_id,
            hourly_rate, address, emergency_contact_name, emergency_contact_phone,
            notes, preferred_language,
        } = req.body;

        if (!email || !password || !first_name || !last_name || !phone || !trade_id || !hourly_rate) {
            return errorResponse(res, 'Campos requeridos: email, password, first_name, last_name, phone, trade_id, hourly_rate.', 400);
        }

        const trade = await Trade.findByPk(trade_id);
        if (!trade) return errorResponse(res, 'ID de oficio inválido.', 400);

        // Check existing email
        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
            // Look for a deactivated (not permanently deleted) worker
            const existingWorker = await Worker.findOne({
                where: { user_id: existingUser.id, is_active: false, deleted_at: null },
            });

            if (existingWorker) {
                // ── REACTIVATE ──
                const password_hash = await bcrypt.hash(password, await bcrypt.genSalt(10));

                await existingUser.update({
                    is_active: true,
                    password_hash,
                    preferred_language: preferred_language || existingUser.preferred_language,
                });
                await existingWorker.update({
                    first_name, last_name, phone,
                    trade_id: parseInt(trade_id),
                    hourly_rate: parseFloat(hourly_rate),
                    address: address || existingWorker.address,
                    emergency_contact_name: emergency_contact_name || existingWorker.emergency_contact_name,
                    emergency_contact_phone: emergency_contact_phone || existingWorker.emergency_contact_phone,
                    notes: notes || existingWorker.notes,
                    status: 'active',
                    availability: 'available',
                    is_active: true,
                    deleted_at: null,
                });

                const fullWorker = await Worker.findByPk(existingWorker.id, {
                    include: [
                        { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language', 'is_active'] },
                        { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
                    ],
                });
                return successResponse(res, { ...fullWorker.toJSON(), reactivated: true }, 'Trabajador reactivado exitosamente.', 200);
            }

            // Permanently deleted? treat email as taken by system
            const permanentlyDeleted = await Worker.findOne({
                where: { user_id: existingUser.id, deleted_at: { [Op.ne]: null } },
            });
            if (permanentlyDeleted) {
                return errorResponse(res, 'El email pertenece a un perfil eliminado permanentemente. Usa otro email.', 409);
            }

            // Active worker with that email
            return errorResponse(res, 'El email ya está registrado por un trabajador activo.', 409);
        }

        // ── CREATE NEW ──
        const password_hash = await bcrypt.hash(password, await bcrypt.genSalt(10));
        const user = await User.create({
            email, password_hash, role: 'contractor',
            preferred_language: preferred_language || 'es',
            is_active: true,
        });

        const worker_code = await generateWorkerCode();
        const worker = await Worker.create({
            user_id: user.id, worker_code,
            first_name, last_name, phone,
            trade_id: parseInt(trade_id),
            hourly_rate: parseFloat(hourly_rate),
            address, emergency_contact_name, emergency_contact_phone, notes,
            status: 'active', availability: 'available', is_active: true,
        });

        const fullWorker = await Worker.findByPk(worker.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language', 'is_active'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
            ],
        });
        return successResponse(res, fullWorker, 'Worker created successfully.', 201);
    } catch (error) {
        return errorResponse(res, 'Failed to create worker.', 500);
    }
};

/**
 * PUT /api/workers/:id
 */
const updateWorker = async (req, res) => {
    try {
        const worker = await Worker.findOne({ where: { id: req.params.id, deleted_at: null } });
        if (!worker) return errorResponse(res, 'Worker not found.', 404);

        const {
            first_name, last_name, phone, trade_id, hourly_rate,
            status, availability, address, emergency_contact_name,
            emergency_contact_phone, notes, ssn_encrypted,
        } = req.body;

        if (trade_id && String(trade_id) !== String(worker.trade_id)) {
            const trade = await Trade.findByPk(trade_id);
            if (!trade) return errorResponse(res, 'Invalid trade_id.', 400);
        }

        const newStatus = status || worker.status;
        const newIsActive = newStatus === 'active';

        await worker.update({
            first_name: first_name || worker.first_name,
            last_name: last_name || worker.last_name,
            phone: phone || worker.phone,
            trade_id: trade_id || worker.trade_id,
            hourly_rate: hourly_rate !== undefined ? hourly_rate : worker.hourly_rate,
            status: newStatus,
            is_active: newIsActive,
            availability: availability || worker.availability,
            address: address !== undefined ? address : worker.address,
            emergency_contact_name: emergency_contact_name !== undefined ? emergency_contact_name : worker.emergency_contact_name,
            emergency_contact_phone: emergency_contact_phone !== undefined ? emergency_contact_phone : worker.emergency_contact_phone,
            notes: notes !== undefined ? notes : worker.notes,
            ssn_encrypted: ssn_encrypted !== undefined ? ssn_encrypted : worker.ssn_encrypted,
        });

        await User.update({ is_active: newIsActive }, { where: { id: worker.user_id } });

        const updatedWorker = await Worker.findByPk(worker.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language', 'is_active'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
            ],
        });
        return successResponse(res, updatedWorker, 'Worker updated successfully.');
    } catch (error) {
        return errorResponse(res, 'Failed to update worker.', 500);
    }
};

/**
 * PATCH /api/workers/:id/toggle-status
 * Soft toggle: active ↔ inactive. Never deletes anything.
 */
const toggleWorkerStatus = async (req, res) => {
    try {
        const worker = await Worker.findOne({ where: { id: req.params.id, deleted_at: null } });
        if (!worker) return errorResponse(res, 'Worker not found.', 404);

        const newStatus = worker.status === 'active' ? 'inactive' : 'active';
        const newIsActive = newStatus === 'active';

        await worker.update({ status: newStatus, is_active: newIsActive });
        await User.update({ is_active: newIsActive }, { where: { id: worker.user_id } });

        const updated = await Worker.findByPk(worker.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language', 'is_active'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
            ],
        });

        const message = newStatus === 'active'
            ? 'Trabajador reactivado exitosamente.'
            : 'Trabajador desactivado exitosamente.';

        return successResponse(res, updated, message);
    } catch (error) {
        return errorResponse(res, 'Failed to toggle worker status.', 500);
    }
};

/**
 * DELETE /api/workers/:id
 * LEVEL 1 only — soft deactivate (sets is_active=false, status=inactive).
 * This is the "Desactivar" action, not "Eliminar".
 *
 * Note: Real deletion (levels 2&3) is handled by forceDeleteWorker.
 */
const deleteWorker = async (req, res) => {
    try {
        const worker = await Worker.findOne({ where: { id: req.params.id, is_active: true, deleted_at: null } });
        if (!worker) return errorResponse(res, 'Worker not found or already inactive.', 404);

        await worker.update({ is_active: false, status: 'inactive' });
        await User.update({ is_active: false }, { where: { id: worker.user_id } });

        return successResponse(res, {
            id: worker.id, worker_code: worker.worker_code, action: 'deactivated',
        }, 'Trabajador desactivado.');
    } catch (error) {
        return errorResponse(res, 'Failed to deactivate worker.', 500);
    }
};

/**
 * DELETE /api/workers/:id/force
 * 3-level deletion logic:
 *
 * Requires `worker_code` confirmation via body or query.
 *
 * LEVEL 2 (no linked data) → hard delete: Worker + User removed from DB. Email freed.
 * LEVEL 3 (has linked data) → permanent hide: sets deleted_at = NOW(). Data stays intact.
 */
const forceDeleteWorker = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const confirmed_code = req.body?.confirmed_code || req.query?.confirmed_code;

        const worker = await Worker.findOne({
            where: { id: req.params.id, deleted_at: null },
            include: [{ model: User, as: 'user' }],
            transaction: t,
        });

        if (!worker) {
            await t.rollback();
            return errorResponse(res, 'Worker not found.', 404);
        }

        if (confirmed_code !== worker.worker_code) {
            await t.rollback();
            return errorResponse(res, 'El código del trabajador no coincide.', 400);
        }

        // Count ALL linked data across all tables
        const [assignments, timeEntries, invoiceLines, payrollLines] = await Promise.all([
            Assignment.count({ where: { worker_id: worker.id }, transaction: t }).catch(() => 0),
            TimeEntry.count({ where: { worker_id: worker.id }, transaction: t }).catch(() => 0),
            InvoiceLine.count({ where: { worker_id: worker.id }, transaction: t }).catch(() => 0),
            PayrollLine.count({ where: { worker_id: worker.id }, transaction: t }).catch(() => 0),
        ]);
        const totalLinked = assignments + timeEntries + invoiceLines + payrollLines;

        if (totalLinked > 0) {
            // ── LEVEL 3: Has data → permanently hide (never reappear) ──
            await worker.update({
                is_active: false,
                status: 'inactive',
                deleted_at: new Date(),
                notes: `[OCULTO PERMANENTEMENTE ${new Date().toISOString()}] ${worker.notes || ''}`.trim(),
            }, { transaction: t });
            // Deactivate user but keep email (data integrity for reports)
            await User.update({ is_active: false }, { where: { id: worker.user_id }, transaction: t });

            await t.commit();
            return successResponse(res, {
                id: worker.id, worker_code: worker.worker_code,
                action: 'hidden',
                linked_data: { assignments, time_entries: timeEntries, invoice_lines: invoiceLines, payroll_lines: payrollLines, total: totalLinked },
            }, 'Trabajador ocultado permanentemente. Los datos vinculados se conservan.');
        }

        // ── LEVEL 2: No linked data → hard delete ──
        const userId = worker.user_id;
        await worker.destroy({ transaction: t });
        if (userId) {
            await User.destroy({ where: { id: userId }, transaction: t });
        }

        await t.commit();
        return successResponse(res, {
            id: worker.id, worker_code: worker.worker_code, action: 'deleted',
        }, 'Trabajador eliminado permanentemente. El email ha quedado libre.');
    } catch (error) {
        await t.rollback();
        return errorResponse(res, 'Failed to permanently delete worker.', 500);
    }
};

/**
 * PUT /api/workers/:id/reset-password
 */
const resetWorkerPassword = async (req, res) => {
    try {
        const worker = await Worker.findOne({
            where: { id: req.params.id, deleted_at: null },
            include: [{ model: User, as: 'user' }],
        });
        if (!worker) return errorResponse(res, 'Worker not found.', 404);

        const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
        let tempPassword = 'hmcs-';
        for (let i = 0; i < 6; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

        const password_hash = await bcrypt.hash(tempPassword, await bcrypt.genSalt(10));
        await worker.user.update({ password_hash });

        return successResponse(res, {
            temporary_password: tempPassword,
            worker_code: worker.worker_code,
            worker_name: `${worker.first_name} ${worker.last_name}`,
        }, 'Contraseña reseteada exitosamente.');
    } catch (error) {
        return errorResponse(res, 'Failed to reset password.', 500);
    }
};

module.exports = {
    getAllWorkers,
    getWorkerById,
    createWorker,
    updateWorker,
    deleteWorker,
    toggleWorkerStatus,
    forceDeleteWorker,
    resetWorkerPassword,
    getWorkerLinkedData,
    getWorkerStats,
};
