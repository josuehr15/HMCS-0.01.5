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
    toggleWorkerStatus,
    forceDeleteWorker,
    resetWorkerPassword,
    getWorkerLinkedData,
} = require('../controllers/workerController');

// All routes require JWT authentication
router.use(auth);

// GET    /api/workers          - List all (admin only)
router.get('/', checkRole('admin'), getAllWorkers);

// GET    /api/workers/:id      - Get one (admin only)
router.get('/:id', checkRole('admin'), getWorkerById);

// GET    /api/workers/:id/linked-data  - Count linked records (pre-delete)
router.get('/:id/linked-data', checkRole('admin'), getWorkerLinkedData);

// POST   /api/workers          - Create (or reactivate if email exists inactive)
router.post('/', checkRole('admin'), createWorker);

// PUT    /api/workers/:id      - Update worker data
router.put('/:id', checkRole('admin'), updateWorker);

// PATCH  /api/workers/:id/toggle-status  - Toggle active/inactive
router.patch('/:id/toggle-status', checkRole('admin'), toggleWorkerStatus);

// PUT    /api/workers/:id/reset-password  - Generate temp password
router.put('/:id/reset-password', checkRole('admin'), resetWorkerPassword);

// DELETE /api/workers/:id      - Soft delete
router.delete('/:id', checkRole('admin'), deleteWorker);

// DELETE /api/workers/:id/force - Hard delete (anonymize email, requires worker_code confirmation)
router.delete('/:id/force', checkRole('admin'), forceDeleteWorker);

module.exports = router;
