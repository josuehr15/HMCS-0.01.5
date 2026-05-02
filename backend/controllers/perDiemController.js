const { Op } = require('sequelize');
const { PerDiemEntry, Worker, Assignment, Project } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * POST /api/per-diem
 * Create per diem entry (admin).
 */
const createPerDiem = async (req, res) => {
    try {
        const { worker_id, assignment_id, week_start_date, week_end_date, amount, description } = req.body;

        if (!worker_id || !assignment_id || !week_start_date || !week_end_date || !amount) {
            return errorResponse(res, 'Missing required fields: worker_id, assignment_id, week_start_date, week_end_date, amount.', 400);
        }

        const entry = await PerDiemEntry.create({
            worker_id, assignment_id, week_start_date, week_end_date, amount, description,
        });

        return successResponse(res, entry, 'Per diem entry created.', 201);
    } catch (error) {
        return errorResponse(res, 'Failed to create per diem entry.', 500);
    }
};

/**
 * GET /api/per-diem
 * Admin lists all per diem entries.
 */
const getAllPerDiem = async (req, res) => {
    try {
        const { worker_id, status, client_id, week_start_date, week_end_date } = req.query;
        const where = { is_active: true };
        if (worker_id) where.worker_id = worker_id;
        if (status) where.status = status;
        if (week_start_date) where.week_start_date = { [Op.gte]: week_start_date };
        if (week_end_date) where.week_end_date = { [Op.lte]: week_end_date };

        const entries = await PerDiemEntry.findAll({
            where,
            include: [
                { model: Worker, as: 'worker', attributes: ['id', 'worker_code', 'first_name', 'last_name'] },
                {
                    model: Assignment, as: 'assignment',
                    include: [{
                        model: Project,
                        as: 'project',
                        attributes: ['id', 'name', 'client_id'],
                        ...(client_id ? { where: { client_id: parseInt(client_id) } } : {}),
                    }],
                },
            ],
            order: [['created_at', 'DESC']],
        });

        return successResponse(res, entries, 'Per diem entries retrieved.');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve per diem entries.', 500);
    }
};

/**
 * PUT /api/per-diem/:id/paid
 * Mark per diem as paid.
 */
const markPerDiemPaid = async (req, res) => {
    try {
        const entry = await PerDiemEntry.findOne({ where: { id: req.params.id, is_active: true } });
        if (!entry) return errorResponse(res, 'Per diem entry not found.', 404);

        await entry.update({ status: 'paid', paid_at: new Date() });
        return successResponse(res, entry, 'Per diem marked as paid.');
    } catch (error) {
        return errorResponse(res, 'Failed to mark per diem as paid.', 500);
    }
};

/**
 * GET /api/per-diem/my
 * Contractor views their own per diem history.
 */
const getWorkerPerDiem = async (req, res) => {
    try {
        const worker = await Worker.findOne({ where: { user_id: req.user.id, is_active: true } });
        if (!worker) return errorResponse(res, 'Worker profile not found.', 404);

        const entries = await PerDiemEntry.findAll({
            where: { worker_id: worker.id, is_active: true },
            include: [
                {
                    model: Assignment, as: 'assignment',
                    include: [{ model: Project, as: 'project', attributes: ['id', 'name'] }],
                },
            ],
            order: [['created_at', 'DESC']],
        });

        return successResponse(res, entries, 'Per diem entries retrieved.');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve per diem entries.', 500);
    }
};

/**
 * DELETE /api/per-diem/:id
 * Soft-delete a per diem entry (admin only). Cannot delete if already paid.
 */
const deletePerDiem = async (req, res) => {
    try {
        const entry = await PerDiemEntry.findOne({ where: { id: req.params.id, is_active: true } });
        if (!entry) return errorResponse(res, 'Per diem entry not found.', 404);
        if (entry.status === 'paid') {
            return errorResponse(res, 'No se puede eliminar un Per Diem ya pagado.', 400);
        }
        await entry.update({ is_active: false });
        return successResponse(res, null, 'Per diem entry deleted.');
    } catch (error) {
        return errorResponse(res, 'Failed to delete per diem entry.', 500);
    }
};

module.exports = { createPerDiem, getAllPerDiem, markPerDiemPaid, getWorkerPerDiem, deletePerDiem };
