const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    clockIn,
    clockOut,
    getMyTimeEntries,
    getAllTimeEntries,
    approveTimeEntry,
    flagTimeEntry,
} = require('../controllers/timeEntryController');

// All routes require JWT authentication
router.use(auth);

// Contractor endpoints
router.post('/clock-in', checkRole('contractor'), clockIn);
router.post('/clock-out', checkRole('contractor'), clockOut);
router.get('/my', checkRole('contractor'), getMyTimeEntries);

// Admin endpoints
router.get('/', checkRole('admin'), getAllTimeEntries);
router.put('/:id/approve', checkRole('admin'), approveTimeEntry);
router.put('/:id/flag', checkRole('admin'), flagTimeEntry);

module.exports = router;
