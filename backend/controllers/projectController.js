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
            work_hours_per_day, paid_hours_per_day, shift_start_time,
            shift_end_time, start_date, end_date, notes,
        } = req.body;

        if (!client_id || !name || !address || latitude == null || longitude == null) {
            return errorResponse(res, 'client_id, name, address, latitude y longitude son requeridos.', 400);
        }

        const project = await Project.create({
            client_id, name, address,
            latitude, longitude,
            gps_radius_meters: gps_radius_meters ?? 500,
            lunch_rule: lunch_rule || 'paid',
            lunch_duration_minutes: lunch_duration_minutes ?? 60,
            work_hours_per_day: work_hours_per_day ?? 9.00,
            paid_hours_per_day: paid_hours_per_day ?? 10.00,
            shift_start_time: shift_start_time || null,
            shift_end_time: shift_end_time || null,
            start_date: start_date || null,
            end_date: end_date || null,
            notes: notes || null,
        });

        const full = await Project.findByPk(project.id, {
            include: [{ model: Client, as: 'client', attributes: ['id', 'company_name'] }],
        });

        return successResponse(res, full, 'Proyecto creado exitosamente.', 201);
    } catch (error) {
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
            client_id, name, address, latitude, longitude,
            gps_radius_meters, lunch_rule, lunch_duration_minutes,
            work_hours_per_day, paid_hours_per_day, shift_start_time,
            shift_end_time, start_date, end_date, notes, status,
        } = req.body;

        await project.update({
            ...(client_id != null && { client_id }),
            ...(name != null && { name }),
            ...(address != null && { address }),
            ...(latitude != null && { latitude }),
            ...(longitude != null && { longitude }),
            ...(gps_radius_meters != null && { gps_radius_meters }),
            ...(lunch_rule != null && { lunch_rule }),
            ...(lunch_duration_minutes != null && { lunch_duration_minutes }),
            ...(work_hours_per_day != null && { work_hours_per_day }),
            ...(paid_hours_per_day != null && { paid_hours_per_day }),
            ...(shift_start_time !== undefined && { shift_start_time }),
            ...(shift_end_time !== undefined && { shift_end_time }),
            ...(start_date !== undefined && { start_date: start_date || null }),
            ...(end_date !== undefined && { end_date: end_date || null }),
            ...(notes !== undefined && { notes }),
            ...(status != null && { status }),
        });

        const updated = await Project.findByPk(project.id, {
            include: [{ model: Client, as: 'client', attributes: ['id', 'company_name'] }],
        });

        return successResponse(res, updated, 'Project updated successfully.');
    } catch (error) {
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
        return errorResponse(res, 'Failed to permanently delete project.', 500);
    }
};

/**
 * GET /api/projects/utils/resolve-map-url?url=...
 * Resolves short Google Maps URLs to their long form to extract coordinates.
 */
const resolveMapUrl = async (req, res) => {
    const { url } = req.query;
    if (!url) return errorResponse(res, 'URL requerida', 400);

    try {
        const response = await fetch(url, { redirect: 'follow' });
        const finalUrl = response.url;

        // Try standard coordinates extractions on the final URL
        const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        const qMatch = finalUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
        const llMatch = finalUrl.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
        const destMatch = finalUrl.match(/[?&]destination=(-?\d+\.\d+),(-?\d+\.\d+)/);

        const match = atMatch || qMatch || llMatch || destMatch;

        if (match) {
            return successResponse(res, { lat: match[1], lng: match[2] }, 'Coordenadas extraídas con éxito.');
        }

        return errorResponse(res, 'El enlace final no contenía coordenadas explícitas. Ingresa manualmente.', 404);
    } catch (error) {
        return errorResponse(res, 'Error al resolver la URL de Google Maps.', 500);
    }
};

module.exports = {
    getAllProjects, getProjectById, getProjectLinkedData,
    createProject, updateProject, deleteProject,
    toggleProjectStatus, forceDeleteProject, resolveMapUrl,
};
