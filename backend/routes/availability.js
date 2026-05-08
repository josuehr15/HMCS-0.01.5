const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getAvailability,
    getWorkerAvailability,
    setMyAvailability,
    setWorkerAvailability,
} = require('../controllers/availabilityController');

router.use(auth);

// GET  /api/availability             — admin: todos | contractor: la suya
router.get('/', getAvailability);

// GET  /api/availability/:worker_id  — admin: un worker específico
router.get('/:worker_id', checkRole('admin'), getWorkerAvailability);

// PUT  /api/availability             — contractor: actualiza su disponibilidad
router.put('/', checkRole('contractor'), setMyAvailability);

// PUT  /api/availability/:worker_id  — admin: actualiza disponibilidad de cualquier worker
router.put('/:worker_id', checkRole('admin'), setWorkerAvailability);

module.exports = router;
