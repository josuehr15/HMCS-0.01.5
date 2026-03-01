const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    generateInvoice, getAllInvoices, getInvoiceById,
    approveInvoice, markAsSent, markAsPaid,
} = require('../controllers/invoiceController');

router.use(auth);

router.post('/generate', checkRole('admin'), generateInvoice);
router.get('/', checkRole('admin'), getAllInvoices);
router.get('/:id', checkRole('admin'), getInvoiceById);
router.put('/:id/approve', checkRole('admin'), approveInvoice);
router.put('/:id/send', checkRole('admin'), markAsSent);
router.put('/:id/paid', checkRole('admin'), markAsPaid);

module.exports = router;
