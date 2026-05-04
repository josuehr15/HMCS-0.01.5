const { Op } = require('sequelize');
const { Client, Project, Invoice, Assignment, Worker, TimeEntry, Trade } = require('../models');

/**
 * Helper: find the Client record linked to the logged-in user.
 * Returns null if the user has no associated client record.
 */
async function getClientForUser(userId) {
    return await Client.findOne({
        where: { user_id: userId, is_active: true },
        attributes: ['id', 'company_name', 'contact_name', 'contact_email', 'contact_phone', 'logo_url'],
    });
}

// ─── GET /api/client/dashboard ───────────────────────────────────────────────
/**
 * Returns KPI summary for the client dashboard:
 *   - Active projects count
 *   - Workers on-site today
 *   - Open invoices count + total amount
 *   - Last 5 invoices
 */
const getDashboard = async (req, res) => {
    try {
        const client = await getClientForUser(req.user.id);
        if (!client) {
            return res.status(403).json({ success: false, message: 'No client account linked to this user.' });
        }

        const clientId = client.id;

        // Today's date range (midnight to midnight)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Active projects
        const activeProjects = await Project.count({
            where: { client_id: clientId, status: 'active', is_active: true },
        });

        // Workers on-site today — find active project IDs, then assignments, then time entries
        const activeProjectIds = await Project.findAll({
            where: { client_id: clientId, is_active: true },
            attributes: ['id'],
        }).then(rows => rows.map(r => r.id));

        let workersToday = 0;
        if (activeProjectIds.length > 0) {
            const activeAssignmentIds = await Assignment.findAll({
                where: {
                    project_id: { [Op.in]: activeProjectIds },
                    status: 'active',
                    is_active: true,
                },
                attributes: ['id'],
            }).then(rows => rows.map(r => r.id));

            if (activeAssignmentIds.length > 0) {
                const workersTodayRows = await TimeEntry.findAll({
                    where: {
                        assignment_id: { [Op.in]: activeAssignmentIds },
                        clock_in: { [Op.between]: [todayStart, todayEnd] },
                        is_active: true,
                    },
                    attributes: ['worker_id'],
                    group: ['TimeEntry.worker_id'],
                });
                workersToday = workersTodayRows.length;
            }
        }

        // Open invoices (sent or overdue)
        const openInvoices = await Invoice.findAll({
            where: {
                client_id: clientId,
                status: { [Op.in]: ['sent', 'overdue'] },
                is_active: true,
            },
            attributes: ['id', 'total'],
        });
        const openInvoiceCount = openInvoices.length;
        const openInvoiceTotal = openInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);

        // Last 5 invoices
        const recentInvoices = await Invoice.findAll({
            where: { client_id: clientId, is_active: true },
            order: [['invoice_date', 'DESC']],
            limit: 5,
            include: [{ model: Project, as: 'project', attributes: ['id', 'name'] }],
            attributes: ['id', 'invoice_number', 'invoice_date', 'due_date', 'total', 'status'],
        });

        res.json({
            success: true,
            data: {
                client: { id: client.id, company_name: client.company_name, contact_name: client.contact_name },
                kpis: {
                    activeProjects,
                    workersToday,
                    openInvoiceCount,
                    openInvoiceTotal: openInvoiceTotal.toFixed(2),
                },
                recentInvoices,
            },
        });
    } catch (error) {
        console.error('Client dashboard error:', error);
        res.status(500).json({ success: false, message: 'Error loading dashboard.' });
    }
};

// ─── GET /api/client/projects ────────────────────────────────────────────────
/**
 * Returns all projects for this client with:
 *   - active assignment count (workers)
 *   - GPS coordinates for map display
 */
const getProjects = async (req, res) => {
    try {
        const client = await getClientForUser(req.user.id);
        if (!client) return res.status(403).json({ success: false, message: 'No client account linked.' });

        const projects = await Project.findAll({
            where: { client_id: client.id, is_active: true },
            order: [['name', 'ASC']],
            attributes: [
                'id', 'name', 'address', 'latitude', 'longitude',
                'status', 'start_date', 'end_date', 'work_hours_per_day',
                'lunch_rule', 'gps_radius_meters',
            ],
            include: [{
                model: Assignment,
                as: 'assignments',
                where: { status: 'active', is_active: true },
                required: false,
                attributes: ['id', 'worker_id'],
                include: [{
                    model: Worker,
                    as: 'worker',
                    attributes: ['id', 'first_name', 'last_name', 'trade_id'],
                    include: [{ model: Trade, as: 'trade', attributes: ['name'] }],
                }],
            }],
        });

        res.json({ success: true, data: projects });
    } catch (error) {
        console.error('Client projects error:', error);
        res.status(500).json({ success: false, message: 'Error loading projects.' });
    }
};

// ─── GET /api/client/invoices ─────────────────────────────────────────────────
/**
 * Returns all invoices for this client (read-only, all statuses).
 * Supports optional ?status= filter.
 */
const getInvoices = async (req, res) => {
    try {
        const client = await getClientForUser(req.user.id);
        if (!client) return res.status(403).json({ success: false, message: 'No client account linked.' });

        const { status } = req.query;
        const where = { client_id: client.id, is_active: true };
        if (status) where.status = status;

        const invoices = await Invoice.findAll({
            where,
            order: [['invoice_date', 'DESC']],
            include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'address'] }],
            attributes: [
                'id', 'invoice_number', 'invoice_date', 'due_date',
                'week_start_date', 'week_end_date',
                'subtotal', 'per_diem_total', 'adjustments', 'tax_amount', 'total',
                'status', 'sent_at', 'paid_at', 'payment_method', 'notes',
            ],
        });

        res.json({ success: true, data: invoices });
    } catch (error) {
        console.error('Client invoices error:', error);
        res.status(500).json({ success: false, message: 'Error loading invoices.' });
    }
};

// ─── GET /api/client/workers ──────────────────────────────────────────────────
/**
 * Returns workers currently assigned to any active project of this client.
 * Includes today's clock-in status and total hours today.
 */
const getWorkers = async (req, res) => {
    try {
        const client = await getClientForUser(req.user.id);
        if (!client) return res.status(403).json({ success: false, message: 'No client account linked.' });

        // Today's date range
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        // Get active projects for this client
        const projects = await Project.findAll({
            where: { client_id: client.id, is_active: true, status: 'active' },
            attributes: ['id', 'name'],
        });
        const projectIds = projects.map(p => p.id);

        if (projectIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        // Get active assignments for those projects
        const assignments = await Assignment.findAll({
            where: {
                project_id: { [Op.in]: projectIds },
                status: 'active',
                is_active: true,
            },
            attributes: ['id', 'worker_id', 'project_id', 'start_date'],
            include: [{
                model: Worker,
                as: 'worker',
                attributes: ['id', 'first_name', 'last_name', 'trade_id', 'status'],
                where: { status: 'active', is_active: true },
                include: [{ model: Trade, as: 'trade', attributes: ['name'] }],
            }, {
                model: Project,
                as: 'project',
                attributes: ['id', 'name'],
            }],
        });

        // For each assignment, get today's hours
        const workerMap = {};
        for (const asgn of assignments) {
            const workerId = asgn.worker_id;
            if (!workerMap[workerId]) {
                workerMap[workerId] = {
                    id: asgn.worker.id,
                    first_name: asgn.worker.first_name,
                    last_name: asgn.worker.last_name,
                    trade: asgn.worker.trade?.name || '—',
                    status: asgn.worker.status,
                    projects: [],
                    todayHours: 0,
                    clockedInToday: false,
                };
            }
            workerMap[workerId].projects.push({
                id: asgn.project.id,
                name: asgn.project.name,
            });
        }

        // Get today's time entries for these workers (via assignment)
        const assignmentIds = assignments.map(a => a.id);
        if (assignmentIds.length > 0) {
            const todayEntries = await TimeEntry.findAll({
                where: {
                    assignment_id: { [Op.in]: assignmentIds },
                    clock_in: { [Op.between]: [todayStart, todayEnd] },
                    is_active: true,
                },
                attributes: ['worker_id', 'clock_in', 'clock_out', 'total_hours'],
            });
            for (const entry of todayEntries) {
                const wid = entry.worker_id;
                if (workerMap[wid]) {
                    workerMap[wid].clockedInToday = true;
                    workerMap[wid].todayHours += parseFloat(entry.total_hours || 0);
                }
            }
        }

        const workers = Object.values(workerMap);
        res.json({ success: true, data: workers });
    } catch (error) {
        console.error('Client workers error:', error);
        res.status(500).json({ success: false, message: 'Error loading workers.' });
    }
};

// ─── GET /api/client/invoices/:id/html ────────────────────────────────────────
/**
 * Serves the invoice HTML for a client-owned invoice.
 * Verifies the invoice belongs to the requesting client before delegating
 * to the admin invoice HTML generator.
 */
const getInvoiceHtml = async (req, res) => {
    try {
        const client = await getClientForUser(req.user.id);
        if (!client) return res.status(403).json({ success: false, message: 'No client account linked.' });

        // Verify this invoice belongs to this client
        const invoice = await Invoice.findOne({
            where: { id: req.params.id, client_id: client.id, is_active: true },
            attributes: ['id'],
        });

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found.' });
        }

        // Delegate to the admin controller — it handles all HTML rendering
        // We temporarily set req.params.id and call the admin controller
        const { getInvoiceHtml: adminHtml } = require('./invoiceController');
        return adminHtml(req, res);
    } catch (error) {
        console.error('Client invoice HTML error:', error);
        res.status(500).json({ success: false, message: 'Error loading invoice.' });
    }
};

module.exports = { getDashboard, getProjects, getInvoices, getWorkers, getInvoiceHtml };
