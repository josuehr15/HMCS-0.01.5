const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Assignment, Worker, Project, TimeEntry, Trade } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Helper: recalculate worker availability based on active assignments
const syncWorkerAvailability = async (workerId, transaction) => {
    const activeCount = await Assignment.count({
        where: { worker_id: workerId, status: 'active', is_active: true },
        transaction,
    });
    const availability = activeCount > 0 ? 'assigned' : 'available';
    await Worker.update({ availability }, { where: { id: workerId }, transaction });
    return availability;
};

/**
 * GET /api/assignments
 */
const getAllAssignments = async (req, res) => {
    try {
        const { worker_id, project_id, status } = req.query;
        const where = { is_active: true };

        if (worker_id) where.worker_id = worker_id;
        if (project_id) where.project_id = project_id;
        if (status) where.status = status;

        const assignments = await Assignment.findAll({
            where,
            include: [
                {
                    model: Worker, as: 'worker',
                    attributes: ['id', 'worker_code', 'first_name', 'last_name'],
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                },
                { model: Project, as: 'project', attributes: ['id', 'name', 'address'] },
            ],
            order: [['start_date', 'DESC']],
        });

        return successResponse(res, assignments, 'Assignments retrieved successfully.');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve assignments.', 500);
    }
};

/**
 * GET /api/assignments/:id
 */
const getAssignmentById = async (req, res) => {
    try {
        const assignment = await Assignment.findOne({
            where: { id: req.params.id, is_active: true },
            include: [
                {
                    model: Worker, as: 'worker',
                    attributes: ['id', 'worker_code', 'first_name', 'last_name'],
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                },
                { model: Project, as: 'project', attributes: ['id', 'name', 'address'] },
                { model: TimeEntry, as: 'timeEntries' },
            ],
        });

        if (!assignment) return errorResponse(res, 'Assignment not found.', 404);
        return successResponse(res, assignment, 'Assignment retrieved successfully.');
    } catch (error) {
        return errorResponse(res, 'Failed to retrieve assignment.', 500);
    }
};

/**
 * POST /api/assignments
 */
const createAssignment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { worker_id, project_id, start_date, end_date, notes } = req.body;

        if (!worker_id || !project_id || !start_date) {
            await t.rollback();
            return errorResponse(res, 'Campos requeridos: worker_id, project_id, start_date.', 400);
        }

        const worker = await Worker.findOne({ where: { id: worker_id, is_active: true, deleted_at: null } });
        if (!worker) { await t.rollback(); return errorResponse(res, 'Worker not found.', 400); }

        const project = await Project.findOne({ where: { id: project_id, is_active: true, deleted_at: null } });
        if (!project) { await t.rollback(); return errorResponse(res, 'Project not found.', 400); }

        // Check for duplicate active assignment
        const existing = await Assignment.findOne({
            where: { worker_id, project_id, status: 'active', is_active: true },
        });
        if (existing) {
            await t.rollback();
            return errorResponse(res, 'Este worker ya tiene una asignación activa en este proyecto.', 409);
        }

        const assignment = await Assignment.create({
            worker_id, project_id, start_date,
            end_date: end_date || null,
            notes: notes || null,
            status: 'active',
            is_active: true,
        }, { transaction: t });

        // Update worker availability
        await syncWorkerAvailability(worker_id, t);

        await t.commit();

        const full = await Assignment.findByPk(assignment.id, {
            include: [
                {
                    model: Worker, as: 'worker',
                    attributes: ['id', 'worker_code', 'first_name', 'last_name'],
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                },
                { model: Project, as: 'project', attributes: ['id', 'name', 'address'] },
            ],
        });

        return successResponse(res, full, 'Asignación creada exitosamente.', 201);
    } catch (error) {
        await t.rollback();
        return errorResponse(res, 'Failed to create assignment.', 500);
    }
};

/**
 * PUT /api/assignments/:id
 */
const updateAssignment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const assignment = await Assignment.findOne({ where: { id: req.params.id, is_active: true } });
        if (!assignment) { await t.rollback(); return errorResponse(res, 'Assignment not found.', 404); }

        const { start_date, end_date, status, notes } = req.body;
        const prevStatus = assignment.status;
        const newStatus = status || prevStatus;

        await assignment.update({
            start_date: start_date || assignment.start_date,
            end_date: end_date !== undefined ? end_date : assignment.end_date,
            status: newStatus,
            notes: notes !== undefined ? notes : assignment.notes,
        }, { transaction: t });

        // Recalculate availability when completing an assignment
        if (prevStatus === 'active' && (newStatus === 'completed' || newStatus === 'cancelled')) {
            await syncWorkerAvailability(assignment.worker_id, t);
        }

        await t.commit();

        const full = await Assignment.findByPk(assignment.id, {
            include: [
                {
                    model: Worker, as: 'worker',
                    attributes: ['id', 'worker_code', 'first_name', 'last_name'],
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                },
                { model: Project, as: 'project', attributes: ['id', 'name', 'address'] },
            ],
        });

        return successResponse(res, full, 'Assignment updated successfully.');
    } catch (error) {
        await t.rollback();
        return errorResponse(res, 'Failed to update assignment.', 500);
    }
};

/**
 * DELETE /api/assignments/:id  (soft delete)
 */
const deleteAssignment = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const assignment = await Assignment.findOne({ where: { id: req.params.id, is_active: true } });
        if (!assignment) { await t.rollback(); return errorResponse(res, 'Assignment not found.', 404); }

        const timeEntryCount = await TimeEntry.count({ where: { assignment_id: assignment.id } });
        const workerId = assignment.worker_id;

        await assignment.update({ is_active: false, status: 'cancelled' }, { transaction: t });
        await syncWorkerAvailability(workerId, t);

        await t.commit();

        const response = { id: assignment.id, action: 'deactivated' };
        if (timeEntryCount > 0) {
            response.warning = `Esta asignación tiene ${timeEntryCount} entrada(s) de tiempo vinculadas.`;
        }

        return successResponse(res, response, 'Asignación cancelada.');
    } catch (error) {
        await t.rollback();
        return errorResponse(res, 'Failed to delete assignment.', 500);
    }
};

module.exports = { getAllAssignments, getAssignmentById, createAssignment, updateAssignment, deleteAssignment };
