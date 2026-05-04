const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const { getDashboard, getProjects, getInvoices, getWorkers, getInvoiceHtml } = require('../controllers/clientPortalController');

// All client portal routes require authentication + 'client' role
router.use(auth);
router.use(checkRole('client'));

// GET /api/client/dashboard
router.get('/dashboard', getDashboard);

// GET /api/client/projects
router.get('/projects', getProjects);

// GET /api/client/invoices  ?status=sent|paid|overdue|...
router.get('/invoices', getInvoices);

// GET /api/client/workers
router.get('/workers', getWorkers);

// GET /api/client/invoices/:id/html — invoice HTML (ownership verified)
router.get('/invoices/:id/html', getInvoiceHtml);

module.exports = router;
