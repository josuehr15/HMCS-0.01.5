const { Op } = require('sequelize');
const { Worker, Project, Assignment, TimeEntry, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { calculateDistance, isWithinRadius } = require('../utils/gpsUtils');

/**
 * POST /api/time-entries/clock-in
 * Clock in — GPS captured only when button is pressed.
 */
const clockIn = async (req, res) => {
    try {
        const { project_id, latitude, longitude } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!project_id || latitude === undefined || longitude === undefined) {
            return errorResponse(res, 'Missing required fields: project_id, latitude, longitude.', 400);
        }

        // Find the worker associated with this user
        const worker = await Worker.findOne({ where: { user_id: userId, is_active: true } });
        if (!worker) {
            return errorResponse(res, 'Worker profile not found.', 404);
        }

        // Check for active assignment to this project
        const assignment = await Assignment.findOne({
            where: {
                worker_id: worker.id,
                project_id,
                status: 'active',
                is_active: true,
            },
        });
        if (!assignment) {
            return errorResponse(res, 'You do not have an active assignment for this project.', 403);
        }

        // Check for open clock-in (no clock-out yet)
        const openEntry = await TimeEntry.findOne({
            where: {
                worker_id: worker.id,
                clock_out: null,
                is_active: true,
            },
        });
        if (openEntry) {
            return errorResponse(res, 'You already have an open clock-in. Please clock out first.', 409);
        }

        // Fetch project for GPS validation
        const project = await Project.findByPk(project_id);
        if (!project) {
            return errorResponse(res, 'Project not found.', 404);
        }

        // Validate GPS: worker must be within project radius
        const distance = calculateDistance(
            parseFloat(latitude),
            parseFloat(longitude),
            parseFloat(project.latitude),
            parseFloat(project.longitude)
        );

        if (!isWithinRadius(
            parseFloat(latitude),
            parseFloat(longitude),
            parseFloat(project.latitude),
            parseFloat(project.longitude),
            project.gps_radius_meters
        )) {
            return errorResponse(
                res,
                `No estás lo suficientemente cerca del proyecto. Distancia: ${Math.round(distance)}m, Radio permitido: ${project.gps_radius_meters}m.`,
                403
            );
        }

        // Create time entry
        const timeEntry = await TimeEntry.create({
            worker_id: worker.id,
            project_id,
            assignment_id: assignment.id,
            clock_in: new Date(),
            clock_in_latitude: latitude,
            clock_in_longitude: longitude,
        });

        return successResponse(res, timeEntry, 'Clock in successful.', 201);
    } catch (error) {
        console.error('clockIn error:', error);
        return errorResponse(res, 'Failed to clock in.', 500);
    }
};

/**
 * POST /api/time-entries/clock-out
 * Clock out — calculates total_hours automatically.
 */
const clockOut = async (req, res) => {
    try {
        const { time_entry_id, latitude, longitude } = req.body;
        const userId = req.user.id;

        if (!time_entry_id || latitude === undefined || longitude === undefined) {
            return errorResponse(res, 'Missing required fields: time_entry_id, latitude, longitude.', 400);
        }

        // Find the worker
        const worker = await Worker.findOne({ where: { user_id: userId, is_active: true } });
        if (!worker) {
            return errorResponse(res, 'Worker profile not found.', 404);
        }

        // Find time entry
        const timeEntry = await TimeEntry.findOne({
            where: { id: time_entry_id, worker_id: worker.id, is_active: true },
        });
        if (!timeEntry) {
            return errorResponse(res, 'Time entry not found or does not belong to you.', 404);
        }

        if (timeEntry.clock_out) {
            return errorResponse(res, 'This time entry is already clocked out.', 409);
        }

        // Calculate total hours
        const clockOutTime = new Date();
        const diffMs = clockOutTime - new Date(timeEntry.clock_in);
        const totalHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

        // Update time entry
        await timeEntry.update({
            clock_out: clockOutTime,
            clock_out_latitude: latitude,
            clock_out_longitude: longitude,
            total_hours: totalHours,
        });

        return successResponse(res, timeEntry, `Clock out successful. Total hours: ${totalHours}.`);
    } catch (error) {
        console.error('clockOut error:', error);
        return errorResponse(res, 'Failed to clock out.', 500);
    }
};

/**
 * GET /api/time-entries/my
 * Contractor views their own time entries.
 */
const getMyTimeEntries = async (req, res) => {
    try {
        const userId = req.user.id;
        const { start_date, end_date, project_id } = req.query;

        const worker = await Worker.findOne({ where: { user_id: userId, is_active: true } });
        if (!worker) {
            return errorResponse(res, 'Worker profile not found.', 404);
        }

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
            include: [
                { model: Project, as: 'project', attributes: ['id', 'name', 'address'] },
            ],
            order: [['clock_in', 'DESC']],
        });

        return successResponse(res, entries, 'Time entries retrieved successfully.');
    } catch (error) {
        console.error('getMyTimeEntries error:', error);
        return errorResponse(res, 'Failed to retrieve time entries.', 500);
    }
};

/**
 * GET /api/time-entries
 * Admin views all time entries with filters.
 */
const getAllTimeEntries = async (req, res) => {
    try {
        const { worker_id, project_id, status, start_date, end_date } = req.query;
        const where = { is_active: true };

        if (worker_id) where.worker_id = worker_id;
        if (project_id) where.project_id = project_id;
        if (status) where.status = status;
        if (start_date && end_date) {
            where.clock_in = { [Op.between]: [new Date(start_date), new Date(end_date + 'T23:59:59')] };
        } else if (start_date) {
            where.clock_in = { [Op.gte]: new Date(start_date) };
        } else if (end_date) {
            where.clock_in = { [Op.lte]: new Date(end_date + 'T23:59:59') };
        }

        const entries = await TimeEntry.findAll({
            where,
            include: [
                { model: Worker, as: 'worker', attributes: ['id', 'worker_code', 'first_name', 'last_name'] },
                { model: Project, as: 'project', attributes: ['id', 'name', 'address'] },
            ],
            order: [['clock_in', 'DESC']],
        });

        return successResponse(res, entries, 'Time entries retrieved successfully.');
    } catch (error) {
        console.error('getAllTimeEntries error:', error);
        return errorResponse(res, 'Failed to retrieve time entries.', 500);
    }
};

/**
 * PUT /api/time-entries/:id/approve
 * Admin approves a time entry.
 */
const approveTimeEntry = async (req, res) => {
    try {
        const timeEntry = await TimeEntry.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!timeEntry) {
            return errorResponse(res, 'Time entry not found.', 404);
        }

        await timeEntry.update({
            status: 'approved',
            approved_by_user_id: req.user.id,
            approved_at: new Date(),
        });

        return successResponse(res, timeEntry, 'Time entry approved.');
    } catch (error) {
        console.error('approveTimeEntry error:', error);
        return errorResponse(res, 'Failed to approve time entry.', 500);
    }
};

/**
 * PUT /api/time-entries/:id/flag
 * Admin flags a time entry as suspicious.
 */
const flagTimeEntry = async (req, res) => {
    try {
        const { notes } = req.body;

        const timeEntry = await TimeEntry.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!timeEntry) {
            return errorResponse(res, 'Time entry not found.', 404);
        }

        await timeEntry.update({
            status: 'flagged',
            notes: notes || timeEntry.notes,
        });

        return successResponse(res, timeEntry, 'Time entry flagged.');
    } catch (error) {
        console.error('flagTimeEntry error:', error);
        return errorResponse(res, 'Failed to flag time entry.', 500);
    }
};

module.exports = {
    clockIn,
    clockOut,
    getMyTimeEntries,
    getAllTimeEntries,
    approveTimeEntry,
    flagTimeEntry,
};
