const bcrypt = require('bcryptjs');
const { User, Client, Project, ClientRate, Trade } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * GET /api/clients
 * List all clients with optional filters: status.
 */
const getAllClients = async (req, res) => {
    try {
        const { status } = req.query;
        const where = { is_active: true };

        if (status) where.status = status;

        const clients = await Client.findAll({
            where,
            include: [
                { model: User, as: 'user', attributes: ['id', 'email'] },
            ],
            order: [['created_at', 'DESC']],
        });

        return successResponse(res, clients, 'Clients retrieved successfully.');
    } catch (error) {
        console.error('getAllClients error:', error);
        return errorResponse(res, 'Failed to retrieve clients.', 500);
    }
};

/**
 * GET /api/clients/:id
 * Get a single client with projects and client_rates.
 */
const getClientById = async (req, res) => {
    try {
        const client = await Client.findOne({
            where: { id: req.params.id, is_active: true },
            include: [
                { model: User, as: 'user', attributes: ['id', 'email'] },
                { model: Project, as: 'projects' },
                {
                    model: ClientRate,
                    as: 'clientRates',
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                },
            ],
        });

        if (!client) {
            return errorResponse(res, 'Client not found.', 404);
        }

        return successResponse(res, client, 'Client retrieved successfully.');
    } catch (error) {
        console.error('getClientById error:', error);
        return errorResponse(res, 'Failed to retrieve client.', 500);
    }
};

/**
 * POST /api/clients
 * Create a new client + associated user account.
 */
const createClient = async (req, res) => {
    try {
        const {
            email, password, company_name, contact_name, contact_email,
            contact_phone, address, notes, preferred_language,
        } = req.body;

        // Validate required fields
        if (!email || !password || !company_name || !contact_name || !contact_email || !contact_phone) {
            return errorResponse(res, 'Missing required fields: email, password, company_name, contact_name, contact_email, contact_phone.', 400);
        }

        // Check if email already exists
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return errorResponse(res, 'Email is already registered.', 409);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create user with client role
        const user = await User.create({
            email,
            password_hash,
            role: 'client',
            preferred_language: preferred_language || 'es',
        });

        // Create client
        const client = await Client.create({
            user_id: user.id,
            company_name,
            contact_name,
            contact_email,
            contact_phone,
            address,
            notes,
        });

        // Fetch complete client with relations
        const fullClient = await Client.findByPk(client.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email'] },
            ],
        });

        return successResponse(res, fullClient, 'Client created successfully.', 201);
    } catch (error) {
        console.error('createClient error:', error);
        return errorResponse(res, 'Failed to create client.', 500);
    }
};

/**
 * PUT /api/clients/:id
 * Update client data.
 */
const updateClient = async (req, res) => {
    try {
        const client = await Client.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!client) {
            return errorResponse(res, 'Client not found.', 404);
        }

        const {
            company_name, contact_name, contact_email,
            contact_phone, address, status, notes,
        } = req.body;

        await client.update({
            company_name: company_name || client.company_name,
            contact_name: contact_name || client.contact_name,
            contact_email: contact_email || client.contact_email,
            contact_phone: contact_phone || client.contact_phone,
            address: address !== undefined ? address : client.address,
            status: status || client.status,
            notes: notes !== undefined ? notes : client.notes,
        });

        const updatedClient = await Client.findByPk(client.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email'] },
            ],
        });

        return successResponse(res, updatedClient, 'Client updated successfully.');
    } catch (error) {
        console.error('updateClient error:', error);
        return errorResponse(res, 'Failed to update client.', 500);
    }
};

/**
 * DELETE /api/clients/:id
 * Soft delete (is_active = false).
 */
const deleteClient = async (req, res) => {
    try {
        const client = await Client.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!client) {
            return errorResponse(res, 'Client not found.', 404);
        }

        // Check for linked data
        const projectCount = await Project.count({ where: { client_id: client.id } });
        const rateCount = await ClientRate.count({ where: { client_id: client.id } });

        // Perform soft delete
        await client.update({ is_active: false, status: 'inactive' });
        await User.update({ is_active: false }, { where: { id: client.user_id } });

        const response = { id: client.id, company_name: client.company_name };

        if (projectCount > 0 || rateCount > 0) {
            response.warning = `This client has linked data. They have been soft-deleted.`;
            response.linked_data = { projects: projectCount, client_rates: rateCount };
        }

        return successResponse(res, response, 'Client deactivated successfully.');
    } catch (error) {
        console.error('deleteClient error:', error);
        return errorResponse(res, 'Failed to delete client.', 500);
    }
};

module.exports = { getAllClients, getClientById, createClient, updateClient, deleteClient };
