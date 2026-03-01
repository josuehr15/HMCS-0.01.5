const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkRole = require('../middleware/checkRole');
const {
    getAllTrades,
    createTrade,
    updateTrade,
    deleteTrade,
} = require('../controllers/tradeController');

// All routes require JWT authentication
router.use(auth);

// GET /api/trades - List all active trades (admin only)
router.get('/', checkRole('admin'), getAllTrades);

// POST /api/trades - Create (admin only)
router.post('/', checkRole('admin'), createTrade);

// PUT /api/trades/:id - Update (admin only)
router.put('/:id', checkRole('admin'), updateTrade);

// DELETE /api/trades/:id - Soft delete (admin only)
router.delete('/:id', checkRole('admin'), deleteTrade);

module.exports = router;
