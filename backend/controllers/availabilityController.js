/**
 * availabilityController.js
 * Disponibilidad semanal de workers.
 *
 * Endpoints:
 *   GET    /api/availability            — admin: todos | contractor: la suya
 *   GET    /api/availability/:worker_id — admin: disponibilidad de un worker específico
 *   PUT    /api/availability            — contractor: upsert su disponibilidad (array de 7 días)
 *   PUT    /api/availability/:worker_id — admin: upsert disponibilidad de un worker específico
 */
const { WorkerAvailability, Worker } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Devuelve los 7 días con defaults si no existen registros
const buildFullWeek = (records) => {
    const map = {};
    records.forEach(r => { map[r.day_of_week] = r; });
    return Array.from({ length: 7 }, (_, day) => ({
        day_of_week: day,
        day_name: DAYS[day],
        is_available: map[day]?.is_available ?? true,
        start_time: map[day]?.start_time ?? '07:00',
        end_time: map[day]?.end_time ?? '17:00',
        note: map[day]?.note ?? null,
        id: map[day]?.id ?? null,
    }));
};

// ─── GET /api/availability ────────────────────────────────────────────────────
const getAvailability = async (req, res) => {
    try {
        const { role, id: userId } = req.user;

        if (role === 'contractor') {
            const worker = await Worker.findOne({ where: { user_id: userId } });
            if (!worker) return errorResponse(res, 'Worker not found', 404);

            const records = await WorkerAvailability.findAll({ where: { worker_id: worker.id } });
            return successResponse(res, buildFullWeek(records));
        }

        // Admin — devuelve todos los workers con su disponibilidad
        const workers = await Worker.findAll({
            where: { is_active: true },
            attributes: ['id', 'first_name', 'last_name', 'worker_code', 'availability'],
            include: [{
                model: WorkerAvailability,
                as: 'availabilitySchedule',
                required: false,
            }],
            order: [['first_name', 'ASC']],
        });

        const result = workers.map(w => ({
            worker_id:    w.id,
            worker_code:  w.worker_code,
            first_name:   w.first_name,
            last_name:    w.last_name,
            availability_status: w.availability,
            schedule: buildFullWeek(w.availabilitySchedule || []),
        }));

        return successResponse(res, result);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

// ─── GET /api/availability/:worker_id — admin ─────────────────────────────────
const getWorkerAvailability = async (req, res) => {
    try {
        const { worker_id } = req.params;
        const worker = await Worker.findByPk(worker_id, {
            attributes: ['id', 'first_name', 'last_name', 'worker_code', 'availability'],
        });
        if (!worker) return errorResponse(res, 'Worker not found', 404);

        const records = await WorkerAvailability.findAll({ where: { worker_id } });
        return successResponse(res, {
            worker_id: worker.id,
            worker_code: worker.worker_code,
            first_name: worker.first_name,
            last_name: worker.last_name,
            availability_status: worker.availability,
            schedule: buildFullWeek(records),
        });
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

// ─── PUT /api/availability — contractor upsert su disponibilidad ──────────────
const setMyAvailability = async (req, res) => {
    try {
        const { id: userId } = req.user;
        const worker = await Worker.findOne({ where: { user_id: userId } });
        if (!worker) return errorResponse(res, 'Worker not found', 404);

        return upsertAvailability(res, worker.id, req.body);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

// ─── PUT /api/availability/:worker_id — admin upsert de cualquier worker ──────
const setWorkerAvailability = async (req, res) => {
    try {
        const { worker_id } = req.params;
        const worker = await Worker.findByPk(worker_id);
        if (!worker) return errorResponse(res, 'Worker not found', 404);

        return upsertAvailability(res, parseInt(worker_id), req.body);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

// ─── Shared upsert logic ──────────────────────────────────────────────────────
// body puede ser:
//   { schedule: [ { day_of_week, is_available, start_time, end_time, note } ] }
// o directamente un array
const upsertAvailability = async (res, workerId, body) => {
    const schedule = Array.isArray(body) ? body : (body.schedule || []);
    if (!Array.isArray(schedule) || schedule.length === 0) {
        return errorResponse(res, 'Se requiere un array "schedule" con los días', 400);
    }

    const results = [];
    for (const day of schedule) {
        const { day_of_week, is_available, start_time, end_time, note } = day;
        if (day_of_week === undefined || day_of_week < 0 || day_of_week > 6) continue;

        const [record] = await WorkerAvailability.upsert({
            worker_id: workerId,
            day_of_week: parseInt(day_of_week),
            is_available: is_available !== undefined ? Boolean(is_available) : true,
            start_time: start_time || '07:00',
            end_time: end_time || '17:00',
            note: note || null,
        }, { returning: true });
        results.push(record);
    }

    const fresh = await WorkerAvailability.findAll({ where: { worker_id: workerId } });
    return successResponse(res, buildFullWeek(fresh));
};

module.exports = {
    getAvailability,
    getWorkerAvailability,
    setMyAvailability,
    setWorkerAvailability,
};
