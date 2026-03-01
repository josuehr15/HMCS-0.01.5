const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getAllClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient,
} = require('../controllers/clientController');

// All routes require JWT authentication
router.use(auth);

// GET /api/clients - List all (admin only)
router.get('/', checkRole('admin'), getAllClients);

// GET /api/clients/:id - Get one (admin only)
router.get('/:id', checkRole('admin'), getClientById);

// POST /api/clients - Create (admin only)
router.post('/', checkRole('admin'), createClient);

// PUT /api/clients/:id - Update (admin only)
router.put('/:id', checkRole('admin'), updateClient);

// DELETE /api/clients/:id - Soft delete (admin only)
router.delete('/:id', checkRole('admin'), deleteClient);

module.exports = router;
