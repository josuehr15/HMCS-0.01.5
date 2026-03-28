const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    clockIn, clockOut,
    getMyTimeEntries, getAllTimeEntries, getTimeEntryById,
    createManualEntry, updateTimeEntry,
    updateEntryStatus, bulkUpdateStatus,
    deleteTimeEntry, getSummary,
    approveTimeEntry, flagTimeEntry,
} = require('../controllers/timeEntryController');

router.use(auth);

// ── Sub-resource / action routes BEFORE /:id ───────────────────────
// Contractor
router.post('/clock-in', checkRole('contractor'), clockIn);
router.post('/clock-out', checkRole('contractor'), clockOut);
router.get('/my', checkRole('contractor'), getMyTimeEntries);

// Admin — special routes must come before /:id
router.get('/summary', checkRole('admin'), getSummary);
router.patch('/bulk-status', checkRole('admin'), bulkUpdateStatus);

// ── Collection routes ──────────────────────────────────────────────
router.get('/', checkRole('admin'), getAllTimeEntries);
router.post('/', checkRole('admin'), createManualEntry);

// ── Single-resource routes ─────────────────────────────────────────
router.get('/:id', checkRole('admin'), getTimeEntryById);
router.put('/:id', checkRole('admin'), updateTimeEntry);
router.patch('/:id/status', checkRole('admin'), updateEntryStatus);
router.delete('/:id', checkRole('admin'), deleteTimeEntry);

// Legacy (keep for backward compat with ClockPage)
router.put('/:id/approve', checkRole('admin'), approveTimeEntry);
router.put('/:id/flag', checkRole('admin'), flagTimeEntry);

module.exports = router;
