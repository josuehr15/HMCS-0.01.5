const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
} = require('../controllers/projectController');

router.use(auth);

router.get('/', checkRole('admin'), getAllProjects);
router.get('/:id', checkRole('admin'), getProjectById);
router.post('/', checkRole('admin'), createProject);
router.put('/:id', checkRole('admin'), updateProject);
router.delete('/:id', checkRole('admin'), deleteProject);

module.exports = router;
