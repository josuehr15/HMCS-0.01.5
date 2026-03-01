const { Trade } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * GET /api/trades
 * List all active trades.
 */
const getAllTrades = async (req, res) => {
    try {
        const trades = await Trade.findAll({
            where: { is_active: true },
            order: [['name', 'ASC']],
        });

        return successResponse(res, trades, 'Trades retrieved successfully.');
    } catch (error) {
        console.error('getAllTrades error:', error);
        return errorResponse(res, 'Failed to retrieve trades.', 500);
    }
};

/**
 * POST /api/trades
 * Create a new trade.
 */
const createTrade = async (req, res) => {
    try {
        const { name, name_es } = req.body;

        if (!name || !name_es) {
            return errorResponse(res, 'Missing required fields: name, name_es.', 400);
        }

        // Check if trade name already exists
        const existing = await Trade.findOne({ where: { name } });
        if (existing) {
            return errorResponse(res, 'A trade with this name already exists.', 409);
        }

        const trade = await Trade.create({ name, name_es });
        return successResponse(res, trade, 'Trade created successfully.', 201);
    } catch (error) {
        console.error('createTrade error:', error);
        return errorResponse(res, 'Failed to create trade.', 500);
    }
};

/**
 * PUT /api/trades/:id
 * Update a trade.
 */
const updateTrade = async (req, res) => {
    try {
        const trade = await Trade.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!trade) {
            return errorResponse(res, 'Trade not found.', 404);
        }

        const { name, name_es } = req.body;

        await trade.update({
            name: name || trade.name,
            name_es: name_es || trade.name_es,
        });

        return successResponse(res, trade, 'Trade updated successfully.');
    } catch (error) {
        console.error('updateTrade error:', error);
        return errorResponse(res, 'Failed to update trade.', 500);
    }
};

/**
 * DELETE /api/trades/:id
 * Soft delete a trade.
 */
const deleteTrade = async (req, res) => {
    try {
        const trade = await Trade.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!trade) {
            return errorResponse(res, 'Trade not found.', 404);
        }

        await trade.update({ is_active: false });
        return successResponse(res, { id: trade.id, name: trade.name }, 'Trade deactivated successfully.');
    } catch (error) {
        console.error('deleteTrade error:', error);
        return errorResponse(res, 'Failed to delete trade.', 500);
    }
};

module.exports = { getAllTrades, createTrade, updateTrade, deleteTrade };
