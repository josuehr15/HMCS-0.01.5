const { Project, Client, Assignment, TimeEntry } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * GET /api/projects
 * List all projects with optional filters: client_id, status.
 */
const getAllProjects = async (req, res) => {
    try {
        const { client_id, status } = req.query;
        const where = { is_active: true };

        if (client_id) where.client_id = client_id;
        if (status) where.status = status;

        const projects = await Project.findAll({
            where,
            include: [
                { model: Client, as: 'client', attributes: ['id', 'company_name'] },
            ],
            order: [['created_at', 'DESC']],
        });

        return successResponse(res, projects, 'Projects retrieved successfully.');
    } catch (error) {
        console.error('getAllProjects error:', error);
        return errorResponse(res, 'Failed to retrieve projects.', 500);
    }
};

/**
 * GET /api/projects/:id
 * Get single project with assignments and time entries.
 */
const getProjectById = async (req, res) => {
    try {
        const project = await Project.findOne({
            where: { id: req.params.id, is_active: true },
            include: [
                { model: Client, as: 'client', attributes: ['id', 'company_name'] },
                { model: Assignment, as: 'assignments' },
                { model: TimeEntry, as: 'timeEntries' },
            ],
        });

        if (!project) {
            return errorResponse(res, 'Project not found.', 404);
        }

        return successResponse(res, project, 'Project retrieved successfully.');
    } catch (error) {
        console.error('getProjectById error:', error);
        return errorResponse(res, 'Failed to retrieve project.', 500);
    }
};

/**
 * POST /api/projects
 * Create a new project. Requires GPS coordinates.
 */
const createProject = async (req, res) => {
    try {
        const {
            client_id, name, address, latitude, longitude,
            gps_radius_meters, lunch_rule, lunch_duration_minutes,
            work_hours_per_day, paid_hours_per_day, start_date, end_date, notes,
        } = req.body;

        if (!client_id || !name || !address || latitude === undefined || longitude === undefined) {
            return errorResponse(res, 'Missing required fields: client_id, name, address, latitude, longitude.', 400);
        }

        // Verify client exists
        const client = await Client.findByPk(client_id);
        if (!client) {
            return errorResponse(res, 'Invalid client_id.', 400);
        }

        const project = await Project.create({
            client_id, name, address, latitude, longitude,
            gps_radius_meters, lunch_rule, lunch_duration_minutes,
            work_hours_per_day, paid_hours_per_day, start_date, end_date, notes,
        });

        return successResponse(res, project, 'Project created successfully.', 201);
    } catch (error) {
        console.error('createProject error:', error);
        return errorResponse(res, 'Failed to create project.', 500);
    }
};

/**
 * PUT /api/projects/:id
 * Update project data.
 */
const updateProject = async (req, res) => {
    try {
        const project = await Project.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!project) {
            return errorResponse(res, 'Project not found.', 404);
        }

        const {
            name, address, latitude, longitude, gps_radius_meters,
            lunch_rule, lunch_duration_minutes, work_hours_per_day,
            paid_hours_per_day, status, start_date, end_date, notes,
        } = req.body;

        await project.update({
            name: name || project.name,
            address: address || project.address,
            latitude: latitude !== undefined ? latitude : project.latitude,
            longitude: longitude !== undefined ? longitude : project.longitude,
            gps_radius_meters: gps_radius_meters !== undefined ? gps_radius_meters : project.gps_radius_meters,
            lunch_rule: lunch_rule || project.lunch_rule,
            lunch_duration_minutes: lunch_duration_minutes !== undefined ? lunch_duration_minutes : project.lunch_duration_minutes,
            work_hours_per_day: work_hours_per_day !== undefined ? work_hours_per_day : project.work_hours_per_day,
            paid_hours_per_day: paid_hours_per_day !== undefined ? paid_hours_per_day : project.paid_hours_per_day,
            status: status || project.status,
            start_date: start_date !== undefined ? start_date : project.start_date,
            end_date: end_date !== undefined ? end_date : project.end_date,
            notes: notes !== undefined ? notes : project.notes,
        });

        return successResponse(res, project, 'Project updated successfully.');
    } catch (error) {
        console.error('updateProject error:', error);
        return errorResponse(res, 'Failed to update project.', 500);
    }
};

/**
 * DELETE /api/projects/:id
 * Soft delete.
 */
const deleteProject = async (req, res) => {
    try {
        const project = await Project.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!project) {
            return errorResponse(res, 'Project not found.', 404);
        }

        const assignmentCount = await Assignment.count({ where: { project_id: project.id } });
        const timeEntryCount = await TimeEntry.count({ where: { project_id: project.id } });

        await project.update({ is_active: false });

        const response = { id: project.id, name: project.name };
        if (assignmentCount > 0 || timeEntryCount > 0) {
            response.warning = 'This project has linked data. It has been soft-deleted.';
            response.linked_data = { assignments: assignmentCount, time_entries: timeEntryCount };
        }

        return successResponse(res, response, 'Project deactivated successfully.');
    } catch (error) {
        console.error('deleteProject error:', error);
        return errorResponse(res, 'Failed to delete project.', 500);
    }
};

module.exports = { getAllProjects, getProjectById, createProject, updateProject, deleteProject };
