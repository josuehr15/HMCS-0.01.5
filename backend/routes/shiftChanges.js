const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getPendingCount,
    getShiftChanges,
    createShiftChange,
    respondShiftChange,
    reviewShiftChange,
    cancelShiftChange,
} = require('../controllers/shiftChangeController');

router.use(auth);

// GET  /api/shift-changes/pending-count — badge para contractor (cuántas esperan su respuesta)
router.get('/pending-count', checkRole('contractor'), getPendingCount);

// GET  /api/shift-changes — admin ve todo, contractor ve las suyas
router.get('/', getShiftChanges);

// POST /api/shift-changes — contractor crea solicitud
router.post('/', checkRole('contractor'), createShiftChange);

// PUT  /api/shift-changes/:id/respond — target contractor acepta/rechaza
router.put('/:id/respond', checkRole('contractor'), respondShiftChange);

// PUT  /api/shift-changes/:id/review — admin aprueba/rechaza
router.put('/:id/review', checkRole('admin'), reviewShiftChange);

// DELETE /api/shift-changes/:id — requester cancela
router.delete('/:id', checkRole('contractor'), cancelShiftChange);

module.exports = router;
