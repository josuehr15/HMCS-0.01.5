const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getAllProjects, getProjectById, getProjectLinkedData,
    createProject, updateProject, deleteProject,
    toggleProjectStatus, forceDeleteProject, resolveMapUrl,
} = require('../controllers/projectController');

router.use(auth);

// ── Sub-resource routes BEFORE /:id ────────────────────────────────
router.get('/utils/resolve-map-url', checkRole('admin'), resolveMapUrl);
router.get('/:id/linked-data', checkRole('admin'), getProjectLinkedData);
router.patch('/:id/toggle-status', checkRole('admin'), toggleProjectStatus);
router.delete('/:id/force', checkRole('admin'), forceDeleteProject);

// ── Collection routes ──────────────────────────────────────────────
router.get('/', checkRole('admin'), getAllProjects);
router.post('/', checkRole('admin'), createProject);

// ── Single-resource routes ─────────────────────────────────────────
router.get('/:id', checkRole('admin'), getProjectById);
router.put('/:id', checkRole('admin'), updateProject);
router.delete('/:id', checkRole('admin'), deleteProject);

module.exports = router;
