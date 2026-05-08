const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const { getWorkersPerformance, getWorkerPerformanceDetail } = require('../controllers/performanceController');

router.use(auth);
router.use(checkRole('admin'));

router.get('/workers',     getWorkersPerformance);
router.get('/workers/:id', getWorkerPerformanceDetail);

module.exports = router;
