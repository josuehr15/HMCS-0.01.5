const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    generateInvoice, getAllInvoices, getInvoiceStats, getInvoiceById,
    getUnbilledWeeks, updateInvoice, updateInvoiceStatus, deleteInvoice,
    getInvoiceHtml, getCompanySettingsHandler, sendInvoiceEmail,
    approveInvoice, markAsSent, markAsPaid,
} = require('../controllers/invoiceController');

router.use(auth);

// ── Sub-resource / collection routes BEFORE /:id ────────────────────
router.get('/stats', checkRole('admin'), getInvoiceStats);
router.get('/unbilled-weeks', checkRole('admin'), getUnbilledWeeks);
router.get('/company-settings', checkRole('admin'), getCompanySettingsHandler);
router.post('/generate', checkRole('admin'), generateInvoice);

// ── Collection ────────────────────────────────────────────────────────
router.get('/', checkRole('admin'), getAllInvoices);

// ── Single-resource ───────────────────────────────────────────────────
router.get('/:id', checkRole('admin'), getInvoiceById);
router.put('/:id', checkRole('admin'), updateInvoice);
router.patch('/:id/status', checkRole('admin'), updateInvoiceStatus);
router.delete('/:id', checkRole('admin'), deleteInvoice);
router.get('/:id/html', checkRole('admin'), getInvoiceHtml);
router.post('/:id/send-email', checkRole('admin'), sendInvoiceEmail);

// Legacy routes (backward compat)
router.put('/:id/approve', checkRole('admin'), approveInvoice);
router.put('/:id/send', checkRole('admin'), markAsSent);
router.put('/:id/paid', checkRole('admin'), markAsPaid);

module.exports = router;
