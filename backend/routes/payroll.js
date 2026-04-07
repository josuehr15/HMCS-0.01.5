const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getAllPayrolls, getPayrollStats, getPendingWeeks, getPayrollById,
    generatePayroll, updatePayrollStatus, deletePayroll,
    markWorkerPaid, updatePayrollLine, getPayrollLineById,
    approvePayroll,
} = require('../controllers/payrollController');

router.use(auth);

// ── Sub-routes BEFORE /:id ────────────────────────────────────────────
router.get('/stats', checkRole('admin'), getPayrollStats);
router.get('/pending-weeks', checkRole('admin'), getPendingWeeks);
router.post('/generate', checkRole('admin'), generatePayroll);

// ── PayrollLine routes ─────────────────────────────────────────────────
router.get('/lines/:id', checkRole('admin'), getPayrollLineById);
router.patch('/lines/:id/pay', checkRole('admin'), markWorkerPaid);
router.put('/lines/:id', checkRole('admin'), updatePayrollLine);

// ── Collection ─────────────────────────────────────────────────────────
router.get('/', checkRole('admin'), getAllPayrolls);

// ── Single-resource ────────────────────────────────────────────────────
router.get('/:id', checkRole('admin'), getPayrollById);
router.patch('/:id/status', checkRole('admin'), updatePayrollStatus);
router.delete('/:id', checkRole('admin'), deletePayroll);

// Legacy
router.put('/:id/approve', checkRole('admin'), approvePayroll);

module.exports = router;
