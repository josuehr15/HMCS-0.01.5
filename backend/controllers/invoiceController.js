const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
    Invoice, InvoiceLine, TimeEntry, Worker, Trade,
    Client, Project, ClientRate, User, PerDiemEntry, CompanySettings, Assignment,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// ─── Full includes for fetching invoices ────────────────────────────────────────
const INVOICE_INCLUDES = [
    { model: Client, as: 'client', attributes: ['id', 'company_name', 'address', 'contact_email', 'contact_name'] },
    { model: Project, as: 'project', attributes: ['id', 'name', 'address'] },
    {
        model: InvoiceLine, as: 'lines',
        include: [
            { model: Worker, as: 'worker', attributes: ['id', 'worker_code', 'first_name', 'last_name'] },
            { model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] },
        ],
    },
    { model: User, as: 'approvedBy', attributes: ['id', 'email'] },
];

// ─── Get or create company settings ────────────────────────────────────────────
const getCompanySettings = async () => {
    let settings = await CompanySettings.findOne();
    if (!settings) {
        settings = await CompanySettings.create({});
    }
    return settings;
};

// ─── Auto invoice number: YY-XX ────────────────────────────────────────────────
const getNextInvoiceNumber = async (settings) => {
    const prefix = settings.invoice_prefix || new Date().getFullYear().toString().slice(-2);
    const last = await Invoice.findOne({
        where: { invoice_number: { [Op.like]: `${prefix}-%` } },
        order: [['invoice_number', 'DESC']],
    });
    let nextNum = settings.invoice_next_number || 1;
    if (last) {
        const parts = last.invoice_number.split('-');
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed) && parsed >= nextNum) nextNum = parsed + 1;
    }
    await settings.update({ invoice_next_number: nextNum + 1 });
    return `${prefix}-${String(nextNum).padStart(2, '0')}`;
};

// ─── POST /api/invoices/generate ────────────────────────────────────────────────
const generateInvoice = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { client_id, project_id, week_start_date, week_end_date } = req.body;
        if (!client_id || !project_id || !week_start_date || !week_end_date) {
            await t.rollback();
            return errorResponse(res, 'Required: client_id, project_id, week_start_date, week_end_date.', 400);
        }

        // H-3: Guard against duplicate invoicing for the same week/project
        const existingInvoice = await Invoice.findOne({
            where: {
                project_id,
                week_start_date,
                week_end_date,
                is_active: true,
                status: { [Op.ne]: 'draft' },
            },
            transaction: t,
        });
        if (existingInvoice) {
            await t.rollback();
            return res.status(409).json({
                success: false,
                message: `Ya existe una factura activa para este período. Factura #${existingInvoice.invoice_number}`,
                existingInvoice: {
                    id: existingInvoice.id,
                    invoice_number: existingInvoice.invoice_number,
                    status: existingInvoice.status,
                },
            });
        }

        // Fetch approved time entries for the week
        const timeEntries = await TimeEntry.findAll({
            where: {
                project_id, status: 'approved', is_active: true,
                clock_in: {
                    [Op.between]: [new Date(week_start_date), new Date(week_end_date + 'T23:59:59')],
                },
            },
            include: [
                { model: Worker, as: 'worker', include: [{ model: Trade, as: 'trade' }] },
            ],
        });

        if (timeEntries.length === 0) {
            await t.rollback();
            return errorResponse(res, 'No hay entradas de horas aprobadas para este período.', 404);
        }

        // Group hours by worker
        const workerMap = {};
        for (const entry of timeEntries) {
            const wId = entry.worker_id;
            if (!workerMap[wId]) workerMap[wId] = { worker: entry.worker, totalHours: 0 };
            workerMap[wId].totalHours += parseFloat(entry.total_hours || 0);
        }

        // Load per_diem entries for the week
        const workerIds = Object.keys(workerMap).map(Number);
        const perDiems = await PerDiemEntry.findAll({
            where: {
                worker_id: { [Op.in]: workerIds },
                week_start_date, is_active: true,
            },
        }).catch(() => []);

        const perDiemByWorker = {};
        perDiems.forEach(pd => {
            perDiemByWorker[pd.worker_id] = (perDiemByWorker[pd.worker_id] || 0) + parseFloat(pd.amount || 0);
        });

        // Company settings + invoice number
        const settings = await getCompanySettings();
        const invoiceNumber = await getNextInvoiceNumber(settings);
        const invoiceDate = new Date().toISOString().split('T')[0];
        const paymentDays = settings.payment_terms_days || 14;
        const dueDate = new Date(Date.now() + paymentDays * 86400000).toISOString().split('T')[0];

        const project = await Project.findByPk(project_id);

        // Create invoice header (draft initially)
        const invoice = await Invoice.create({
            client_id, project_id,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            due_date: dueDate,
            week_start_date, week_end_date,
            status: 'draft',
            notes: `${project?.name || ''}\nWeek worked from ${week_start_date} to ${week_end_date}`,
        }, { transaction: t });

        // Create lines + calculate totals
        let subtotal = 0;
        let perDiemTotal = 0;

        for (const wId of Object.keys(workerMap)) {
            const { worker, totalHours } = workerMap[wId];
            const tradeId = worker?.trade_id;

            const clientRate = await ClientRate.findOne({ where: { client_id, trade_id: tradeId } });
            const rate = clientRate ? parseFloat(clientRate.hourly_rate) : 0;
            const otMult = clientRate ? parseFloat(clientRate.overtime_multiplier) : 1.5;
            const otRate = parseFloat((rate * otMult).toFixed(2));

            const regularHrs = parseFloat(Math.min(totalHours, 40).toFixed(2));
            const otHrs = parseFloat(Math.max(totalHours - 40, 0).toFixed(2));
            const laborSubtotal = parseFloat(((regularHrs * rate) + (otHrs * otRate)).toFixed(2));
            const perDiem = parseFloat((perDiemByWorker[parseInt(wId)] || 0).toFixed(2));
            const lineTotal = parseFloat((laborSubtotal + perDiem).toFixed(2));

            await InvoiceLine.create({
                invoice_id: invoice.id,
                worker_id: parseInt(wId),
                trade_id: tradeId || 0,
                description: `${worker?.first_name || ''} ${worker?.last_name || ''}`,
                regular_hours: regularHrs,
                overtime_hours: otHrs,
                rate,
                overtime_rate: otRate,
                per_diem_amount: perDiem,
                quantity: parseFloat(totalHours.toFixed(2)),
                amount: laborSubtotal,
                line_total: lineTotal,
            }, { transaction: t });

            subtotal += laborSubtotal;
            perDiemTotal += perDiem;
        }

        const grandTotal = parseFloat((subtotal + perDiemTotal).toFixed(2));
        await invoice.update({
            subtotal: parseFloat(subtotal.toFixed(2)),
            per_diem_total: parseFloat(perDiemTotal.toFixed(2)),
            total: grandTotal,
        }, { transaction: t });

        await t.commit();

        const full = await Invoice.findByPk(invoice.id, { include: INVOICE_INCLUDES });
        return successResponse(res, full, 'Factura generada exitosamente.', 201);
    } catch (error) {
        await t.rollback();
        console.error('generateInvoice error:', error);
        return errorResponse(res, 'Failed to generate invoice.', 500);
    }
};

// ─── GET /api/invoices ───────────────────────────────────────────────────────────
const getAllInvoices = async (req, res) => {
    try {
        const { client_id, status, start_date, end_date, month } = req.query;
        const where = { is_active: true };
        if (client_id) where.client_id = client_id;
        if (status && status !== 'all') where.status = status;
        if (month) {
            const [yr, mo] = month.split('-').map(Number);
            where.invoice_date = {
                [Op.between]: [
                    `${yr}-${String(mo).padStart(2, '0')}-01`,
                    `${yr}-${String(mo).padStart(2, '0')}-31`,
                ],
            };
        } else if (start_date && end_date) {
            where.invoice_date = { [Op.between]: [start_date, end_date] };
        }

        const invoices = await Invoice.findAll({
            where,
            include: [
                { model: Client, as: 'client', attributes: ['id', 'company_name'] },
                { model: Project, as: 'project', attributes: ['id', 'name'] },
            ],
            order: [['invoice_date', 'DESC'], ['invoice_number', 'DESC']],
        });

        return successResponse(res, invoices, 'Invoices retrieved.');
    } catch (error) {
        console.error('getAllInvoices error:', error);
        return errorResponse(res, 'Failed to retrieve invoices.', 500);
    }
};

// ─── GET /api/invoices/stats ─────────────────────────────────────────────────────
const getInvoiceStats = async (req, res) => {
    try {
        const invoices = await Invoice.findAll({ where: { is_active: true } });
        const pending = invoices.filter(i => ['draft', 'pending_approval'].includes(i.status)).reduce((s, i) => s + parseFloat(i.total || 0), 0);
        const sent = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + parseFloat(i.total || 0), 0);
        const now = new Date();
        const paid = invoices.filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at).getMonth() === now.getMonth()).reduce((s, i) => s + parseFloat(i.total || 0), 0);
        return successResponse(res, { total: invoices.length, pending_amount: pending.toFixed(2), sent_amount: sent.toFixed(2), paid_this_month: paid.toFixed(2) }, 'Stats retrieved.');
    } catch (error) {
        console.error('getInvoiceStats error:', error);
        return errorResponse(res, 'Failed to get stats.', 500);
    }
};

// ─── GET /api/invoices/weeks ─────────────────────────────────────────────────────
// Returns approved unfactured week/project combos for the generate modal
const getUnbilledWeeks = async (req, res) => {
    try {
        const { client_id, project_id } = req.query;
        const where = { status: 'approved', is_active: true };
        if (project_id) where.project_id = project_id;

        const entries = await TimeEntry.findAll({
            where,
            include: [{ model: Project, as: 'project', attributes: ['id', 'name', 'client_id'] }],
            attributes: ['project_id', 'clock_in'],
            order: [['clock_in', 'ASC']],
        });

        // Filter by client if provided
        const filtered = client_id
            ? entries.filter(e => String(e.project?.client_id) === String(client_id))
            : entries;

        // Group into Monday-Sunday weeks
        const weekSet = new Set();
        const weeks = [];
        filtered.forEach(e => {
            const d = new Date(e.clock_in);
            const day = d.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            const mon = new Date(d);
            mon.setDate(d.getDate() + diff);
            mon.setHours(0, 0, 0, 0);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);

            const key = `${e.project_id}__${mon.toISOString().split('T')[0]}`;
            if (!weekSet.has(key)) {
                weekSet.add(key);
                weeks.push({
                    project_id: e.project_id,
                    project_name: e.project?.name,
                    week_start_date: mon.toISOString().split('T')[0],
                    week_end_date: sun.toISOString().split('T')[0],
                    label: `${mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
                });
            }
        });

        // L-2: Filter weeks that already have an active non-draft invoice
        const billedInvoices = await Invoice.findAll({
            where: { project_id: project_id ? project_id : { [Op.ne]: null }, is_active: true, status: { [Op.ne]: 'draft' } },
            attributes: ['project_id', 'week_start_date', 'week_end_date'],
        });
        const billedKeys = new Set(
            billedInvoices.map(inv => `${inv.project_id}__${inv.week_start_date}__${inv.week_end_date}`)
        );
        const unbilledWeeks = weeks.filter(w =>
            !billedKeys.has(`${w.project_id}__${w.week_start_date}__${w.week_end_date}`)
        );

        return successResponse(res, unbilledWeeks, 'Unbilled weeks retrieved.');
    } catch (error) {
        console.error('getUnbilledWeeks error:', error);
        return errorResponse(res, 'Failed to get unbilled weeks.', 500);
    }
};

// ─── GET /api/invoices/:id ───────────────────────────────────────────────────────
const getInvoiceById = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ where: { id: req.params.id, is_active: true }, include: INVOICE_INCLUDES });
        if (!invoice) return errorResponse(res, 'Invoice not found.', 404);
        
        const perDiemLines = await PerDiemEntry.findAll({
            where: {
                week_start_date: invoice.week_start_date
            },
            include: [
                { model: Worker, as: 'worker', attributes: ['id', 'first_name', 'last_name'] },
                { model: Assignment, as: 'assignment', where: { project_id: invoice.project_id }, attributes: [] }
            ]
        });
        
        const invoiceData = invoice.toJSON();
        invoiceData.perDiemLines = perDiemLines.map(pd => pd.toJSON());

        return successResponse(res, invoiceData, 'Invoice retrieved.');
    } catch (error) {
        console.error('getInvoiceById error:', error);
        return errorResponse(res, 'Failed to retrieve invoice.', 500);
    }
};

// ─── PUT /api/invoices/:id ───────────────────────────────────────────────────────
const updateInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({
            where: { id: req.params.id, is_active: true },
        });

        if (!invoice) {
            return errorResponse(res, 'Invoice not found.', 404);
        }

        const {
            client_id,
            project_id,
            notes,
            adjustments,
            per_diem_total,
            payment_terms,
            week_start_date,
            week_end_date,
            invoice_date,
            due_date,
        } = req.body;

        // Actualizar campos permitidos
        const updateData = {};
        if (client_id !== undefined) updateData.client_id = client_id;
        if (project_id !== undefined) updateData.project_id = project_id;
        if (notes !== undefined) updateData.notes = notes;

        // Recalcular total si cambian montos
        const adj = adjustments !== undefined ? parseFloat(adjustments) : parseFloat(invoice.adjustments || 0);
        const pd = per_diem_total !== undefined ? parseFloat(per_diem_total) : parseFloat(invoice.per_diem_total || 0);

        if (adjustments !== undefined || per_diem_total !== undefined) {
            updateData.adjustments = adj;
            updateData.per_diem_total = pd;
            updateData.total = parseFloat(
                (parseFloat(invoice.subtotal) + adj + pd).toFixed(2)
            );
        }

        if (payment_terms !== undefined) updateData.payment_terms = payment_terms;
        if (week_start_date !== undefined) updateData.week_start_date = week_start_date;
        if (week_end_date !== undefined) updateData.week_end_date = week_end_date;
        if (invoice_date !== undefined) updateData.invoice_date = invoice_date;
        if (due_date !== undefined) updateData.due_date = due_date;

        await invoice.update(updateData);

        // Retornar factura actualizada completa
        const updated = await Invoice.findByPk(invoice.id, {
            include: INVOICE_INCLUDES,
        });

        return successResponse(res, updated, 'Invoice updated successfully.');
    } catch (error) {
        console.error('updateInvoice error:', error);
        return errorResponse(res, 'Failed to update invoice.', 500);
    }
};

// ─── PATCH /api/invoices/:id/status ─────────────────────────────────────────────
const updateInvoiceStatus = async (req, res) => {
    try {
        const { status, payment_method, payment_reference } = req.body;
        const VALID = ['draft', 'pending_approval', 'approved', 'sent', 'paid', 'overdue'];
        if (!status || !VALID.includes(status)) return errorResponse(res, 'Status inválido.', 400);

        const invoice = await Invoice.findOne({ where: { id: req.params.id, is_active: true } });
        if (!invoice) return errorResponse(res, 'Invoice not found.', 404);

        const update = { status };
        if (status === 'approved') { update.approved_by_user_id = req.user.id; update.approved_at = new Date(); }
        if (status === 'sent') { update.sent_at = new Date(); }
        if (status === 'paid') {
            update.paid_at = new Date();
            if (payment_method) update.payment_method = payment_method;
            if (payment_reference) update.payment_reference = payment_reference;
        }
        if (status === 'draft') {
            // Reject back to draft
            update.approved_by_user_id = null;
            update.approved_at = null;
        }

        await invoice.update(update);
        const full = await Invoice.findByPk(invoice.id, { include: INVOICE_INCLUDES });
        return successResponse(res, full, `Factura marcada como ${status}.`);
    } catch (error) {
        console.error('updateInvoiceStatus error:', error);
        return errorResponse(res, 'Failed to update invoice status.', 500);
    }
};

// ─── DELETE /api/invoices/:id ────────────────────────────────────────────────────
const deleteInvoice = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ where: { id: req.params.id, is_active: true } });
        if (!invoice) return errorResponse(res, 'Invoice not found.', 404);
        if (invoice.status === 'paid') return errorResponse(res, 'No se puede eliminar una factura pagada.', 400);
        await invoice.update({ is_active: false });
        return successResponse(res, { id: invoice.id }, 'Factura eliminada.');
    } catch (error) {
        console.error('deleteInvoice error:', error);
        return errorResponse(res, 'Failed to delete invoice.', 500);
    }
};

// ─── GET /api/invoices/company-settings ──────────────────────────────────────────
const getCompanySettingsHandler = async (req, res) => {
    try {
        const settings = await getCompanySettings();
        return successResponse(res, settings, 'Company settings retrieved.');
    } catch (error) {
        console.error('getCompanySettings error:', error);
        return errorResponse(res, 'Failed to get company settings.', 500);
    }
};

// ─── GET /api/invoices/:id/html — invoice HTML for PDF/print ─────────────────────
const getInvoiceHtml = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ where: { id: req.params.id, is_active: true }, include: INVOICE_INCLUDES });
        if (!invoice) return errorResponse(res, 'Invoice not found.', 404);
        const settings = await getCompanySettings();

        // Build week calendar days worked
        const start = new Date(invoice.week_start_date + 'T00:00:00');
        const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });

        const workedDates = new Set(
            (invoice.lines || []).flatMap(l => []) // We'll mark all week days as worked for simplicity
        );

        // Fetch approved entries for the week to know worked days
        const approvedEntries = await TimeEntry.findAll({
            where: {
                project_id: invoice.project_id,
                status: 'approved',
                is_active: true,
                clock_in: {
                    [Op.between]: [new Date(invoice.week_start_date), new Date(invoice.week_end_date + 'T23:59:59')],
                },
            },
            attributes: ['clock_in'],
        });
        approvedEntries.forEach(e => {
            const d = new Date(e.clock_in);
            workedDates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        });

        const fmtMoney = v => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';
        const DAYS_HEADER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

        const calendarHtml = weekDays.map((d, i) => {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const worked = workedDates.has(key);
            return `<div class="cal-day ${worked ? 'cal-day--worked' : 'cal-day--off'}">
                <span class="cal-label">${DAYS_HEADER[i]}</span>
                <span class="cal-num">${d.getDate()}</span>
            </div>`;
        }).join('');

        const client = invoice.client || {};
        const project = invoice.project || {};

        const linesHtml = (invoice.lines || []).map(line => `
            <tr>
                <td>${line.trade?.name || '—'}</td>
                <td>${line.worker?.first_name || ''} ${line.worker?.last_name || ''}</td>
                <td class="num">${parseFloat(line.regular_hours || 0).toFixed(2)}</td>
                <td class="num">${parseFloat(line.overtime_hours || 0).toFixed(2)}</td>
                <td class="num">${fmtMoney(line.per_diem_amount)}</td>
                <td class="num">${fmtMoney(line.rate)}</td>
                <td class="num total-col">${fmtMoney(line.line_total)}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; padding: 32px 40px; }
  h1.inv-title { font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #1a3a5c; margin-bottom: 2px; }
  .co-name { font-size: 14px; font-weight: 700; color: #1a3a5c; }
  .co-info  { font-size: 11px; color: #555; line-height: 1.7; }
  .divider  { border: none; border-top: 2px solid #1a3a5c; margin: 18px 0; }
  .two-col  { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin: 12px 0; }
  .bill-to  { font-size: 11px; color: #333; line-height: 1.7; }
  .bill-to .label { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .inv-details { text-align: right; font-size: 11px; color: #333; line-height: 1.9; }
  .inv-details strong { font-weight: 700; color: #1a3a5c; }
  /* Calendar */
  .week-box  { background: #f7f9fc; border: 1px solid #d0dce8; border-radius: 8px; padding: 14px 18px; margin: 16px 0; }
  .week-title { font-size: 11px; font-weight: 700; color: #1a3a5c; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  .cal-grid  { display: flex; gap: 6px; }
  .cal-day   { flex: 1; border-radius: 6px; padding: 8px 4px; text-align: center; }
  .cal-day--worked { background: #1a3a5c; color: #fff; }
  .cal-day--off    { background: #e8edf3; color: #888; }
  .cal-label { display: block; font-size: 9px; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
  .cal-num   { display: block; font-size: 14px; font-weight: 700; }
  /* Table */
  table.inv-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 11px; }
  .inv-table th { background: #1a3a5c; color: #fff; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .inv-table th.num, .inv-table td.num { text-align: right; }
  .inv-table td { padding: 8px 10px; border-bottom: 1px solid #e8edf3; }
  .inv-table tr:hover td { background: #f7f9fc; }
  .total-col { font-weight: 700; }
  /* Totals */
  .totals-block { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; margin-top: 8px; }
  .totals-row   { display: flex; gap: 16px; font-size: 12px; min-width: 260px; justify-content: space-between; }
  .totals-row.grand { font-size: 15px; font-weight: 800; color: #1a3a5c; border-top: 2px solid #1a3a5c; padding-top: 6px; margin-top: 3px; }
  /* Footer */
  .notes-section { margin-top: 18px; padding-top: 12px; border-top: 1px solid #d0dce8; font-size: 11px; color: #444; line-height: 1.7; }
  .notes-label { font-weight: 700; color: #1a3a5c; margin-bottom: 4px; }
  .payment-terms { margin-top: 14px; font-size: 11px; color: #888; }
</style>
</head>
<body>
  <div class="two-col" style="align-items:flex-start">
    <div>
      <h1 class="inv-title">INVOICE</h1>
      <p class="co-name">${settings.company_name}</p>
      <p class="co-info">${settings.address}<br>${settings.city}, ${settings.state} ${settings.zip}<br>${settings.email}<br>${settings.phone}</p>
    </div>
    <div class="inv-details">
      <strong>Invoice no.:</strong> ${invoice.invoice_number}<br>
      <strong>Invoice date:</strong> ${fmtDate(invoice.invoice_date)}<br>
      <strong>Due date:</strong> ${fmtDate(invoice.due_date)}<br>
    </div>
  </div>
  <hr class="divider"/>
  <div class="two-col">
    <div class="bill-to">
      <div class="label">Bill to</div>
      <strong>${client.company_name || '—'}</strong><br>
      ${client.address || ''}${client.address ? '<br>' : ''}
      ${client.city ? `${client.city}, ${client.state} ${client.zip}` : ''}
    </div>
  </div>
  <div class="week-box">
    <div class="week-title">📅 Week Worked: ${new Date(invoice.week_start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} — ${new Date(invoice.week_end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    <div class="cal-grid">${calendarHtml}</div>
  </div>
  <table class="inv-table">
    <thead>
      <tr>
        <th>Service</th><th>Contractor</th>
        <th class="num">Reg Hrs</th><th class="num">OT Hrs</th>
        <th class="num">Per Diem</th><th class="num">Rate</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>
  <div class="totals-block">
    <div class="totals-row"><span>Subtotal (labor):</span><span>${fmtMoney(invoice.subtotal)}</span></div>
    <div class="totals-row"><span>Per Diem:</span><span>${fmtMoney(invoice.per_diem_total)}</span></div>
    <div class="totals-row"><span>Adjustments:</span><span>${fmtMoney(invoice.adjustments)}</span></div>
    <div class="totals-row grand"><span>TOTAL:</span><span>${fmtMoney(invoice.total)}</span></div>
  </div>
  ${invoice.notes ? `<div class="notes-section"><div class="notes-label">Note to customer:</div>${invoice.notes.replace(/\n/g, '<br>')}</div>` : ''}
  <div class="payment-terms">Payment terms: Net ${settings.payment_terms_days || 14} days<br>${settings.payment_instructions || ''}</div>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('getInvoiceHtml error:', error);
        return errorResponse(res, 'Failed to generate invoice HTML.', 500);
    }
};

// ─── POST /api/invoices/:id/send-email ── (L-4 fix: only mark 'sent' if email succeeds)
const sendInvoiceEmail = async (req, res) => {
    try {
        const invoice = await Invoice.findOne({ where: { id: req.params.id, is_active: true }, include: INVOICE_INCLUDES });
        if (!invoice) return errorResponse(res, 'Invoice not found.', 404);

        // If EMAIL_PASSWORD is not configured, don't mark as sent — warn instead
        if (!process.env.EMAIL_PASSWORD) {
            return res.status(503).json({
                success: false,
                message: 'No hay configuración de email (EMAIL_PASSWORD). La factura NO fue marcada como enviada.',
                invoice_status: invoice.status,
            });
        }

        try {
            const nodemailer = require('nodemailer');
            const settings = await getCompanySettings();
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: settings.email, pass: process.env.EMAIL_PASSWORD },
            });
            const client = invoice.client || {};
            await transporter.sendMail({
                from: `"${settings.company_name}" <${settings.email}>`,
                to: client.contact_email || 'client@example.com',
                subject: `Invoice #${invoice.invoice_number} — ${settings.company_name}`,
                text: `Please find attached invoice #${invoice.invoice_number}.\n\nWeek: ${invoice.week_start_date} to ${invoice.week_end_date}\nTotal: $${invoice.total}\n\n${settings.payment_instructions || ''}`,
            });
        } catch (emailErr) {
            console.error('Email send error:', emailErr.message);
            // L-4: Email failed — do NOT mark as sent, return error
            return res.status(502).json({
                success: false,
                message: `La factura está aprobada pero el email no pudo enviarse: ${emailErr.message}. Verifica la configuración SMTP.`,
                invoice_status: invoice.status,
            });
        }

        // Only mark as 'sent' after confirmed email delivery
        await invoice.update({ status: 'sent', sent_at: new Date() });
        const full = await Invoice.findByPk(invoice.id, { include: INVOICE_INCLUDES });
        return successResponse(res, full, 'Factura enviada y marcada como enviada.');
    } catch (error) {
        console.error('sendInvoiceEmail error:', error);
        return errorResponse(res, 'Failed to send invoice.', 500);
    }
};

// Legacy handlers
const approveInvoice = (req, res) => { req.body = { ...req.body, status: 'approved' }; return updateInvoiceStatus(req, res); };
const markAsSent = (req, res) => { req.body = { ...req.body, status: 'sent' }; return updateInvoiceStatus(req, res); };
const markAsPaid = (req, res) => { req.body = { ...req.body, status: 'paid' }; return updateInvoiceStatus(req, res); };

module.exports = {
    generateInvoice, getAllInvoices, getInvoiceStats, getInvoiceById,
    getUnbilledWeeks, updateInvoice, updateInvoiceStatus, deleteInvoice,
    getInvoiceHtml, getCompanySettingsHandler, sendInvoiceEmail,
    approveInvoice, markAsSent, markAsPaid,
};
