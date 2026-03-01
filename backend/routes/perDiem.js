const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    createPerDiem, getAllPerDiem, markPerDiemPaid, getWorkerPerDiem,
} = require('../controllers/perDiemController');

router.use(auth);

// Contractor
router.get('/my', checkRole('contractor'), getWorkerPerDiem);

// Admin
router.post('/', checkRole('admin'), createPerDiem);
router.get('/', checkRole('admin'), getAllPerDiem);
router.put('/:id/paid', checkRole('admin'), markPerDiemPaid);

module.exports = router;
