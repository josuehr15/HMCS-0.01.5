const { Assignment, Worker, Project, TimeEntry } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

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
                { model: Worker, as: 'worker', attributes: ['id', 'worker_code', 'first_name', 'last_name'] },
                { model: Project, as: 'project', attributes: ['id', 'name', 'address'] },
            ],
            order: [['created_at', 'DESC']],
        });

        return successResponse(res, assignments, 'Assignments retrieved successfully.');
    } catch (error) {
        console.error('getAllAssignments error:', error);
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
                { model: Worker, as: 'worker', attributes: ['id', 'worker_code', 'first_name', 'last_name'] },
                { model: Project, as: 'project', attributes: ['id', 'name', 'address'] },
                { model: TimeEntry, as: 'timeEntries' },
            ],
        });

        if (!assignment) {
            return errorResponse(res, 'Assignment not found.', 404);
        }

        return successResponse(res, assignment, 'Assignment retrieved successfully.');
    } catch (error) {
        console.error('getAssignmentById error:', error);
        return errorResponse(res, 'Failed to retrieve assignment.', 500);
    }
};

/**
 * POST /api/assignments
 */
const createAssignment = async (req, res) => {
    try {
        const { worker_id, project_id, start_date, end_date, notes } = req.body;

        if (!worker_id || !project_id || !start_date) {
            return errorResponse(res, 'Missing required fields: worker_id, project_id, start_date.', 400);
        }

        // Verify worker exists
        const worker = await Worker.findOne({ where: { id: worker_id, is_active: true } });
        if (!worker) {
            return errorResponse(res, 'Worker not found.', 400);
        }

        // Verify project exists
        const project = await Project.findOne({ where: { id: project_id, is_active: true } });
        if (!project) {
            return errorResponse(res, 'Project not found.', 400);
        }

        // Check for duplicate active assignment
        const existing = await Assignment.findOne({
            where: { worker_id, project_id, status: 'active', is_active: true },
        });
        if (existing) {
            return errorResponse(res, 'This worker already has an active assignment for this project.', 409);
        }

        const assignment = await Assignment.create({
            worker_id, project_id, start_date, end_date, notes,
        });

        const fullAssignment = await Assignment.findByPk(assignment.id, {
            include: [
                { model: Worker, as: 'worker', attributes: ['id', 'worker_code', 'first_name', 'last_name'] },
                { model: Project, as: 'project', attributes: ['id', 'name', 'address'] },
            ],
        });

        return successResponse(res, fullAssignment, 'Assignment created successfully.', 201);
    } catch (error) {
        console.error('createAssignment error:', error);
        return errorResponse(res, 'Failed to create assignment.', 500);
    }
};

/**
 * PUT /api/assignments/:id
 */
const updateAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!assignment) {
            return errorResponse(res, 'Assignment not found.', 404);
        }

        const { start_date, end_date, status, notes } = req.body;

        await assignment.update({
            start_date: start_date || assignment.start_date,
            end_date: end_date !== undefined ? end_date : assignment.end_date,
            status: status || assignment.status,
            notes: notes !== undefined ? notes : assignment.notes,
        });

        return successResponse(res, assignment, 'Assignment updated successfully.');
    } catch (error) {
        console.error('updateAssignment error:', error);
        return errorResponse(res, 'Failed to update assignment.', 500);
    }
};

/**
 * DELETE /api/assignments/:id
 */
const deleteAssignment = async (req, res) => {
    try {
        const assignment = await Assignment.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!assignment) {
            return errorResponse(res, 'Assignment not found.', 404);
        }

        const timeEntryCount = await TimeEntry.count({ where: { assignment_id: assignment.id } });

        await assignment.update({ is_active: false });

        const response = { id: assignment.id };
        if (timeEntryCount > 0) {
            response.warning = `This assignment has ${timeEntryCount} time entry(ies) linked. It has been soft-deleted.`;
            response.linked_data = { time_entries: timeEntryCount };
        }

        return successResponse(res, response, 'Assignment deactivated successfully.');
    } catch (error) {
        console.error('deleteAssignment error:', error);
        return errorResponse(res, 'Failed to delete assignment.', 500);
    }
};

module.exports = { getAllAssignments, getAssignmentById, createAssignment, updateAssignment, deleteAssignment };
