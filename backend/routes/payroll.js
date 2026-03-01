const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    generatePayroll, getAllPayrolls, getPayrollById,
    approvePayroll, markWorkerPaid, getPayrollReview,
} = require('../controllers/payrollController');

router.use(auth);

router.post('/generate', checkRole('admin'), generatePayroll);
router.get('/review', checkRole('admin'), getPayrollReview);
router.get('/', checkRole('admin'), getAllPayrolls);
router.get('/:id', checkRole('admin'), getPayrollById);
router.put('/:id/approve', checkRole('admin'), approvePayroll);
router.put('/lines/:id/paid', checkRole('admin'), markWorkerPaid);

module.exports = router;
