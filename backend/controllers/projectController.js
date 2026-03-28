const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { Project, Client, Assignment, TimeEntry, Worker, Trade } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * GET /api/projects
 * Filters: client_id, status, include_all
 */
const getAllProjects = async (req, res) => {
    try {
        const { client_id, status, include_all } = req.query;
        const where = { deleted_at: null };

        if (include_all !== 'true') {
            where.is_active = true;
        }
        if (client_id) where.client_id = client_id;
        if (status && status !== 'all') where.status = status;

        const projects = await Project.findAll({
            where,
            include: [
                { model: Client, as: 'client', attributes: ['id', 'company_name'] },
                {
                    model: Assignment,
                    as: 'assignments',
                    where: { is_active: true, status: 'active' },
                    required: false,
                    include: [
                        {
                            model: Worker, as: 'worker',
                            attributes: ['id', 'first_name', 'last_name', 'worker_code'],
                            include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                        },
                    ],
                },
            ],
            order: [['name', 'ASC']],
        });

        return successResponse(res, projects, 'Projects retrieved successfully.');
    } catch (error) {
        console.error('getAllProjects error:', error);
        return errorResponse(res, 'Failed to retrieve projects.', 500);
    }
};

/**
 * GET /api/projects/:id
 */
const getProjectById = async (req, res) => {
    try {
        const project = await Project.findOne({
            where: { id: req.params.id, deleted_at: null },
            include: [
                { model: Client, as: 'client', attributes: ['id', 'company_name'] },
                {
                    model: Assignment,
                    as: 'assignments',
                    where: { is_active: true },
                    required: false,
                    include: [
                        {
                            model: Worker, as: 'worker',
                            attributes: ['id', 'first_name', 'last_name', 'worker_code'],
                            include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                        },
                    ],
                },
                {
                    model: TimeEntry,
                    as: 'timeEntries',
                    required: false,
                    attributes: ['id', 'total_hours'],
                },
            ],
        });

        if (!project) return errorResponse(res, 'Project not found.', 404);
        return successResponse(res, project, 'Project retrieved successfully.');
    } catch (error) {
        console.error('getProjectById error:', error);
        return errorResponse(res, 'Failed to retrieve project.', 500);
    }
};

/**
 * GET /api/projects/:id/linked-data
 */
const getProjectLinkedData = async (req, res) => {
    try {
        const project = await Project.findByPk(req.params.id);
        if (!project) return errorResponse(res, 'Project not found.', 404);

        const [assignments, timeEntries] = await Promise.all([
            Assignment.count({ where: { project_id: project.id } }).catch(() => 0),
            TimeEntry.count({ where: { project_id: project.id } }).catch(() => 0),
        ]);
        const total = assignments + timeEntries;

        return successResponse(res, {
            assignments, time_entries: timeEntries, total,
            can_hard_delete: total === 0,
        }, 'Linked data retrieved.');
    } catch (error) {
        console.error('getProjectLinkedData error:', error);
        return errorResponse(res, 'Failed to get linked data.', 500);
    }
};

/**
 * POST /api/projects
 */
const createProject = async (req, res) => {
    try {
        const {
            client_id, name, address, latitude, longitude,
            gps_radius_meters, lunch_rule, lunch_duration_minutes,
            work_hours_per_day, paid_hours_per_day, start_date, end_date,
            status, notes,
        } = req.body;

        if (!client_id || !name || !address || latitude === undefined || longitude === undefined) {
            return errorResponse(res, 'Campos requeridos: client_id, name, address, latitude, longitude.', 400);
        }

        const client = await Client.findByPk(client_id);
        if (!client) return errorResponse(res, 'Cliente no encontrado.', 400);

        const project = await Project.create({
            client_id, name, address,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            gps_radius_meters: parseInt(gps_radius_meters || 500),
            lunch_rule: lunch_rule || 'paid',
            lunch_duration_minutes: parseInt(lunch_duration_minutes || 60),
            work_hours_per_day: parseFloat(work_hours_per_day || 9.00),
            paid_hours_per_day: parseFloat(paid_hours_per_day || 10.00),
            start_date: start_date || null,
            end_date: end_date || null,
            status: status || 'active',
            is_active: true,
            notes: notes || null,
        });

        const full = await Project.findByPk(project.id, {
            include: [{ model: Client, as: 'client', attributes: ['id', 'company_name'] }],
        });

        return successResponse(res, full, 'Proyecto creado exitosamente.', 201);
    } catch (error) {
        console.error('createProject error:', error);
        return errorResponse(res, 'Failed to create project.', 500);
    }
};

/**
 * PUT /api/projects/:id
 */
const updateProject = async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.id, deleted_at: null } });
        if (!project) return errorResponse(res, 'Project not found.', 404);

        const {
            name, address, latitude, longitude, gps_radius_meters,
            lunch_rule, lunch_duration_minutes, work_hours_per_day,
            paid_hours_per_day, status, start_date, end_date, notes,
        } = req.body;

        const newStatus = status || project.status;
        await project.update({
            name: name || project.name,
            address: address || project.address,
            latitude: latitude !== undefined ? parseFloat(latitude) : project.latitude,
            longitude: longitude !== undefined ? parseFloat(longitude) : project.longitude,
            gps_radius_meters: gps_radius_meters !== undefined ? parseInt(gps_radius_meters) : project.gps_radius_meters,
            lunch_rule: lunch_rule || project.lunch_rule,
            lunch_duration_minutes: lunch_duration_minutes !== undefined ? parseInt(lunch_duration_minutes) : project.lunch_duration_minutes,
            work_hours_per_day: work_hours_per_day !== undefined ? parseFloat(work_hours_per_day) : project.work_hours_per_day,
            paid_hours_per_day: paid_hours_per_day !== undefined ? parseFloat(paid_hours_per_day) : project.paid_hours_per_day,
            status: newStatus,
            is_active: newStatus === 'active',
            start_date: start_date !== undefined ? start_date : project.start_date,
            end_date: end_date !== undefined ? end_date : project.end_date,
            notes: notes !== undefined ? notes : project.notes,
        });

        const updated = await Project.findByPk(project.id, {
            include: [{ model: Client, as: 'client', attributes: ['id', 'company_name'] }],
        });

        return successResponse(res, updated, 'Project updated successfully.');
    } catch (error) {
        console.error('updateProject error:', error);
        return errorResponse(res, 'Failed to update project.', 500);
    }
};

/**
 * PATCH /api/projects/:id/toggle-status
 * Cycles: active → on_hold → active
 */
const toggleProjectStatus = async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.id, deleted_at: null } });
        if (!project) return errorResponse(res, 'Project not found.', 404);

        const newStatus = project.status === 'active' ? 'on_hold' : 'active';
        const newIsActive = newStatus === 'active';
        await project.update({ status: newStatus, is_active: newIsActive });

        const updated = await Project.findByPk(project.id, {
            include: [{ model: Client, as: 'client', attributes: ['id', 'company_name'] }],
        });

        const msg = newStatus === 'active' ? 'Proyecto reactivado.' : 'Proyecto pausado.';
        return successResponse(res, updated, msg);
    } catch (error) {
        console.error('toggleProjectStatus error:', error);
        return errorResponse(res, 'Failed to toggle project status.', 500);
    }
};

/**
 * DELETE /api/projects/:id  (soft deactivate — Level 1)
 */
const deleteProject = async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.id, deleted_at: null } });
        if (!project) return errorResponse(res, 'Project not found.', 404);

        await project.update({ is_active: false, status: 'on_hold' });
        return successResponse(res, { id: project.id, action: 'deactivated' }, 'Proyecto desactivado.');
    } catch (error) {
        console.error('deleteProject error:', error);
        return errorResponse(res, 'Failed to deactivate project.', 500);
    }
};

/**
 * DELETE /api/projects/:id/force
 * Level 2: hard delete (no linked data) | Level 3: permanent hide (has linked data)
 */
const forceDeleteProject = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const confirmed_id = req.body?.confirmed_id || req.query?.confirmed_id;
        const project = await Project.findOne({ where: { id: req.params.id, deleted_at: null }, transaction: t });

        if (!project) { await t.rollback(); return errorResponse(res, 'Project not found.', 404); }
        if (String(confirmed_id) !== String(project.id)) {
            await t.rollback();
            return errorResponse(res, 'Confirmación de ID no coincide.', 400);
        }

        const [assignments, timeEntries] = await Promise.all([
            Assignment.count({ where: { project_id: project.id }, transaction: t }).catch(() => 0),
            TimeEntry.count({ where: { project_id: project.id }, transaction: t }).catch(() => 0),
        ]);
        const total = assignments + timeEntries;

        if (total > 0) {
            // Level 3: permanent hide
            await project.update({ is_active: false, status: 'on_hold', deleted_at: new Date() }, { transaction: t });
            await t.commit();
            return successResponse(res, {
                id: project.id, action: 'hidden',
                linked_data: { assignments, time_entries: timeEntries, total },
            }, 'Proyecto ocultado permanentemente. Datos conservados.');
        }

        // Level 2: hard delete
        await project.destroy({ transaction: t });
        await t.commit();
        return successResponse(res, { id: project.id, action: 'deleted' }, 'Proyecto eliminado permanentemente.');
    } catch (error) {
        await t.rollback();
        console.error('forceDeleteProject error:', error);
        return errorResponse(res, 'Failed to permanently delete project.', 500);
    }
};

module.exports = {
    getAllProjects, getProjectById, getProjectLinkedData,
    createProject, updateProject, deleteProject,
    toggleProjectStatus, forceDeleteProject,
};
