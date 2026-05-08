/**
 * matchingController.js
 * Algoritmo de matching automático worker → proyecto.
 *
 * Endpoints:
 *   GET /api/matching/project/:project_id
 *     → Lista de workers rankeados por score de compatibilidad.
 *
 * Criterios de scoring (100 pts máximo):
 *   40 pts  — Trade match: el worker tiene el trade que el proyecto necesita
 *   25 pts  — Disponibilidad de días: % de días del proyecto cubiertos por el worker
 *   20 pts  — Horario: solapamiento entre turno del proyecto y horario del worker
 *   15 pts  — Status disponible (availability = 'available' y sin assignment activo)
 *
 * Workers ya asignados al proyecto (activos) se excluyen del resultado.
 */

const { Op } = require('sequelize');
const {
    Worker, Project, Assignment, Trade,
    WorkerAvailability, ClientRate,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// ─── Helpers ──────────────────────────────────────────────────────────────

// Convierte "HH:MM" a minutos desde medianoche
const toMin = (t) => {
    if (!t) return null;
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
};

// Solapamiento en minutos entre dos rangos
const overlap = (s1, e1, s2, e2) => {
    if (s1 === null || e1 === null || s2 === null || e2 === null) return 0;
    return Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
};

// Días de la semana que abarca un proyecto (0=Dom..6=Sáb)
// Si no tiene shift_start definido asumimos Lun-Vie (1-5)
const projectDays = (project) => {
    // Por ahora asumimos que los proyectos trabajan Lun-Vie
    // En el futuro se puede agregar un campo work_days al proyecto
    return [1, 2, 3, 4, 5]; // Monday-Friday
};

// Score de solapamiento horario (0-1)
const scheduleScore = (project, workerSchedule) => {
    const projStart = toMin(project.shift_start_time);
    const projEnd   = toMin(project.shift_end_time);
    if (projStart === null || projEnd === null) return 0.5; // sin datos = neutral

    const projDuration = projEnd - projStart;
    if (projDuration <= 0) return 0.5;

    const days = projectDays(project);
    let totalOverlap = 0;
    let daysChecked = 0;

    for (const dayNum of days) {
        const dayRecord = workerSchedule.find(d => d.day_of_week === dayNum);
        if (!dayRecord || !dayRecord.is_available) continue;
        daysChecked++;
        const wStart = toMin(dayRecord.start_time);
        const wEnd   = toMin(dayRecord.end_time);
        const ol = overlap(projStart, projEnd, wStart, wEnd);
        totalOverlap += ol / projDuration; // fracción cubierta
    }

    if (daysChecked === 0) return 0;
    return totalOverlap / daysChecked;
};

// Días disponibles del worker que coinciden con los días del proyecto (0-1)
const daysCoverageScore = (project, workerSchedule) => {
    const days = projectDays(project);
    const availDays = workerSchedule.filter(d =>
        days.includes(d.day_of_week) && d.is_available
    ).length;
    return days.length > 0 ? availDays / days.length : 0;
};

// ─── GET /api/matching/project/:project_id ────────────────────────────────
const getMatchesForProject = async (req, res) => {
    try {
        const { project_id } = req.params;

        // 1. Cargar proyecto con su cliente
        const project = await Project.findByPk(project_id, {
            include: [{ association: 'client', attributes: ['id', 'company_name'] }],
        });
        if (!project) return errorResponse(res, 'Project not found', 404);

        // 2. Trades que el cliente paga (para saber qué trades acepta el proyecto)
        const clientRates = await ClientRate.findAll({
            where: { client_id: project.client_id },
            include: [{ association: 'trade', attributes: ['id', 'name'] }],
        });
        const acceptedTradeIds = new Set(clientRates.map(r => r.trade_id));

        // 3. Workers ya asignados a este proyecto (activos) — excluirlos
        const existingAssignments = await Assignment.findAll({
            where: { project_id, status: 'active', is_active: true },
            attributes: ['worker_id'],
        });
        const assignedWorkerIds = new Set(existingAssignments.map(a => a.worker_id));

        // 4. Cargar todos los workers activos con su trade y disponibilidad
        const workers = await Worker.findAll({
            where: { is_active: true, status: 'active' },
            include: [
                { association: 'trade', attributes: ['id', 'name'] },
                { association: 'availabilitySchedule', required: false },
            ],
        });

        // 5. Calcular score para cada worker
        const results = [];

        for (const worker of workers) {
            // Excluir ya asignados
            if (assignedWorkerIds.has(worker.id)) continue;

            const schedule = worker.availabilitySchedule || [];

            // ── Trade match (40 pts) ──────────────────────────────
            const tradeMatch = acceptedTradeIds.has(worker.trade_id);
            const tradeScore = tradeMatch ? 40 : 0;

            // ── Días disponibles (25 pts) ─────────────────────────
            const coverage = daysCoverageScore(project, schedule);
            const daysScore = Math.round(coverage * 25);

            // ── Horario (20 pts) ──────────────────────────────────
            const sched = scheduleScore(project, schedule);
            const schedScore = Math.round(sched * 20);

            // ── Status disponible (15 pts) ────────────────────────
            const isAvailable = worker.availability === 'available';
            const statusScore = isAvailable ? 15 : (worker.availability === 'assigned' ? 5 : 0);

            const total = tradeScore + daysScore + schedScore + statusScore;

            // Detalles de disponibilidad por día
            const days = projectDays(project);
            const dayDetails = days.map(d => {
                const rec = schedule.find(s => s.day_of_week === d);
                return {
                    day_of_week: d,
                    is_available: rec?.is_available ?? false,
                    start_time: rec?.start_time ?? null,
                    end_time: rec?.end_time ?? null,
                };
            });

            // ClientRate si aplica
            const rate = clientRates.find(r => r.trade_id === worker.trade_id);

            results.push({
                worker_id:       worker.id,
                worker_code:     worker.worker_code,
                first_name:      worker.first_name,
                last_name:       worker.last_name,
                trade_id:        worker.trade_id,
                trade_name:      worker.trade?.name ?? null,
                hourly_rate:     parseFloat(worker.hourly_rate),
                availability:    worker.availability,
                score:           total,
                score_breakdown: {
                    trade:    tradeScore,
                    days:     daysScore,
                    schedule: schedScore,
                    status:   statusScore,
                },
                trade_match:     tradeMatch,
                days_coverage:   Math.round(coverage * 100),
                client_rate:     rate ? parseFloat(rate.hourly_rate) : null,
                day_details:     dayDetails,
            });
        }

        // 6. Ordenar por score desc, luego por trade_match, luego por nombre
        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.first_name.localeCompare(b.first_name);
        });

        return successResponse(res, {
            project: {
                id: project.id,
                name: project.name,
                client_name: project.client?.company_name ?? null,
                shift_start_time: project.shift_start_time,
                shift_end_time: project.shift_end_time,
                status: project.status,
                accepted_trades: clientRates.map(r => ({
                    trade_id: r.trade_id,
                    trade_name: r.trade?.name ?? null,
                    hourly_rate: parseFloat(r.hourly_rate),
                })),
                already_assigned: existingAssignments.length,
            },
            candidates: results,
            total: results.length,
        });
    } catch (err) {
        console.error('[matching] error:', err);
        return errorResponse(res, err.message, 500);
    }
};

// ─── GET /api/matching/projects — proyectos activos para el selector ───────
const getActiveProjects = async (req, res) => {
    try {
        const projects = await Project.findAll({
            where: { is_active: true, status: 'active' },
            attributes: ['id', 'name', 'address', 'shift_start_time', 'shift_end_time'],
            include: [{ association: 'client', attributes: ['id', 'company_name'] }],
            order: [['name', 'ASC']],
        });
        return successResponse(res, projects.map(p => ({
            id: p.id,
            name: p.name,
            address: p.address,
            client_name: p.client?.company_name ?? null,
            shift_start_time: p.shift_start_time,
            shift_end_time: p.shift_end_time,
        })));
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

module.exports = { getMatchesForProject, getActiveProjects };
