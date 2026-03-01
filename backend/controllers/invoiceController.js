const { Op } = require('sequelize');
const {
    Invoice, InvoiceLine, TimeEntry, Worker, Trade,
    Client, Project, ClientRate, User,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * Get next invoice number in YY-XX format.
 */
const getNextInvoiceNumber = async () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const lastInvoice = await Invoice.findOne({
        where: { invoice_number: { [Op.like]: `${year}-%` } },
        order: [['invoice_number', 'DESC']],
    });

    let nextNum = 1;
    if (lastInvoice) {
        const parts = lastInvoice.invoice_number.split('-');
        nextNum = parseInt(parts[1], 10) + 1;
    }

    return `${year}-${String(nextNum).padStart(2, '0')}`;
};

/**
 * POST /api/invoices/generate
 * Generate invoice from approved time entries for a week.
 */
const generateInvoice = async (req, res) => {
    try {
        const { client_id, project_id, week_start_date, week_end_date } = req.body;

        if (!client_id || !project_id || !week_start_date || !week_end_date) {
            return errorResponse(res, 'Missing required fields: client_id, project_id, week_start_date, week_end_date.', 400);
        }

        // Get approved time entries for the week
        const timeEntries = await TimeEntry.findAll({
            where: {
                project_id,
                status: 'approved',
                is_active: true,
                clock_in: {
                    [Op.between]: [
                        new Date(week_start_date),
                        new Date(week_end_date + 'T23:59:59'),
                    ],
                },
            },
            include: [
                { model: Worker, as: 'worker', include: [{ model: Trade, as: 'trade' }] },
            ],
        });

        if (timeEntries.length === 0) {
            return errorResponse(res, 'No approved time entries found for this period.', 404);
        }

        // Group by worker
        const workerHours = {};
        for (const entry of timeEntries) {
            const wId = entry.worker_id;
            if (!workerHours[wId]) {
                workerHours[wId] = {
                    worker: entry.worker,
                    totalHours: 0,
                };
            }
            workerHours[wId].totalHours += parseFloat(entry.total_hours || 0);
        }

        // Generate invoice number
        const invoiceNumber = await getNextInvoiceNumber();

        // Get project for notes
        const project = await Project.findByPk(project_id);

        // Create invoice
        const invoice = await Invoice.create({
            client_id,
            project_id,
            invoice_number: invoiceNumber,
            invoice_date: new Date(),
            week_start_date,
            week_end_date,
            notes: `${project.name} - Week worked from ${week_start_date} to ${week_end_date}`,
        });

        // Create invoice lines
        let subtotal = 0;
        for (const wId of Object.keys(workerHours)) {
            const { worker, totalHours } = workerHours[wId];

            // Get client rate for this trade
            const clientRate = await ClientRate.findOne({
                where: { client_id, trade_id: worker.trade_id },
            });

            const rate = clientRate ? parseFloat(clientRate.hourly_rate) : 0;
            const overtimeMultiplier = clientRate ? parseFloat(clientRate.overtime_multiplier) : 1.5;

            // Calculate regular vs overtime (>40h = overtime)
            const regularHours = Math.min(totalHours, 40);
            const overtimeHours = Math.max(totalHours - 40, 0);
            const overtimeRate = parseFloat((rate * overtimeMultiplier).toFixed(2));

            const regularAmount = parseFloat((regularHours * rate).toFixed(2));
            const overtimeAmount = parseFloat((overtimeHours * overtimeRate).toFixed(2));
            const lineAmount = parseFloat((regularAmount + overtimeAmount).toFixed(2));

            await InvoiceLine.create({
                invoice_id: invoice.id,
                worker_id: parseInt(wId),
                trade_id: worker.trade_id,
                description: `${worker.first_name} ${worker.last_name}`,
                quantity: totalHours,
                rate,
                amount: lineAmount,
                regular_hours: regularHours,
                overtime_hours: overtimeHours,
                overtime_rate: overtimeRate,
            });

            subtotal += lineAmount;
        }

        // Update invoice totals
        await invoice.update({
            subtotal: subtotal.toFixed(2),
            total: subtotal.toFixed(2),
            status: 'pending_approval',
        });

        // Fetch complete invoice
        const fullInvoice = await Invoice.findByPk(invoice.id, {
            include: [
                { model: Client, as: 'client', attributes: ['id', 'company_name'] },
                { model: Project, as: 'project', attributes: ['id', 'name', 'address'] },
                {
                    model: InvoiceLine, as: 'lines',
                    include: [
                        { model: Worker, as: 'worker', attributes: ['id', 'worker_code', 'first_name', 'last_name'] },
                        { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
                    ],
                },
            ],
        });

        return successResponse(res, fullInvoice, 'Invoice generated successfully.', 201);
    } catch (error) {
        console.error('generateInvoice error:', error);
        return errorResponse(res, 'Failed to generate invoice.', 500);
    }
};

/**
 * GET /api/invoices
 */
const getAllInvoices = async (req, res) => {
    try {
        const { client_id, status, start_date, end_date } = req.query;
        const where = { is_active: true };

        if (client_id) where.client_id = client_id;
        if (status) where.status = status;
        if (start_date && end_date) {
            where.invoice_date = { [Op.between]: [start_date, end_date] };
        }

        const invoices = await Invoice.findAll({
            where,
            include: [
                { model: Client, as: 'client', attributes: ['id', 'company_name'] },
                { model: Project, as: 'project', attributes: ['id', 'name'] },
            ],
            order: [['created_at', 'DESC']],
        });

        return successResponse(res, invoices, 'Invoices retrieved successfully.');
    } catch (error) {
        console.error('getAllInvoices error:', error);
        return errorResponse(res, 'Failed to retrieve invoices.', 500);
    }
};

/**
 * GET /api/invoices/:id
 */
const getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({
            where: { id: req.params.id, is_active: true },
            include: [
                { model: Client, as: 'client' },
                { model: Project, as: 'project' },
                {
                    model: InvoiceLine, as: 'lines',
                    include: [
                        { model: Worker, as: 'worker', attributes: ['id', 'worker_code', 'first_name', 'last_name'] },
                        { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
                    ],
                },
            ],
        });

        if (!invoice) return errorResponse(res, 'Invoice not found.', 404);
        return successResponse(res, invoice, 'Invoice retrieved successfully.');
    } catch (error) {
        console.error('getInvoiceById error:', error);
        return errorResponse(res, 'Failed to retrieve invoice.', 500);
    }
};

/**
 * PUT /api/invoices/:id/approve
 */
const approveInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ where: { id: req.params.id, is_active: true } });
        if (!invoice) return errorResponse(res, 'Invoice not found.', 404);

        await invoice.update({
            status: 'approved',
            approved_by_user_id: req.user.id,
            approved_at: new Date(),
        });

        return successResponse(res, invoice, 'Invoice approved.');
    } catch (error) {
        console.error('approveInvoice error:', error);
        return errorResponse(res, 'Failed to approve invoice.', 500);
    }
};

/**
 * PUT /api/invoices/:id/send
 */
const markAsSent = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ where: { id: req.params.id, is_active: true } });
        if (!invoice) return errorResponse(res, 'Invoice not found.', 404);

        await invoice.update({ status: 'sent', sent_at: new Date() });
        return successResponse(res, invoice, 'Invoice marked as sent.');
    } catch (error) {
        console.error('markAsSent error:', error);
        return errorResponse(res, 'Failed to mark invoice as sent.', 500);
    }
};

/**
 * PUT /api/invoices/:id/paid
 */
const markAsPaid = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ where: { id: req.params.id, is_active: true } });
        if (!invoice) return errorResponse(res, 'Invoice not found.', 404);

        await invoice.update({ status: 'paid', paid_at: new Date() });
        return successResponse(res, invoice, 'Invoice marked as paid.');
    } catch (error) {
        console.error('markAsPaid error:', error);
        return errorResponse(res, 'Failed to mark invoice as paid.', 500);
    }
};

module.exports = {
    generateInvoice, getAllInvoices, getInvoiceById,
    approveInvoice, markAsSent, markAsPaid,
};
