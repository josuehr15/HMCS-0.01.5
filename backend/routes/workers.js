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
    getWorkerStats,
} = require('../controllers/workerController');

// All routes require JWT authentication
router.use(auth);

// ── Collection routes ──────────────────────────────────────────────
// GET    /api/workers
router.get('/', checkRole('admin'), getAllWorkers);

// POST   /api/workers  (create or reactivate)
router.post('/', checkRole('admin'), createWorker);

// ── Sub-resource routes (must come BEFORE /:id) ────────────────────
// PATCH  /api/workers/:id/toggle-status
router.patch('/:id/toggle-status', checkRole('admin'), toggleWorkerStatus);

// PUT    /api/workers/:id/reset-password
router.put('/:id/reset-password', checkRole('admin'), resetWorkerPassword);

// GET    /api/workers/:id/linked-data
router.get('/:id/linked-data', checkRole('admin'), getWorkerLinkedData);

// GET    /api/workers/:id/stats
router.get('/:id/stats', checkRole('admin'), getWorkerStats);

// DELETE /api/workers/:id/force
router.delete('/:id/force', checkRole('admin'), forceDeleteWorker);

// ── Single-resource routes (must come AFTER sub-resources) ─────────
// GET    /api/workers/:id
router.get('/:id', checkRole('admin'), getWorkerById);

// PUT    /api/workers/:id
router.put('/:id', checkRole('admin'), updateWorker);

// DELETE /api/workers/:id  (soft delete)
router.delete('/:id', checkRole('admin'), deleteWorker);

module.exports = router;
