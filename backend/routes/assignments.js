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
} = require('../controllers/assignmentController');

router.use(auth);

router.get('/', checkRole('admin'), getAllAssignments);
router.get('/:id', checkRole('admin'), getAssignmentById);
router.post('/', checkRole('admin'), createAssignment);
router.put('/:id', checkRole('admin'), updateAssignment);
router.delete('/:id', checkRole('admin'), deleteAssignment);

module.exports = router;
