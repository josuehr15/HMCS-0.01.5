const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getAllAssignments,
    getAssignmentById,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    getMyAssignments,
} = require('../controllers/assignmentController');

router.use(auth);

// Contractor: ver sus propios assignments activos (debe ir antes de /:id)
router.get('/my', checkRole('contractor'), getMyAssignments);

router.get('/', checkRole('admin'), getAllAssignments);
router.get('/:id', checkRole('admin'), getAssignmentById);
router.post('/', checkRole('admin'), createAssignment);
router.put('/:id', checkRole('admin'), updateAssignment);
router.delete('/:id', checkRole('admin'), deleteAssignment);

module.exports = router;
