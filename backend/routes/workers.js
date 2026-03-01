const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getAllWorkers,
    getWorkerById,
    createWorker,
    updateWorker,
    deleteWorker,
} = require('../controllers/workerController');

// All routes require JWT authentication
router.use(auth);

// GET /api/workers - List all (admin only)
router.get('/', checkRole('admin'), getAllWorkers);

// GET /api/workers/:id - Get one (admin only)
router.get('/:id', checkRole('admin'), getWorkerById);

// POST /api/workers - Create (admin only)
router.post('/', checkRole('admin'), createWorker);

// PUT /api/workers/:id - Update (admin only)
router.put('/:id', checkRole('admin'), updateWorker);

// DELETE /api/workers/:id - Soft delete (admin only)
router.delete('/:id', checkRole('admin'), deleteWorker);

module.exports = router;
