const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const { Worker, Assignment, TimeEntry, Project, Trade, WorkerRating } = require('../models');

/**
 * GET /api/performance/workers
 * Lista de workers con métricas de rendimiento resumidas.
 */
const getWorkersPerformance = async (req, res) => {
    try {
        const { from, to, trade_id } = req.query;

        const dateWhere = {};
        if (from) dateWhere[Op.gte] = new Date(from);
        if (to)   dateWhere[Op.lte] = new Date(to + 'T23:59:59');

        const workerWhere = { is_active: true, deleted_at: null };
        if (trade_id) workerWhere.trade_id = trade_id;

        const workers = await Worker.findAll({
            where: workerWhere,
            attributes: ['id', 'worker_code', 'first_name', 'last_name', 'availability', 'hourly_rate'],
            include: [
                { model: Trade, as: 'trade', attributes: ['id', 'name'] },
            ],
            order: [['last_name', 'ASC']],
        });

        // Para cada worker calcular métricas
        const results = await Promise.all(workers.map(async (w) => {
            const teWhere = { worker_id: w.id, is_active: true };
            if (Object.keys(dateWhere).length) {
                teWhere.clock_in = dateWhere;
            }

            // Total horas trabajadas
            const hoursResult = await TimeEntry.findOne({
                where: { ...teWhere, clock_out: { [Op.ne]: null } },
                attributes: [[fn('SUM', col('total_hours')), 'total']],
                raw: true,
            });
            const totalHours = parseFloat(hoursResult?.total || 0);

            // Entradas aprobadas vs. total completadas
            const approvedCount = await TimeEntry.count({
                where: { ...teWhere, clock_out: { [Op.ne]: null }, status: 'approved' },
            });
            const completedCount = await TimeEntry.count({
                where: { ...teWhere, clock_out: { [Op.ne]: null } },
            });

            // Proyectos únicos trabajados
            const projectsWorked = await TimeEntry.count({
                where: { ...teWhere, clock_out: { [Op.ne]: null } },
                distinct: true,
                col: 'project_id',
            });

            // Asignaciones completadas
            const asnWhere = { worker_id: w.id, is_active: true };
            if (from) asnWhere.start_date = { [Op.gte]: from };
            const assignmentsCompleted = await Assignment.count({
                where: { ...asnWhere, status: 'completed' },
            });
            const assignmentsActive = await Assignment.count({
                where: { worker_id: w.id, is_active: true, status: 'active' },
            });

            // Rating promedio
            let avgRating = null;
            let ratingCount = 0;
            try {
                const ratingResult = await WorkerRating.findOne({
                    where: { worker_id: w.id },
                    attributes: [
                        [fn('AVG', col('rating')), 'avg'],
                        [fn('COUNT', col('id')), 'cnt'],
                    ],
                    raw: true,
                });
                avgRating = ratingResult?.avg ? parseFloat(ratingResult.avg).toFixed(1) : null;
                ratingCount = parseInt(ratingResult?.cnt || 0);
            } catch { /* WorkerRating might not exist yet */ }

            const approvalRate = completedCount > 0
                ? Math.round((approvedCount / completedCount) * 100)
                : null;

            return {
                id: w.id,
                worker_code: w.worker_code,
                first_name: w.first_name,
                last_name: w.last_name,
                trade: w.trade?.name || '—',
                availability: w.availability,
                hourly_rate: parseFloat(w.hourly_rate || 0),
                total_hours: totalHours,
                approval_rate: approvalRate,
                projects_worked: projectsWorked,
                assignments_completed: assignmentsCompleted,
                assignments_active: assignmentsActive,
                avg_rating: avgRating,
                rating_count: ratingCount,
            };
        }));

        return res.json({ success: true, data: results, total: results.length });
    } catch (err) {
        console.error('[Performance] getWorkersPerformance:', err.message);
        return res.status(500).json({ success: false, message: 'Error al calcular rendimiento.' });
    }
};

/**
 * GET /api/performance/workers/:id
 * Detalle de rendimiento de un worker específico.
 */
const getWorkerPerformanceDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const { from, to } = req.query;

        const worker = await Worker.findOne({
            where: { id, is_active: true, deleted_at: null },
            attributes: ['id', 'worker_code', 'first_name', 'last_name', 'availability', 'hourly_rate', 'status'],
            include: [{ model: Trade, as: 'trade', attributes: ['id', 'name'] }],
        });
        if (!worker) {
            return res.status(404).json({ success: false, message: 'Worker no encontrado.' });
        }

        const dateWhere = {};
        if (from) dateWhere[Op.gte] = new Date(from);
        if (to)   dateWhere[Op.lte] = new Date(to + 'T23:59:59');

        const teWhere = { worker_id: id, is_active: true };
        if (Object.keys(dateWhere).length) teWhere.clock_in = dateWhere;

        // Horas por semana (últimas 8 semanas o rango)
        const entries = await TimeEntry.findAll({
            where: { ...teWhere, clock_out: { [Op.ne]: null } },
            attributes: ['clock_in', 'total_hours', 'status', 'project_id'],
            include: [{ model: Project, as: 'project', attributes: ['id', 'name'] }],
            order: [['clock_in', 'DESC']],
            limit: 200,
        });

        // Agrupar por semana
        const weekMap = {};
        entries.forEach(e => {
            const d = new Date(e.clock_in);
            // ISO week monday
            const mon = new Date(d);
            mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
            const key = mon.toISOString().split('T')[0];
            if (!weekMap[key]) weekMap[key] = { week: key, hours: 0, days: new Set() };
            weekMap[key].hours += parseFloat(e.total_hours || 0);
            weekMap[key].days.add(d.toISOString().split('T')[0]);
        });
        const weeklyHours = Object.values(weekMap)
            .map(w => ({ week: w.week, hours: parseFloat(w.hours.toFixed(2)), days_worked: w.days.size }))
            .sort((a, b) => a.week.localeCompare(b.week))
            .slice(-12);

        // Horas por proyecto
        const projectHoursMap = {};
        entries.forEach(e => {
            const pName = e.project?.name || 'Sin proyecto';
            if (!projectHoursMap[pName]) projectHoursMap[pName] = 0;
            projectHoursMap[pName] += parseFloat(e.total_hours || 0);
        });
        const projectHours = Object.entries(projectHoursMap)
            .map(([name, hours]) => ({ name, hours: parseFloat(hours.toFixed(2)) }))
            .sort((a, b) => b.hours - a.hours);

        const totalHours = entries.reduce((s, e) => s + parseFloat(e.total_hours || 0), 0);
        const approvedCount = entries.filter(e => e.status === 'approved').length;
        const approvalRate = entries.length > 0
            ? Math.round((approvedCount / entries.length) * 100)
            : null;

        // Asignaciones historial
        const assignments = await Assignment.findAll({
            where: { worker_id: id, is_active: true },
            include: [{ model: Project, as: 'project', attributes: ['id', 'name'] }],
            order: [['start_date', 'DESC']],
            limit: 10,
        });

        // Ratings
        let ratings = [];
        let avgRating = null;
        try {
            ratings = await WorkerRating.findAll({
                where: { worker_id: id },
                order: [['created_at', 'DESC']],
                limit: 10,
            });
            if (ratings.length > 0) {
                avgRating = (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1);
            }
        } catch { /* WorkerRating might not exist */ }

        return res.json({
            success: true,
            data: {
                worker: {
                    id: worker.id,
                    worker_code: worker.worker_code,
                    first_name: worker.first_name,
                    last_name: worker.last_name,
                    trade: worker.trade?.name,
                    availability: worker.availability,
                    hourly_rate: parseFloat(worker.hourly_rate || 0),
                    status: worker.status,
                },
                metrics: {
                    total_hours: parseFloat(totalHours.toFixed(2)),
                    total_entries: entries.length,
                    approval_rate: approvalRate,
                    avg_rating: avgRating,
                    rating_count: ratings.length,
                    assignments_completed: assignments.filter(a => a.status === 'completed').length,
                    assignments_active: assignments.filter(a => a.status === 'active').length,
                },
                weekly_hours: weeklyHours,
                project_hours: projectHours,
                recent_assignments: assignments.map(a => ({
                    id: a.id,
                    project: a.project?.name,
                    start_date: a.start_date,
                    end_date: a.end_date,
                    status: a.status,
                })),
                ratings: ratings.map(r => ({
                    id: r.id,
                    rating: r.rating,
                    comment: r.comment,
                    rated_by: r.rated_by,
                    created_at: r.created_at,
                })),
            },
        });
    } catch (err) {
        console.error('[Performance] getWorkerPerformanceDetail:', err.message);
        return res.status(500).json({ success: false, message: 'Error al obtener detalle.' });
    }
};

module.exports = { getWorkersPerformance, getWorkerPerformanceDetail };
