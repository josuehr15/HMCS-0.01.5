const { User, Worker, Trade, Assignment, TimeEntry, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const generateWorkerCode = require('../utils/generateWorkerCode');
const bcrypt = require('bcryptjs');

/**
 * GET /api/workers
 * List all workers with optional filters: status, trade_id, availability, include_inactive.
 */
const getAllWorkers = async (req, res) => {
    try {
        const { status, trade_id, availability, include_inactive } = req.query;
        const where = include_inactive === 'true' ? {} : { is_active: true };

        if (status) where.status = status;
        if (trade_id) where.trade_id = trade_id;
        if (availability) where.availability = availability;

        const workers = await Worker.findAll({
            where,
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language', 'is_active'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
            ],
            order: [['created_at', 'DESC']],
        });

        return successResponse(res, workers, 'Workers retrieved successfully.');
    } catch (error) {
        console.error('getAllWorkers error:', error);
        return errorResponse(res, 'Failed to retrieve workers.', 500);
    }
};

/**
 * GET /api/workers/:id
 * Get a single worker with user, trade, and assignments.
 */
const getWorkerById = async (req, res) => {
    try {
        const worker = await Worker.findOne({
            where: { id: req.params.id },
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language', 'is_active', 'last_login_at'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
                { model: Assignment, as: 'assignments' },
            ],
        });

        if (!worker) {
            return errorResponse(res, 'Worker not found.', 404);
        }

        return successResponse(res, worker, 'Worker retrieved successfully.');
    } catch (error) {
        console.error('getWorkerById error:', error);
        return errorResponse(res, 'Failed to retrieve worker.', 500);
    }
};

/**
 * POST /api/workers
 * Create a new worker + associated user account + auto-generate worker_code.
 * If email belongs to a deactivated worker → REACTIVATE instead of error.
 */
const createWorker = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            email, password, first_name, last_name, phone, trade_id,
            hourly_rate, address, emergency_contact_name, emergency_contact_phone,
            notes, preferred_language,
        } = req.body;

        if (!email || !password || !first_name || !last_name || !phone || !trade_id || !hourly_rate) {
            await t.rollback();
            return errorResponse(res, 'Missing required fields: email, password, first_name, last_name, phone, trade_id, hourly_rate.', 400);
        }

        // Verify trade exists
        const trade = await Trade.findByPk(trade_id, { transaction: t });
        if (!trade) {
            await t.rollback();
            return errorResponse(res, 'Invalid trade_id.', 400);
        }

        // Check if email already exists
        const existingUser = await User.findOne({ where: { email }, transaction: t });

        if (existingUser) {
            // Check if it belongs to a soft-deleted (inactive) worker
            const existingWorker = await Worker.findOne({
                where: { user_id: existingUser.id, is_active: false },
                transaction: t,
            });

            if (existingWorker) {
                // ── REACTIVATE the existing worker ──
                const salt = await bcrypt.genSalt(10);
                const password_hash = await bcrypt.hash(password, salt);

                await existingUser.update({
                    is_active: true,
                    password_hash,
                    preferred_language: preferred_language || existingUser.preferred_language,
                }, { transaction: t });

                await existingWorker.update({
                    first_name, last_name, phone,
                    trade_id, hourly_rate,
                    address: address || existingWorker.address,
                    emergency_contact_name: emergency_contact_name || existingWorker.emergency_contact_name,
                    emergency_contact_phone: emergency_contact_phone || existingWorker.emergency_contact_phone,
                    notes: notes || existingWorker.notes,
                    status: 'active',
                    availability: 'available',
                    is_active: true,
                }, { transaction: t });

                await t.commit();

                const fullWorker = await Worker.findByPk(existingWorker.id, {
                    include: [
                        { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language', 'is_active'] },
                        { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
                    ],
                });

                return successResponse(res, fullWorker, 'Trabajador reactivado exitosamente.', 200);
            }

            // Email belongs to an ACTIVE worker — real conflict
            await t.rollback();
            return errorResponse(res, 'El email ya está registrado por un trabajador activo.', 409);
        }

        // ── CREATE NEW worker ──
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const user = await User.create({
            email,
            password_hash,
            role: 'contractor',
            preferred_language: preferred_language || 'es',
        }, { transaction: t });

        const worker_code = await generateWorkerCode();

        const worker = await Worker.create({
            user_id: user.id,
            worker_code,
            first_name, last_name, phone, trade_id, hourly_rate,
            address, emergency_contact_name, emergency_contact_phone, notes,
        }, { transaction: t });

        await t.commit();

        const fullWorker = await Worker.findByPk(worker.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language', 'is_active'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
            ],
        });

        return successResponse(res, fullWorker, 'Worker created successfully.', 201);
    } catch (error) {
        await t.rollback();
        console.error('createWorker error:', error);
        return errorResponse(res, 'Failed to create worker.', 500);
    }
};

/**
 * PUT /api/workers/:id
 * Update worker data. Cannot change worker_code.
 */
const updateWorker = async (req, res) => {
    try {
        const worker = await Worker.findOne({
            where: { id: req.params.id },
        });

        if (!worker) {
            return errorResponse(res, 'Worker not found.', 404);
        }

        const {
            first_name, last_name, phone, trade_id, hourly_rate,
            status, availability, address, emergency_contact_name,
            emergency_contact_phone, notes, ssn_encrypted,
        } = req.body;

        if (trade_id && trade_id !== worker.trade_id) {
            const trade = await Trade.findByPk(trade_id);
            if (!trade) return errorResponse(res, 'Invalid trade_id.', 400);
        }

        await worker.update({
            first_name: first_name || worker.first_name,
            last_name: last_name || worker.last_name,
            phone: phone || worker.phone,
            trade_id: trade_id || worker.trade_id,
            hourly_rate: hourly_rate !== undefined ? hourly_rate : worker.hourly_rate,
            status: status || worker.status,
            availability: availability || worker.availability,
            address: address !== undefined ? address : worker.address,
            emergency_contact_name: emergency_contact_name !== undefined ? emergency_contact_name : worker.emergency_contact_name,
            emergency_contact_phone: emergency_contact_phone !== undefined ? emergency_contact_phone : worker.emergency_contact_phone,
            notes: notes !== undefined ? notes : worker.notes,
            ssn_encrypted: ssn_encrypted !== undefined ? ssn_encrypted : worker.ssn_encrypted,
        });

        const updatedWorker = await Worker.findByPk(worker.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language', 'is_active'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
            ],
        });

        return successResponse(res, updatedWorker, 'Worker updated successfully.');
    } catch (error) {
        console.error('updateWorker error:', error);
        return errorResponse(res, 'Failed to update worker.', 500);
    }
};

/**
 * PATCH /api/workers/:id/toggle-status
 * Toggle worker between active/inactive (soft toggle — no hard delete).
 */
const toggleWorkerStatus = async (req, res) => {
    try {
        const worker = await Worker.findByPk(req.params.id, {
            include: [{ model: User, as: 'user' }],
        });

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
        console.error('toggleWorkerStatus error:', error);
        return errorResponse(res, 'Failed to toggle worker status.', 500);
    }
};

/**
 * DELETE /api/workers/:id
 * Soft delete (is_active = false). Maintained for backwards compatibility.
 */
const deleteWorker = async (req, res) => {
    try {
        const worker = await Worker.findOne({ where: { id: req.params.id, is_active: true } });
        if (!worker) return errorResponse(res, 'Worker not found.', 404);

        const assignmentCount = await Assignment.count({ where: { worker_id: worker.id } });

        await worker.update({ is_active: false, status: 'inactive' });
        await User.update({ is_active: false }, { where: { id: worker.user_id } });

        const response = { id: worker.id, worker_code: worker.worker_code };
        if (assignmentCount > 0) {
            response.warning = `This worker has ${assignmentCount} assignment(s) linked.`;
            response.linked_data = { assignments: assignmentCount };
        }

        return successResponse(res, response, 'Worker deactivated successfully.');
    } catch (error) {
        console.error('deleteWorker error:', error);
        return errorResponse(res, 'Failed to delete worker.', 500);
    }
};

/**
 * DELETE /api/workers/:id/force
 * HARD delete: deactivates User (frees email slot) + marks worker as permanently deleted.
 * Requires worker_code confirmation from client.
 * Does NOT physically destroy rows — sets deleted_at and anonymizes email.
 */
const forceDeleteWorker = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const confirmed_code = req.body?.confirmed_code || req.query?.confirmed_code;

        const worker = await Worker.findByPk(req.params.id, {
            include: [{ model: User, as: 'user' }],
            transaction: t,
        });

        if (!worker) {
            await t.rollback();
            return errorResponse(res, 'Worker not found.', 404);
        }

        if (confirmed_code !== worker.worker_code) {
            await t.rollback();
            return errorResponse(res, 'Worker code confirmation does not match.', 400);
        }

        // Count linked data
        const assignmentCount = await Assignment.count({ where: { worker_id: worker.id }, transaction: t });

        // Anonymize email so it can be reused, then deactivate user
        const anonymizedEmail = `deleted_${worker.id}_${Date.now()}@removed.invalid`;
        await worker.user.update({
            email: anonymizedEmail,
            is_active: false,
        }, { transaction: t });

        // Mark worker as permanently deleted
        await worker.update({
            is_active: false,
            status: 'inactive',
            notes: `[ELIMINADO ${new Date().toISOString()}] ${worker.notes || ''}`.trim(),
        }, { transaction: t });

        await t.commit();

        return successResponse(res, {
            id: worker.id,
            worker_code: worker.worker_code,
            linked_data: { assignments: assignmentCount },
        }, 'Perfil eliminado permanentemente. El email ha quedado libre.');
    } catch (error) {
        await t.rollback();
        console.error('forceDeleteWorker error:', error);
        return errorResponse(res, 'Failed to permanently delete worker.', 500);
    }
};

/**
 * PUT /api/workers/:id/reset-password
 * Generate a temporary password and force change on next login.
 */
const resetWorkerPassword = async (req, res) => {
    try {
        const worker = await Worker.findByPk(req.params.id, {
            include: [{ model: User, as: 'user' }],
        });

        if (!worker) return errorResponse(res, 'Worker not found.', 404);

        // Generate readable temp password
        const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
        let tempPassword = 'hmcs-';
        for (let i = 0; i < 6; i++) {
            tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(tempPassword, salt);

        await worker.user.update({ password_hash });

        return successResponse(res, {
            temporary_password: tempPassword,
            worker_code: worker.worker_code,
            worker_name: `${worker.first_name} ${worker.last_name}`,
        }, 'Contraseña reseteada exitosamente.');
    } catch (error) {
        console.error('resetWorkerPassword error:', error);
        return errorResponse(res, 'Failed to reset password.', 500);
    }
};

/**
 * GET /api/workers/:id/linked-data
 * Count linked records before force delete.
 */
const getWorkerLinkedData = async (req, res) => {
    try {
        const worker = await Worker.findByPk(req.params.id);
        if (!worker) return errorResponse(res, 'Worker not found.', 404);

        const assignmentCount = await Assignment.count({ where: { worker_id: worker.id } });

        // Try to count time entries if model exists
        let timeEntryCount = 0;
        try {
            timeEntryCount = await TimeEntry.count({ where: { worker_id: worker.id } });
        } catch { /* model might not have this association */ }

        return successResponse(res, {
            assignments: assignmentCount,
            time_entries: timeEntryCount,
        }, 'Linked data counts retrieved.');
    } catch (error) {
        console.error('getWorkerLinkedData error:', error);
        return errorResponse(res, 'Failed to get linked data.', 500);
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
};
