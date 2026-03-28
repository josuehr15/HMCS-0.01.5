const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Worker, Project, Assignment, TimeEntry, User, Trade } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { calculateDistance, isWithinRadius } = require('../utils/gpsUtils');

// ─── Helpers ────────────────────────────────────────────────────────────────────
const calcHours = (clockIn, clockOut) => {
    const diffMs = new Date(clockOut) - new Date(clockIn);
    return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
};

// Build full includes for time entry queries
const ENTRY_INCLUDES = [
    {
        model: Worker, as: 'worker',
        attributes: ['id', 'worker_code', 'first_name', 'last_name'],
        include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
    },
    { model: Project, as: 'project', attributes: ['id', 'name', 'address', 'latitude', 'longitude', 'gps_radius_meters'] },
    { model: User, as: 'approvedBy', attributes: ['id', 'email'] },
];

// ─── POST /api/time-entries/clock-in ────────────────────────────────────────────
const clockIn = async (req, res) => {
    try {
        const { project_id, latitude, longitude } = req.body;
        const userId = req.user.id;

        if (!project_id || latitude === undefined || longitude === undefined) {
            return errorResponse(res, 'Missing required fields: project_id, latitude, longitude.', 400);
        }

        const worker = await Worker.findOne({ where: { user_id: userId, is_active: true } });
        if (!worker) return errorResponse(res, 'Worker profile not found.', 404);

        const assignment = await Assignment.findOne({
            where: { worker_id: worker.id, project_id, status: 'active', is_active: true },
        });
        if (!assignment) return errorResponse(res, 'No tienes una asignación activa para este proyecto.', 403);

        const openEntry = await TimeEntry.findOne({ where: { worker_id: worker.id, clock_out: null, is_active: true } });
        if (openEntry) return errorResponse(res, 'Ya tienes un clock-in abierto. Haz clock-out primero.', 409);

        const project = await Project.findByPk(project_id);
        if (!project) return errorResponse(res, 'Project not found.', 404);

        const distance = calculateDistance(parseFloat(latitude), parseFloat(longitude), parseFloat(project.latitude), parseFloat(project.longitude));

        if (!isWithinRadius(parseFloat(latitude), parseFloat(longitude), parseFloat(project.latitude), parseFloat(project.longitude), project.gps_radius_meters)) {
            return errorResponse(res, `No estás lo suficientemente cerca del proyecto. Distancia: ${Math.round(distance)}m, Radio: ${project.gps_radius_meters}m.`, 403);
        }

        const timeEntry = await TimeEntry.create({
            worker_id: worker.id, project_id, assignment_id: assignment.id,
            clock_in: new Date(),
            clock_in_latitude: latitude, clock_in_longitude: longitude,
        });

        return successResponse(res, timeEntry, 'Clock in exitoso.', 201);
    } catch (error) {
        console.error('clockIn error:', error);
        return errorResponse(res, 'Failed to clock in.', 500);
    }
};

// ─── POST /api/time-entries/clock-out ───────────────────────────────────────────
const clockOut = async (req, res) => {
    try {
        const { time_entry_id, latitude, longitude } = req.body;
        const userId = req.user.id;

        if (!time_entry_id || latitude === undefined || longitude === undefined) {
            return errorResponse(res, 'Missing: time_entry_id, latitude, longitude.', 400);
        }

        const worker = await Worker.findOne({ where: { user_id: userId, is_active: true } });
        if (!worker) return errorResponse(res, 'Worker profile not found.', 404);

        const timeEntry = await TimeEntry.findOne({ where: { id: time_entry_id, worker_id: worker.id, is_active: true } });
        if (!timeEntry) return errorResponse(res, 'Entrada no encontrada.', 404);
        if (timeEntry.clock_out) return errorResponse(res, 'Esta entrada ya tiene clock-out.', 409);

        const clockOutTime = new Date();
        const totalHours = calcHours(timeEntry.clock_in, clockOutTime);

        await timeEntry.update({
            clock_out: clockOutTime,
            clock_out_latitude: latitude, clock_out_longitude: longitude,
            total_hours: totalHours,
        });

        return successResponse(res, timeEntry, `Clock out exitoso. Total: ${totalHours}h.`);
    } catch (error) {
        console.error('clockOut error:', error);
        return errorResponse(res, 'Failed to clock out.', 500);
    }
};

// ─── GET /api/time-entries/my ────────────────────────────────────────────────────
const getMyTimeEntries = async (req, res) => {
    try {
        const userId = req.user.id;
        const { start_date, end_date, project_id } = req.query;

        const worker = await Worker.findOne({ where: { user_id: userId, is_active: true } });
        if (!worker) return errorResponse(res, 'Worker profile not found.', 404);

        const where = { worker_id: worker.id, is_active: true };
        if (project_id) where.project_id = project_id;
        if (start_date && end_date) {
            where.clock_in = { [Op.between]: [new Date(start_date), new Date(end_date + 'T23:59:59')] };
        } else if (start_date) {
            where.clock_in = { [Op.gte]: new Date(start_date) };
        } else if (end_date) {
            where.clock_in = { [Op.lte]: new Date(end_date + 'T23:59:59') };
        }

        const entries = await TimeEntry.findAll({
            where,
            include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'address'] }],
            order: [['clock_in', 'DESC']],
        });

        return successResponse(res, entries, 'Time entries retrieved.');
    } catch (error) {
        console.error('getMyTimeEntries error:', error);
        return errorResponse(res, 'Failed to retrieve time entries.', 500);
    }
};

// ─── GET /api/time-entries ───────────────────────────────────────────────────────
const getAllTimeEntries = async (req, res) => {
    try {
        const { worker_id, project_id, status, start_date, end_date } = req.query;
        const where = { is_active: true };

        if (worker_id) where.worker_id = worker_id;
        if (project_id) where.project_id = project_id;
        if (status && status !== 'all') where.status = status;
        if (start_date && end_date) {
            where.clock_in = { [Op.between]: [new Date(start_date), new Date(end_date + 'T23:59:59')] };
        } else if (start_date) {
            where.clock_in = { [Op.gte]: new Date(start_date) };
        } else if (end_date) {
            where.clock_in = { [Op.lte]: new Date(end_date + 'T23:59:59') };
        }

        const entries = await TimeEntry.findAll({
            where,
            include: ENTRY_INCLUDES,
            order: [['clock_in', 'ASC']],
        });

        return successResponse(res, entries, 'Time entries retrieved.');
    } catch (error) {
        console.error('getAllTimeEntries error:', error);
        return errorResponse(res, 'Failed to retrieve time entries.', 500);
    }
};

// ─── GET /api/time-entries/:id ───────────────────────────────────────────────────
const getTimeEntryById = async (req, res) => {
    try {
        const entry = await TimeEntry.findOne({
            where: { id: req.params.id, is_active: true },
            include: ENTRY_INCLUDES,
        });
        if (!entry) return errorResponse(res, 'Time entry not found.', 404);
        return successResponse(res, entry, 'Time entry retrieved.');
    } catch (error) {
        console.error('getTimeEntryById error:', error);
        return errorResponse(res, 'Failed to retrieve time entry.', 500);
    }
};

// ─── POST /api/time-entries (admin manual entry) ─────────────────────────────────
const createManualEntry = async (req, res) => {
    try {
        const { worker_id, project_id, clock_in, clock_out, manual_entry_reason, notes } = req.body;

        if (!worker_id || !project_id || !clock_in || !clock_out) {
            return errorResponse(res, 'Campos requeridos: worker_id, project_id, clock_in, clock_out.', 400);
        }
        if (!manual_entry_reason || !manual_entry_reason.trim()) {
            return errorResponse(res, 'La razón de entrada manual es obligatoria.', 400);
        }

        const worker = await Worker.findOne({ where: { id: worker_id, is_active: true } });
        if (!worker) return errorResponse(res, 'Worker not found.', 400);

        const project = await Project.findOne({ where: { id: project_id, is_active: true } });
        if (!project) return errorResponse(res, 'Project not found.', 400);

        // Find assignment (optional — look for active assignment)
        let assignment = await Assignment.findOne({
            where: { worker_id, project_id, status: 'active', is_active: true },
        });
        // If no active assignment, find any assignment for this worker+project
        if (!assignment) {
            assignment = await Assignment.findOne({
                where: { worker_id, project_id, is_active: true },
                order: [['created_at', 'DESC']],
            });
        }
        if (!assignment) return errorResponse(res, 'Este worker no tiene asignación en este proyecto.', 400);

        const clockInDate = new Date(clock_in);
        const clockOutDate = new Date(clock_out);
        if (clockOutDate <= clockInDate) {
            return errorResponse(res, 'La hora de salida debe ser después de la hora de entrada.', 400);
        }

        const totalHours = calcHours(clockInDate, clockOutDate);

        const entry = await TimeEntry.create({
            worker_id, project_id,
            assignment_id: assignment.id,
            clock_in: clockInDate,
            clock_out: clockOutDate,
            clock_in_latitude: 0,  // No GPS for manual entries
            clock_in_longitude: 0,
            total_hours: totalHours,
            is_manual_entry: true,
            manual_entry_reason: manual_entry_reason.trim(),
            edited_by_user_id: req.user.id,
            status: 'pending',
            notes: notes || null,
        });

        const full = await TimeEntry.findByPk(entry.id, { include: ENTRY_INCLUDES });
        return successResponse(res, full, 'Entrada manual creada exitosamente.', 201);
    } catch (error) {
        console.error('createManualEntry error:', error);
        return errorResponse(res, 'Failed to create manual entry.', 500);
    }
};

// ─── PUT /api/time-entries/:id (admin edit) ──────────────────────────────────────
const updateTimeEntry = async (req, res) => {
    try {
        const entry = await TimeEntry.findOne({ where: { id: req.params.id, is_active: true } });
        if (!entry) return errorResponse(res, 'Time entry not found.', 404);

        const { clock_in, clock_out, manual_entry_reason, notes, status } = req.body;

        // Any admin edit becomes a manual entry
        if (!manual_entry_reason || !manual_entry_reason.trim()) {
            return errorResponse(res, 'La razón de edición es obligatoria al modificar una entrada.', 400);
        }

        const newClockIn = clock_in ? new Date(clock_in) : entry.clock_in;
        const newClockOut = clock_out ? new Date(clock_out) : entry.clock_out;

        let totalHours = entry.total_hours;
        if (newClockOut && newClockIn) {
            if (new Date(newClockOut) <= new Date(newClockIn)) {
                return errorResponse(res, 'La salida debe ser después de la entrada.', 400);
            }
            totalHours = calcHours(newClockIn, newClockOut);
        }

        await entry.update({
            clock_in: newClockIn,
            clock_out: newClockOut,
            total_hours: totalHours,
            is_manual_entry: true,
            manual_entry_reason: manual_entry_reason.trim(),
            edited_by_user_id: req.user.id,
            notes: notes !== undefined ? notes : entry.notes,
            status: status || entry.status,
        });

        const full = await TimeEntry.findByPk(entry.id, { include: ENTRY_INCLUDES });
        return successResponse(res, full, 'Entrada actualizada.');
    } catch (error) {
        console.error('updateTimeEntry error:', error);
        return errorResponse(res, 'Failed to update time entry.', 500);
    }
};

// ─── PATCH /api/time-entries/:id/status ─────────────────────────────────────────
const updateEntryStatus = async (req, res) => {
    try {
        const { status, notes } = req.body;
        const validStatuses = ['pending', 'approved', 'flagged', 'rejected'];
        if (!status || !validStatuses.includes(status)) {
            return errorResponse(res, `Status inválido. Válidos: ${validStatuses.join(', ')}.`, 400);
        }

        const entry = await TimeEntry.findOne({ where: { id: req.params.id, is_active: true } });
        if (!entry) return errorResponse(res, 'Time entry not found.', 404);

        const update = { status };
        if (notes !== undefined) update.notes = notes;
        if (status === 'approved') {
            update.approved_by_user_id = req.user.id;
            update.approved_at = new Date();
        }

        await entry.update(update);
        const full = await TimeEntry.findByPk(entry.id, { include: ENTRY_INCLUDES });
        return successResponse(res, full, `Entrada ${status}.`);
    } catch (error) {
        console.error('updateEntryStatus error:', error);
        return errorResponse(res, 'Failed to update status.', 500);
    }
};

// ─── PATCH /api/time-entries/bulk-status ────────────────────────────────────────
const bulkUpdateStatus = async (req, res) => {
    try {
        const { ids, status } = req.body;
        const validStatuses = ['pending', 'approved', 'flagged', 'rejected'];

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return errorResponse(res, 'ids debe ser un array no vacío.', 400);
        }
        if (!status || !validStatuses.includes(status)) {
            return errorResponse(res, `Status inválido. Válidos: ${validStatuses.join(', ')}.`, 400);
        }

        const update = { status };
        if (status === 'approved') {
            update.approved_by_user_id = req.user.id;
            update.approved_at = new Date();
        }

        const [count] = await TimeEntry.update(update, { where: { id: { [Op.in]: ids }, is_active: true } });

        return successResponse(res, { updated: count, ids, status }, `${count} entradas actualizadas a "${status}".`);
    } catch (error) {
        console.error('bulkUpdateStatus error:', error);
        return errorResponse(res, 'Failed to bulk update status.', 500);
    }
};

// ─── DELETE /api/time-entries/:id ────────────────────────────────────────────────
const deleteTimeEntry = async (req, res) => {
    try {
        const entry = await TimeEntry.findOne({ where: { id: req.params.id, is_active: true } });
        if (!entry) return errorResponse(res, 'Time entry not found.', 404);
        await entry.update({ is_active: false });
        return successResponse(res, { id: entry.id }, 'Entrada eliminada.');
    } catch (error) {
        console.error('deleteTimeEntry error:', error);
        return errorResponse(res, 'Failed to delete time entry.', 500);
    }
};

// ─── GET /api/time-entries/summary ──────────────────────────────────────────────
const getSummary = async (req, res) => {
    try {
        const { month } = req.query; // e.g. "2026-03"
        let startDate, endDate;

        if (month) {
            const [yr, mo] = month.split('-').map(Number);
            startDate = new Date(yr, mo - 1, 1);
            endDate = new Date(yr, mo, 1); // first day of next month
        } else {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }

        const entries = await TimeEntry.findAll({
            where: {
                is_active: true,
                clock_in: { [Op.gte]: startDate, [Op.lt]: endDate },
            },
            include: ENTRY_INCLUDES,
            order: [['clock_in', 'ASC']],
        });

        // Stats
        const totalHours = entries.reduce((s, e) => s + parseFloat(e.total_hours || 0), 0);
        const pending = entries.filter(e => e.status === 'pending').length;
        const approved = entries.filter(e => e.status === 'approved').length;
        const liveNow = entries.filter(e => !e.clock_out).length;

        return successResponse(res, {
            entries,
            stats: { totalHours: parseFloat(totalHours.toFixed(2)), pending, approved, liveNow },
        }, 'Summary retrieved.');
    } catch (error) {
        console.error('getSummary error:', error);
        return errorResponse(res, 'Failed to retrieve summary.', 500);
    }
};

// ─── Legacy handlers (kept for backward compat) ──────────────────────────────────
const approveTimeEntry = (req, res) => {
    req.body = { ...req.body, status: 'approved' };
    return updateEntryStatus(req, res);
};
const flagTimeEntry = (req, res) => {
    req.body = { ...req.body, status: 'flagged' };
    return updateEntryStatus(req, res);
};

module.exports = {
    clockIn, clockOut,
    getMyTimeEntries, getAllTimeEntries, getTimeEntryById,
    createManualEntry, updateTimeEntry,
    updateEntryStatus, bulkUpdateStatus,
    deleteTimeEntry, getSummary,
    approveTimeEntry, flagTimeEntry,  // legacy
};
