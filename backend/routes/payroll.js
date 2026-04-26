const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getAllPayrolls, getPayrollStats, getPendingWeeks, getPayrollById,
    generatePayroll, updatePayrollStatus, deletePayroll,
    markWorkerPaid, updatePayrollLine, getPayrollLineById,
    approvePayroll,
    uploadPaymentScreenshot, confirmPaymentData, getVoucherView, getMyPayrollLines,
    updatePayrollLinePerDiem,
} = require('../controllers/payrollController');
const uploadScreenshot = require('../middleware/uploadScreenshot');

router.use(auth);

// ── Sub-routes BEFORE /:id ────────────────────────────────────────────
router.get('/stats', checkRole('admin'), getPayrollStats);
router.get('/pending-weeks', checkRole('admin'), getPendingWeeks);
router.post('/generate', checkRole('admin'), generatePayroll);

// ── PayrollLine routes — /lines/my MUST be before /lines/:id ──────────
router.get('/lines/my', checkRole('contractor'), getMyPayrollLines);
// BUG-006: allow admin OR contractor — ownership check inside getVoucherView
router.get('/lines/:id/voucher-view', checkRole('admin', 'contractor'), getVoucherView);
router.get('/lines/:id', checkRole('admin'), getPayrollLineById);
router.post('/lines/:id/upload-screenshot', checkRole('admin'), uploadScreenshot.single('screenshot'), uploadPaymentScreenshot);
router.post('/lines/:id/confirm-payment-data', checkRole('admin'), confirmPaymentData);
router.patch('/lines/:id/per-diem', checkRole('admin'), updatePayrollLinePerDiem);
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
