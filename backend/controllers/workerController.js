const { User, Worker, Trade, Assignment } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const generateWorkerCode = require('../utils/generateWorkerCode');
const bcrypt = require('bcryptjs');

/**
 * GET /api/workers
 * List all workers with optional filters: status, trade_id, availability.
 */
const getAllWorkers = async (req, res) => {
    try {
        const { status, trade_id, availability } = req.query;
        const where = { is_active: true };

        if (status) where.status = status;
        if (trade_id) where.trade_id = trade_id;
        if (availability) where.availability = availability;

        const workers = await Worker.findAll({
            where,
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
            ],
            order: [['created_at', 'DESC']],
        });

        return successResponse(res, workers, 'Workers retrieved successfully.');
    } catch (error) {
        console.error('getAllWorkers error:', error);
        return errorResponse(res, 'Failed to retrieve workers.', 500);
    }
};

/**
 * GET /api/workers/:id
 * Get a single worker with user, trade, and assignments.
 */
const getWorkerById = async (req, res) => {
    try {
        const worker = await Worker.findOne({
            where: { id: req.params.id, is_active: true },
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
                { model: Assignment, as: 'assignments' },
            ],
        });

        if (!worker) {
            return errorResponse(res, 'Worker not found.', 404);
        }

        return successResponse(res, worker, 'Worker retrieved successfully.');
    } catch (error) {
        console.error('getWorkerById error:', error);
        return errorResponse(res, 'Failed to retrieve worker.', 500);
    }
};

/**
 * POST /api/workers
 * Create a new worker + associated user account + auto-generate worker_code.
 */
const createWorker = async (req, res) => {
    try {
        const {
            email, password, first_name, last_name, phone, trade_id,
            hourly_rate, address, emergency_contact_name, emergency_contact_phone,
            notes, preferred_language,
        } = req.body;

        // Validate required fields
        if (!email || !password || !first_name || !last_name || !phone || !trade_id || !hourly_rate) {
            return errorResponse(res, 'Missing required fields: email, password, first_name, last_name, phone, trade_id, hourly_rate.', 400);
        }

        // Check if email already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return errorResponse(res, 'Email is already registered.', 409);
        }

        // Verify trade exists
        const trade = await Trade.findByPk(trade_id);
        if (!trade) {
            return errorResponse(res, 'Invalid trade_id.', 400);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create user with contractor role
        const user = await User.create({
            email,
            password_hash,
            role: 'contractor',
            preferred_language: preferred_language || 'es',
        });

        // Generate unique worker code (XX-0000)
        const worker_code = await generateWorkerCode();

        // Create worker
        const worker = await Worker.create({
            user_id: user.id,
            worker_code,
            first_name,
            last_name,
            phone,
            trade_id,
            hourly_rate,
            address,
            emergency_contact_name,
            emergency_contact_phone,
            notes,
        });

        // Fetch complete worker with relations
        const fullWorker = await Worker.findByPk(worker.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
            ],
        });

        return successResponse(res, fullWorker, 'Worker created successfully.', 201);
    } catch (error) {
        console.error('createWorker error:', error);
        return errorResponse(res, 'Failed to create worker.', 500);
    }
};

/**
 * PUT /api/workers/:id
 * Update worker data. Cannot change worker_code.
 */
const updateWorker = async (req, res) => {
    try {
        const worker = await Worker.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!worker) {
            return errorResponse(res, 'Worker not found.', 404);
        }

        // Destructure allowed fields (worker_code is NOT editable)
        const {
            first_name, last_name, phone, trade_id, hourly_rate,
            status, availability, address, emergency_contact_name,
            emergency_contact_phone, notes, ssn_encrypted,
        } = req.body;

        // If trade_id is changing, verify it exists
        if (trade_id && trade_id !== worker.trade_id) {
            const trade = await Trade.findByPk(trade_id);
            if (!trade) {
                return errorResponse(res, 'Invalid trade_id.', 400);
            }
        }

        await worker.update({
            first_name: first_name || worker.first_name,
            last_name: last_name || worker.last_name,
            phone: phone || worker.phone,
            trade_id: trade_id || worker.trade_id,
            hourly_rate: hourly_rate !== undefined ? hourly_rate : worker.hourly_rate,
            status: status || worker.status,
            availability: availability || worker.availability,
            address: address !== undefined ? address : worker.address,
            emergency_contact_name: emergency_contact_name !== undefined ? emergency_contact_name : worker.emergency_contact_name,
            emergency_contact_phone: emergency_contact_phone !== undefined ? emergency_contact_phone : worker.emergency_contact_phone,
            notes: notes !== undefined ? notes : worker.notes,
            ssn_encrypted: ssn_encrypted !== undefined ? ssn_encrypted : worker.ssn_encrypted,
        });

        // Fetch updated worker with relations
        const updatedWorker = await Worker.findByPk(worker.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'preferred_language'] },
                { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
            ],
        });

        return successResponse(res, updatedWorker, 'Worker updated successfully.');
    } catch (error) {
        console.error('updateWorker error:', error);
        return errorResponse(res, 'Failed to update worker.', 500);
    }
};

/**
 * DELETE /api/workers/:id
 * Soft delete (is_active = false). Warns if worker has linked data.
 */
const deleteWorker = async (req, res) => {
    try {
        const worker = await Worker.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!worker) {
            return errorResponse(res, 'Worker not found.', 404);
        }

        // Check for linked data
        const assignmentCount = await Assignment.count({ where: { worker_id: worker.id } });

        // Perform soft delete
        await worker.update({ is_active: false, status: 'inactive' });

        // Also deactivate associated user
        await User.update({ is_active: false }, { where: { id: worker.user_id } });

        const response = {
            id: worker.id,
            worker_code: worker.worker_code,
        };

        if (assignmentCount > 0) {
            response.warning = `This worker has ${assignmentCount} assignment(s) linked. They have been soft-deleted.`;
            response.linked_data = { assignments: assignmentCount };
        }

        return successResponse(res, response, 'Worker deactivated successfully.');
    } catch (error) {
        console.error('deleteWorker error:', error);
        return errorResponse(res, 'Failed to delete worker.', 500);
    }
};

module.exports = { getAllWorkers, getWorkerById, createWorker, updateWorker, deleteWorker };
