const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const { getMatchesForProject, getActiveProjects } = require('../controllers/matchingController');

router.use(auth);
router.use(checkRole('admin'));

// GET /api/matching/projects  — lista proyectos activos (para el selector)
router.get('/projects', getActiveProjects);

// GET /api/matching/project/:project_id  — candidatos rankeados para un proyecto
router.get('/project/:project_id', getMatchesForProject);

module.exports = router;
