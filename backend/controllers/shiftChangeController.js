/**
 * shiftChangeController.js
 * Gestiona solicitudes de cambio de turno entre contractors.
 *
 * Endpoints:
 *   GET    /api/shift-changes               — admin: todas | contractor: las suyas
 *   GET    /api/shift-changes/pending-count — contractor: cuántas esperan su respuesta
 *   POST   /api/shift-changes               — contractor: crear solicitud
 *   PUT    /api/shift-changes/:id/respond   — target contractor: aceptar/rechazar
 *   PUT    /api/shift-changes/:id/review    — admin: aprobar/rechazar
 *   DELETE /api/shift-changes/:id           — requester: cancelar (solo si pending_target)
 */
const { ShiftChange, Worker, TimeEntry, Project, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// ─── Includes reutilizables ────────────────────────────────────────────────
const includeAll = [
    {
        model: Worker, as: 'requester',
        attributes: ['id', 'first_name', 'last_name', 'worker_code'],
    },
    {
        model: Worker, as: 'target',
        attributes: ['id', 'first_name', 'last_name', 'worker_code'],
    },
    {
        model: TimeEntry, as: 'requesterEntry',
        attributes: ['id', 'clock_in', 'clock_out', 'total_hours', 'project_id'],
        include: [{ model: Project, as: 'project', attributes: ['id', 'name'] }],
    },
    {
        model: TimeEntry, as: 'targetEntry',
        attributes: ['id', 'clock_in', 'clock_out', 'total_hours', 'project_id'],
        include: [{ model: Project, as: 'project', attributes: ['id', 'name'] }],
    },
    {
        model: User, as: 'reviewer',
        attributes: ['id', 'email'],
    },
];

// ─── GET /api/shift-changes/pending-count — contractor badge ──────────────
const getPendingCount = async (req, res) => {
    try {
        const { id: userId } = req.user;
        const worker = await Worker.findOne({ where: { user_id: userId } });
        if (!worker) return successResponse(res, { count: 0 });

        const count = await ShiftChange.count({
            where: { target_worker_id: worker.id, status: 'pending_target' },
        });
        return successResponse(res, { count });
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

// ─── GET /api/shift-changes ────────────────────────────────────────────────
const getShiftChanges = async (req, res) => {
    try {
        const { role, id: userId } = req.user;
        let where = {};

        if (role === 'contractor') {
            const worker = await Worker.findOne({ where: { user_id: userId } });
            if (!worker) return errorResponse(res, 'Worker not found', 404);
            const { Op } = require('sequelize');
            where = {
                [Op.or]: [
                    { requester_worker_id: worker.id },
                    { target_worker_id: worker.id },
                ],
            };
        }
        // admin sees all

        const changes = await ShiftChange.findAll({
            where,
            include: includeAll,
            order: [['created_at', 'DESC']],
        });
        return successResponse(res, changes);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

// ─── POST /api/shift-changes ───────────────────────────────────────────────
const createShiftChange = async (req, res) => {
    try {
        const { id: userId } = req.user;
        const worker = await Worker.findOne({ where: { user_id: userId } });
        if (!worker) return errorResponse(res, 'Worker not found', 404);

        const { target_worker_id, requester_entry_id, target_entry_id, shift_date, reason } = req.body;

        if (!target_worker_id || !requester_entry_id || !shift_date) {
            return errorResponse(res, 'target_worker_id, requester_entry_id y shift_date son requeridos', 400);
        }

        // Verify requester owns the entry
        const entry = await TimeEntry.findOne({
            where: { id: requester_entry_id, worker_id: worker.id },
        });
        if (!entry) return errorResponse(res, 'Time entry no encontrada o no pertenece al worker', 404);

        // Can't request change to yourself
        if (parseInt(target_worker_id) === worker.id) {
            return errorResponse(res, 'No puedes solicitar cambio contigo mismo', 400);
        }

        const sc = await ShiftChange.create({
            requester_worker_id: worker.id,
            target_worker_id,
            requester_entry_id,
            target_entry_id: target_entry_id || null,
            shift_date,
            reason: reason || null,
            status: 'pending_target',
        });

        const result = await ShiftChange.findByPk(sc.id, { include: includeAll });
        return successResponse(res, result, 201);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

// ─── PUT /api/shift-changes/:id/respond — target contractor ───────────────
const respondShiftChange = async (req, res) => {
    try {
        const { id: userId } = req.user;
        const worker = await Worker.findOne({ where: { user_id: userId } });
        if (!worker) return errorResponse(res, 'Worker not found', 404);

        const sc = await ShiftChange.findByPk(req.params.id);
        if (!sc) return errorResponse(res, 'Shift change not found', 404);

        // Only the target worker can respond
        if (sc.target_worker_id !== worker.id) {
            return errorResponse(res, 'Solo el target worker puede responder', 403);
        }

        if (sc.status !== 'pending_target') {
            return errorResponse(res, `No se puede responder: estado actual es "${sc.status}"`, 400);
        }

        const { accept, note } = req.body;
        if (accept === undefined) return errorResponse(res, '"accept" (true/false) es requerido', 400);

        await sc.update({
            status: accept ? 'accepted_target' : 'rejected_target',
            target_note: note || null,
        });

        const result = await ShiftChange.findByPk(sc.id, { include: includeAll });
        return successResponse(res, result);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

// ─── PUT /api/shift-changes/:id/review — admin ────────────────────────────
const reviewShiftChange = async (req, res) => {
    try {
        const sc = await ShiftChange.findByPk(req.params.id);
        if (!sc) return errorResponse(res, 'Shift change not found', 404);

        if (sc.status !== 'accepted_target') {
            return errorResponse(res, `Solo se puede revisar cuando está "accepted_target". Estado actual: "${sc.status}"`, 400);
        }

        const { approve, note } = req.body;
        if (approve === undefined) return errorResponse(res, '"approve" (true/false) es requerido', 400);

        await sc.update({
            status: approve ? 'approved_admin' : 'rejected_admin',
            admin_note: note || null,
            reviewed_by_user_id: req.user.id,
            reviewed_at: new Date(),
        });

        const result = await ShiftChange.findByPk(sc.id, { include: includeAll });
        return successResponse(res, result);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

// ─── DELETE /api/shift-changes/:id — requester cancels ────────────────────
const cancelShiftChange = async (req, res) => {
    try {
        const { id: userId } = req.user;
        const worker = await Worker.findOne({ where: { user_id: userId } });
        if (!worker) return errorResponse(res, 'Worker not found', 404);

        const sc = await ShiftChange.findByPk(req.params.id);
        if (!sc) return errorResponse(res, 'Shift change not found', 404);

        if (sc.requester_worker_id !== worker.id) {
            return errorResponse(res, 'Solo el requester puede cancelar', 403);
        }

        if (sc.status !== 'pending_target') {
            return errorResponse(res, 'Solo se puede cancelar mientras está pendiente', 400);
        }

        await sc.update({ status: 'cancelled' });
        return successResponse(res, { message: 'Solicitud cancelada' });
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

module.exports = {
    getPendingCount,
    getShiftChanges,
    createShiftChange,
    respondShiftChange,
    reviewShiftChange,
    cancelShiftChange,
};
