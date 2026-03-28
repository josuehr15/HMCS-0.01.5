const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');
const { User, Client, Project, ClientRate, Invoice, Trade, Assignment } = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * GET /api/clients
 * Default: only active (deleted_at IS NULL).
 * ?status=inactive  → inactive list
 * ?include_inactive=true → all non-deleted
 */
const getAllClients = async (req, res) => {
    try {
        const { status, include_inactive } = req.query;
        const where = { deleted_at: null };

        if (status === 'inactive') {
            where.is_active = false;
        } else if (include_inactive === 'true') {
            // no is_active filter
        } else {
            where.is_active = true; // default: active only
        }

        const clients = await Client.findAll({
            where,
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'is_active', 'last_login_at'] },
                {
                    model: ClientRate, as: 'clientRates',
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                },
            ],
            order: [['company_name', 'ASC']],
        });

        return successResponse(res, clients, 'Clients retrieved successfully.');
    } catch (error) {
        console.error('getAllClients error:', error);
        return errorResponse(res, 'Failed to retrieve clients.', 500);
    }
};

/**
 * GET /api/clients/:id
 */
const getClientById = async (req, res) => {
    try {
        const client = await Client.findOne({
            where: { id: req.params.id, deleted_at: null },
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'is_active', 'last_login_at'] },
                { model: Project, as: 'projects' },
                {
                    model: ClientRate, as: 'clientRates',
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                },
            ],
        });
        if (!client) return errorResponse(res, 'Client not found.', 404);
        return successResponse(res, client, 'Client retrieved successfully.');
    } catch (error) {
        console.error('getClientById error:', error);
        return errorResponse(res, 'Failed to retrieve client.', 500);
    }
};

/**
 * GET /api/clients/:id/linked-data
 */
const getClientLinkedData = async (req, res) => {
    try {
        const client = await Client.findByPk(req.params.id);
        if (!client) return errorResponse(res, 'Client not found.', 404);

        const [projects, invoices] = await Promise.all([
            Project.count({ where: { client_id: client.id } }).catch(() => 0),
            Invoice.count({ where: { client_id: client.id } }).catch(() => 0),
        ]);
        const total = projects + invoices;

        return successResponse(res, {
            projects, invoices, total,
            can_hard_delete: total === 0,
        }, 'Linked data retrieved.');
    } catch (error) {
        console.error('getClientLinkedData error:', error);
        return errorResponse(res, 'Failed to get linked data.', 500);
    }
};

/**
 * POST /api/clients
 * Create client + user account.
 */
const createClient = async (req, res) => {
    try {
        const {
            email, password, company_name, contact_name, contact_email,
            contact_phone, address, notes, preferred_language, rates,
        } = req.body;

        if (!email || !password || !company_name || !contact_name || !contact_email || !contact_phone) {
            return errorResponse(res, 'Campos requeridos: email, password, company_name, contact_name, contact_email, contact_phone.', 400);
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return errorResponse(res, 'El email ya está registrado.', 409);

        const password_hash = await bcrypt.hash(password, await bcrypt.genSalt(10));

        const user = await User.create({
            email, password_hash, role: 'client',
            preferred_language: preferred_language || 'es',
            is_active: true,
        });

        const client = await Client.create({
            user_id: user.id, company_name, contact_name,
            contact_email, contact_phone, address, notes,
            status: 'active', is_active: true,
        });

        // Create client_rates if provided
        if (Array.isArray(rates) && rates.length > 0) {
            for (const r of rates) {
                if (r.trade_id && r.hourly_rate) {
                    await ClientRate.create({
                        client_id: client.id,
                        trade_id: parseInt(r.trade_id),
                        hourly_rate: parseFloat(r.hourly_rate),
                        overtime_multiplier: parseFloat(r.overtime_multiplier || 1.5),
                    });
                }
            }
        }

        const fullClient = await Client.findByPk(client.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'is_active'] },
                {
                    model: ClientRate, as: 'clientRates',
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                },
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
 */
const updateClient = async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, deleted_at: null } });
        if (!client) return errorResponse(res, 'Client not found.', 404);

        const { company_name, contact_name, contact_email, contact_phone, address, status, notes } = req.body;

        const newStatus = status || client.status;
        const newIsActive = newStatus === 'active';

        await client.update({
            company_name: company_name || client.company_name,
            contact_name: contact_name || client.contact_name,
            contact_email: contact_email || client.contact_email,
            contact_phone: contact_phone || client.contact_phone,
            address: address !== undefined ? address : client.address,
            status: newStatus,
            is_active: newIsActive,
            notes: notes !== undefined ? notes : client.notes,
        });

        await User.update({ is_active: newIsActive }, { where: { id: client.user_id } });

        const updatedClient = await Client.findByPk(client.id, {
            include: [
                { model: User, as: 'user', attributes: ['id', 'email', 'is_active'] },
                {
                    model: ClientRate, as: 'clientRates',
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                },
            ],
        });
        return successResponse(res, updatedClient, 'Client updated successfully.');
    } catch (error) {
        console.error('updateClient error:', error);
        return errorResponse(res, 'Failed to update client.', 500);
    }
};

/**
 * PATCH /api/clients/:id/toggle-status
 */
const toggleClientStatus = async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, deleted_at: null } });
        if (!client) return errorResponse(res, 'Client not found.', 404);

        const newStatus = client.status === 'active' ? 'inactive' : 'active';
        const newIsActive = newStatus === 'active';

        await client.update({ status: newStatus, is_active: newIsActive });
        await User.update({ is_active: newIsActive }, { where: { id: client.user_id } });

        const updated = await Client.findByPk(client.id, {
            include: [{ model: User, as: 'user', attributes: ['id', 'email', 'is_active'] }],
        });

        const message = newStatus === 'active' ? 'Cliente reactivado.' : 'Cliente desactivado.';
        return successResponse(res, updated, message);
    } catch (error) {
        console.error('toggleClientStatus error:', error);
        return errorResponse(res, 'Failed to toggle client status.', 500);
    }
};

/**
 * DELETE /api/clients/:id  (soft deactivate — Level 1)
 */
const deleteClient = async (req, res) => {
    try {
        const client = await Client.findOne({ where: { id: req.params.id, is_active: true, deleted_at: null } });
        if (!client) return errorResponse(res, 'Client not found.', 404);

        await client.update({ is_active: false, status: 'inactive' });
        await User.update({ is_active: false }, { where: { id: client.user_id } });

        return successResponse(res, { id: client.id, action: 'deactivated' }, 'Cliente desactivado.');
    } catch (error) {
        console.error('deleteClient error:', error);
        return errorResponse(res, 'Failed to deactivate client.', 500);
    }
};

/**
 * DELETE /api/clients/:id/force
 * Level 2: hard delete (no linked data) | Level 3: permanent hide (has linked data).
 */
const forceDeleteClient = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const confirmed_id = req.body?.confirmed_id || req.query?.confirmed_id;
        const client = await Client.findOne({
            where: { id: req.params.id, deleted_at: null },
            include: [{ model: User, as: 'user' }],
            transaction: t,
        });

        if (!client) { await t.rollback(); return errorResponse(res, 'Client not found.', 404); }
        if (String(confirmed_id) !== String(client.id)) {
            await t.rollback();
            return errorResponse(res, 'Confirmación de ID no coincide.', 400);
        }

        const [projects, invoices] = await Promise.all([
            Project.count({ where: { client_id: client.id }, transaction: t }).catch(() => 0),
            Invoice.count({ where: { client_id: client.id }, transaction: t }).catch(() => 0),
        ]);
        const totalLinked = projects + invoices;

        if (totalLinked > 0) {
            // Level 3: permanent hide
            await client.update({
                is_active: false, status: 'inactive',
                deleted_at: new Date(),
            }, { transaction: t });
            await User.update({ is_active: false }, { where: { id: client.user_id }, transaction: t });
            await t.commit();
            return successResponse(res, {
                id: client.id, action: 'hidden',
                linked_data: { projects, invoices, total: totalLinked },
            }, 'Cliente ocultado permanentemente. Datos conservados.');
        }

        // Level 2: hard delete
        const userId = client.user_id;
        await ClientRate.destroy({ where: { client_id: client.id }, transaction: t });
        await client.destroy({ transaction: t });
        if (userId) await User.destroy({ where: { id: userId }, transaction: t });

        await t.commit();
        return successResponse(res, { id: client.id, action: 'deleted' }, 'Cliente eliminado permanentemente. Email liberado.');
    } catch (error) {
        await t.rollback();
        console.error('forceDeleteClient error:', error);
        return errorResponse(res, 'Failed to permanently delete client.', 500);
    }
};

/**
 * PUT /api/clients/:id/reset-password
 */
const resetClientPassword = async (req, res) => {
    try {
        const client = await Client.findOne({
            where: { id: req.params.id, deleted_at: null },
            include: [{ model: User, as: 'user' }],
        });
        if (!client) return errorResponse(res, 'Client not found.', 404);

        const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
        let tempPassword = 'hmcs-';
        for (let i = 0; i < 6; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];

        const password_hash = await bcrypt.hash(tempPassword, await bcrypt.genSalt(10));
        await client.user.update({ password_hash });

        return successResponse(res, {
            temporary_password: tempPassword,
            company_name: client.company_name,
        }, 'Contraseña reseteada.');
    } catch (error) {
        console.error('resetClientPassword error:', error);
        return errorResponse(res, 'Failed to reset password.', 500);
    }
};

// ─── Client Rates ──────────────────────────────────────────────────────────────

/**
 * POST /api/clients/:id/rates
 */
const addClientRate = async (req, res) => {
    try {
        const client = await Client.findByPk(req.params.id);
        if (!client) return errorResponse(res, 'Client not found.', 404);

        const { trade_id, hourly_rate, overtime_multiplier } = req.body;
        if (!trade_id || !hourly_rate) return errorResponse(res, 'trade_id and hourly_rate required.', 400);

        const rate = await ClientRate.create({
            client_id: client.id,
            trade_id: parseInt(trade_id),
            hourly_rate: parseFloat(hourly_rate),
            overtime_multiplier: parseFloat(overtime_multiplier || 1.5),
        });

        const full = await ClientRate.findByPk(rate.id, {
            include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
        });
        return successResponse(res, full, 'Rate added.', 201);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return errorResponse(res, 'Ya existe una tarifa para este oficio.', 409);
        }
        console.error('addClientRate error:', error);
        return errorResponse(res, 'Failed to add rate.', 500);
    }
};

/**
 * PUT /api/clients/:id/rates/:rateId
 */
const updateClientRate = async (req, res) => {
    try {
        const rate = await ClientRate.findOne({ where: { id: req.params.rateId, client_id: req.params.id } });
        if (!rate) return errorResponse(res, 'Rate not found.', 404);

        const { hourly_rate, overtime_multiplier } = req.body;
        await rate.update({
            hourly_rate: hourly_rate !== undefined ? parseFloat(hourly_rate) : rate.hourly_rate,
            overtime_multiplier: overtime_multiplier !== undefined ? parseFloat(overtime_multiplier) : rate.overtime_multiplier,
        });

        const full = await ClientRate.findByPk(rate.id, {
            include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
        });
        return successResponse(res, full, 'Rate updated.');
    } catch (error) {
        console.error('updateClientRate error:', error);
        return errorResponse(res, 'Failed to update rate.', 500);
    }
};

/**
 * DELETE /api/clients/:id/rates/:rateId
 */
const deleteClientRate = async (req, res) => {
    try {
        const rate = await ClientRate.findOne({ where: { id: req.params.rateId, client_id: req.params.id } });
        if (!rate) return errorResponse(res, 'Rate not found.', 404);
        await rate.destroy();
        return successResponse(res, { id: rate.id }, 'Rate deleted.');
    } catch (error) {
        console.error('deleteClientRate error:', error);
        return errorResponse(res, 'Failed to delete rate.', 500);
    }
};

module.exports = {
    getAllClients, getClientById, getClientLinkedData,
    createClient, updateClient, deleteClient,
    toggleClientStatus, forceDeleteClient, resetClientPassword,
    addClientRate, updateClientRate, deleteClientRate,
};
