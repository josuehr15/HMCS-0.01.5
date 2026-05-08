const { WorkerRating, Worker, Project } = require('../models');

/**
 * GET /api/ratings?worker_id=X
 */
const getRatings = async (req, res) => {
    try {
        const where = { is_active: true };
        if (req.query.worker_id) where.worker_id = req.query.worker_id;

        const ratings = await WorkerRating.findAll({
            where,
            include: [
                { model: Worker, as: 'worker', attributes: ['id', 'worker_code', 'first_name', 'last_name'] },
                { model: Project, as: 'project', attributes: ['id', 'name'] },
            ],
            order: [['created_at', 'DESC']],
        });

        return res.json({ success: true, data: ratings, total: ratings.length });
    } catch (err) {
        console.error('[Ratings] getRatings:', err.message);
        return res.status(500).json({ success: false, message: 'Error al obtener ratings.' });
    }
};

/**
 * POST /api/ratings
 */
const createRating = async (req, res) => {
    try {
        const { worker_id, project_id, rating, comment } = req.body;

        if (!worker_id || !rating) {
            return res.status(400).json({ success: false, message: 'worker_id y rating son requeridos.' });
        }
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'El rating debe estar entre 1 y 5.' });
        }

        const worker = await Worker.findOne({ where: { id: worker_id, is_active: true, deleted_at: null } });
        if (!worker) {
            return res.status(404).json({ success: false, message: 'Worker no encontrado.' });
        }

        const rated_by = req.user?.email || 'Admin';

        const newRating = await WorkerRating.create({
            worker_id,
            project_id: project_id || null,
            rating: parseFloat(rating),
            comment: comment || null,
            rated_by,
            is_active: true,
        });

        const full = await WorkerRating.findByPk(newRating.id, {
            include: [
                { model: Worker, as: 'worker', attributes: ['id', 'worker_code', 'first_name', 'last_name'] },
                { model: Project, as: 'project', attributes: ['id', 'name'] },
            ],
        });

        return res.status(201).json({ success: true, data: full, message: 'Rating guardado.' });
    } catch (err) {
        console.error('[Ratings] createRating:', err.message);
        return res.status(500).json({ success: false, message: 'Error al guardar rating.' });
    }
};

/**
 * DELETE /api/ratings/:id  (soft delete)
 */
const deleteRating = async (req, res) => {
    try {
        const rating = await WorkerRating.findOne({ where: { id: req.params.id, is_active: true } });
        if (!rating) {
            return res.status(404).json({ success: false, message: 'Rating no encontrado.' });
        }
        await rating.update({ is_active: false });
        return res.json({ success: true, message: 'Rating eliminado.' });
    } catch (err) {
        console.error('[Ratings] deleteRating:', err.message);
        return res.status(500).json({ success: false, message: 'Error al eliminar rating.' });
    }
};

module.exports = { getRatings, createRating, deleteRating };
