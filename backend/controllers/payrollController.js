const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const Decimal = require('decimal.js'); // DEUDA-003: precise financial arithmetic
const fs = require('fs');
const path = require('path');
const {
    Payroll, PayrollLine, TimeEntry, Worker, Trade, Project, Client, User, PerDiemEntry, Transaction, CompanySettings
} = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { extractPaymentData } = require('../utils/claudeVision');
const { getNextVoucherNumber } = require('../utils/voucherNumber');
const { DEFAULT_OT_MULTIPLIER } = require('../config/businessConstants');

// ─── Full includes ────────────────────────────────────────────────────────────
const LINE_INCLUDES = [
    {
        model: Worker, as: 'worker',
        attributes: ['id', 'worker_code', 'first_name', 'last_name', 'hourly_rate', 'phone'],
        include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
    }
];

const PAYROLL_INCLUDES = [
    { model: PayrollLine, as: 'lines', include: LINE_INCLUDES },
    { model: User, as: 'approvedBy', attributes: ['id', 'email'] },
];

// ─── GET /api/payroll ─────────────────────────────────────────────────────────
const getAllPayrolls = async (req, res) => {
    try {
        // Accept both start_date/end_date and from/to (reports page uses from/to)
        const { status, start_date, end_date, from, to } = req.query;
        const startDate = start_date || from;
        const endDate = end_date || to;
        const where = { is_active: true };
        if (status && status !== 'all') where.status = status;
        if (startDate && endDate) {
            where.week_start_date = { [Op.between]: [startDate, endDate] };
        }

        const payrolls = await Payroll.findAll({
            where,
            include: PAYROLL_INCLUDES,
            order: [['week_start_date', 'DESC']],
        });

        return successResponse(res, payrolls, 'Payrolls retrieved.');
    } catch (error) {
        console.error('getAllPayrolls error:', error);
        return errorResponse(res, 'Failed to retrieve payrolls.', 500);
    }
};

// ─── GET /api/payroll/stats ───────────────────────────────────────────────────
const getPayrollStats = async (req, res) => {
    try {
        const lines = await PayrollLine.findAll({ where: { is_active: true } });
        const now = new Date();

        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
        weekStart.setHours(0, 0, 0, 0);

        const pending = lines.filter(l => l.status === 'pending');
        const paidThisWeek = lines.filter(l => l.status === 'paid' && l.paid_at && new Date(l.paid_at) >= weekStart);
        const paidThisMonth = lines.filter(l => l.status === 'paid' && l.paid_at && new Date(l.paid_at).getMonth() === now.getMonth() && new Date(l.paid_at).getFullYear() === now.getFullYear());

        const sum = arr => arr.reduce((s, l) => s + parseFloat(l.total_to_transfer || 0), 0);

        return successResponse(res, {
            pending_amount: sum(pending).toFixed(2),
            paid_this_week: sum(paidThisWeek).toFixed(2),
            paid_this_month: sum(paidThisMonth).toFixed(2),
            workers_pending: pending.length,
        }, 'Stats retrieved.');
    } catch (error) {
        console.error('getPayrollStats error:', error);
        return errorResponse(res, 'Failed to get stats.', 500);
    }
};

// ─── GET /api/payroll/pending-weeks ──────────────────────────────────────────
// Returns weeks with approved time entries that have no payroll yet
const getPendingWeeks = async (req, res) => {
    try {
        // Get all approved entries
        const entries = await TimeEntry.findAll({
            where: { status: 'approved', is_active: true },
            attributes: ['clock_in', 'worker_id', 'project_id'],
            include: [{ model: Worker, as: 'worker', attributes: ['id', 'first_name', 'last_name'] }],
            order: [['clock_in', 'DESC']],
        });

        // Get existing payrolls
        const payrolls = await Payroll.findAll({
            where: { is_active: true },
            attributes: ['week_start_date', 'week_end_date', 'status', 'id', 'total_amount'],
            include: [{ model: PayrollLine, as: 'lines', attributes: ['id', 'status', 'total_to_transfer', 'worker_id'] }],
        });
        const payrollMap = {};
        payrolls.forEach(p => { payrollMap[p.week_start_date] = p; });

        // Group entries into Mon-Sun weeks
        const weekSet = {};
        entries.forEach(e => {
            const d = new Date(e.clock_in);
            const day = d.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            const mon = new Date(d); mon.setDate(d.getDate() + diff); mon.setHours(0, 0, 0, 0);
            const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
            const key = mon.toISOString().split('T')[0];
            if (!weekSet[key]) {
                weekSet[key] = {
                    week_start_date: key,
                    week_end_date: sun.toISOString().split('T')[0],
                    worker_ids: new Set(),
                    entry_count: 0,
                };
            }
            weekSet[key].worker_ids.add(e.worker_id);
            weekSet[key].entry_count++;
        });

        // Merge with payrolls
        const result = Object.values(weekSet).map(w => {
            const payroll = payrollMap[w.week_start_date];
            const workerCount = w.worker_ids.size;
            let weekStatus = 'ungenerated';
            let totalAmount = 0;

            if (payroll) {
                totalAmount = parseFloat(payroll.total_amount || 0);
                const lines = payroll.lines || [];
                const allPaid = lines.length > 0 && lines.every(l => l.status === 'paid');
                const somePaid = lines.some(l => l.status === 'paid');
                if (allPaid) weekStatus = 'paid';
                else if (somePaid) weekStatus = 'partial';
                else weekStatus = payroll.status; // pending/approved
            }

            return {
                week_start_date: w.week_start_date,
                week_end_date: w.week_end_date,
                worker_count: workerCount,
                entry_count: w.entry_count,
                status: weekStatus,
                total_amount: totalAmount,
                payroll_id: payroll?.id || null,
                label: (() => {
                    const s = new Date(w.week_start_date + 'T00:00:00');
                    const e = new Date(w.week_end_date + 'T00:00:00');
                    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                })(),
            };
        }).sort((a, b) => b.week_start_date.localeCompare(a.week_start_date));

        return successResponse(res, result, 'Pending weeks retrieved.');
    } catch (error) {
        console.error('getPendingWeeks error:', error);
        return errorResponse(res, 'Failed to get pending weeks.', 500);
    }
};

// ─── GET /api/payroll/:id ─────────────────────────────────────────────────────
const getPayrollById = async (req, res) => {
    try {
        const payroll = await Payroll.findOne({
            where: { id: req.params.id, is_active: true },
            include: [{
                model: PayrollLine,
                as: 'lines',
                where: { is_active: true },
                required: false,
                include: [{
                    model: Worker,
                    as: 'worker',
                    attributes: ['id', 'worker_code', 'first_name', 'last_name', 'hourly_rate'],
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }]
                }]
            }]
        });
        if (!payroll) return errorResponse(res, 'Payroll not found.', 404);
        return successResponse(res, payroll, 'Payroll retrieved.');
    } catch (error) {
        console.error('getPayrollById error:', error);
        return errorResponse(res, 'Failed to retrieve payroll.', 500);
    }
};

// ─── POST /api/payroll/generate ───────────────────────────────────────────────
const generatePayroll = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { week_start_date, week_end_date } = req.body;
        if (!week_start_date || !week_end_date) {
            await t.rollback();
            return errorResponse(res, 'week_start_date y week_end_date son requeridos.', 400);
        }

        // Check if payroll already exists
        const existing = await Payroll.findOne({ where: { week_start_date, is_active: true } });
        if (existing) {
            await t.rollback();
            return errorResponse(res, 'Ya existe una nómina para esta semana.', 409);
        }

        // Get approved time entries
        const timeEntries = await TimeEntry.findAll({
            where: {
                status: 'approved', is_active: true,
                clock_in: { [Op.between]: [new Date(week_start_date), new Date(week_end_date + 'T23:59:59')] },
            },
            include: [
                { model: Worker, as: 'worker', include: [{ model: Trade, as: 'trade' }] },
                { model: Project, as: 'project', attributes: ['id', 'name'] },
            ],
        });

        if (timeEntries.length === 0) {
            await t.rollback();
            return errorResponse(res, 'No hay horas aprobadas para esta semana.', 404);
        }

        // Group by worker
        const workerMap = {};
        timeEntries.forEach(e => {
            const wId = e.worker_id;
            if (!workerMap[wId]) {
                workerMap[wId] = { worker: e.worker, totalHours: 0, projectId: e.project_id };
            }
            workerMap[wId].totalHours += parseFloat(e.total_hours || 0);
        });

        // Load per-diem entries for the week
        const workerIds = Object.keys(workerMap).map(Number);
        const perDiems = await PerDiemEntry.findAll({
            where: { worker_id: { [Op.in]: workerIds }, week_start_date, is_active: true },
        }).catch(() => []);
        const perDiemMap = {};
        perDiems.forEach(pd => { perDiemMap[pd.worker_id] = parseFloat(pd.amount || 0); });

        // LOGICA-004: read OT threshold from company_settings
        const settings = await CompanySettings.findOne();
        const OT_THRESHOLD = new Decimal(settings?.standard_hours_per_week || 40);
        // LOGICA-005: read default OT multiplier from company_settings (client rates override per invoice)
        const OT_MULT = new Decimal(settings?.default_ot_multiplier || DEFAULT_OT_MULTIPLIER);

        // Create payroll header
        const payroll = await Payroll.create({ week_start_date, week_end_date }, { transaction: t });

        // DEUDA-003: use Decimal.js for all financial arithmetic
        let totalGross = new Decimal(0);
        let totalNet = new Decimal(0);
        let totalPerDiem = new Decimal(0);

        for (const wId of Object.keys(workerMap)) {
            const { worker, totalHours, projectId } = workerMap[wId];
            const regularRate = new Decimal(worker.hourly_rate || 0);
            const overtimeRate = regularRate.times(OT_MULT).toDecimalPlaces(2);
            const totalHoursDec = new Decimal(totalHours);
            const regularHours = Decimal.min(totalHoursDec, OT_THRESHOLD).toDecimalPlaces(2);
            const otHours = Decimal.max(totalHoursDec.minus(OT_THRESHOLD), 0).toDecimalPlaces(2);
            const regularPay = regularHours.times(regularRate).toDecimalPlaces(2);
            const otPay = otHours.times(overtimeRate).toDecimalPlaces(2);
            const grossPay = regularPay.plus(otPay).toDecimalPlaces(2);
            const netPay = grossPay; // deductions start at 0
            const perDiem = new Decimal(perDiemMap[parseInt(wId)] || 0).toDecimalPlaces(2);
            const totalTransfer = netPay.plus(perDiem).toDecimalPlaces(2);

            await PayrollLine.create({
                payroll_id: payroll.id,
                worker_id: parseInt(wId),
                project_id: projectId || null,
                regular_hours: regularHours.toNumber(),
                overtime_hours: otHours.toNumber(),
                regular_rate: regularRate.toNumber(),
                overtime_rate: overtimeRate.toNumber(),
                regular_pay: regularPay.toNumber(),
                overtime_pay: otPay.toNumber(),
                gross_pay: grossPay.toNumber(),
                deductions: 0,
                deductions_detail: [],
                net_pay: netPay.toNumber(),
                per_diem_amount: perDiem.toNumber(),
                total_to_transfer: totalTransfer.toNumber(),
            }, { transaction: t });

            totalGross = totalGross.plus(grossPay);
            totalNet = totalNet.plus(netPay);
            totalPerDiem = totalPerDiem.plus(perDiem);
        }

        const totalAmount = totalNet.plus(totalPerDiem).toDecimalPlaces(2);
        await payroll.update({
            total_gross: totalGross.toDecimalPlaces(2).toNumber(),
            total_deductions: 0,
            total_net: totalNet.toDecimalPlaces(2).toNumber(),
            total_per_diem: totalPerDiem.toDecimalPlaces(2).toNumber(),
            total_amount: totalAmount.toNumber(),
        }, { transaction: t });

        await t.commit();

        const full = await Payroll.findByPk(payroll.id, { include: PAYROLL_INCLUDES });
        return successResponse(res, full, 'Nómina generada exitosamente.', 201);
    } catch (error) {
        await t.rollback();
        console.error('generatePayroll error:', error);
        return errorResponse(res, 'Failed to generate payroll.', 500);
    }
};

// ─── PATCH /api/payroll/:id/status ────────────────────────────────────────────
const updatePayrollStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const VALID = ['pending', 'approved', 'partial', 'paid'];
        if (!VALID.includes(status)) return errorResponse(res, 'Status inválido.', 400);

        const payroll = await Payroll.findOne({ where: { id: req.params.id, is_active: true } });
        if (!payroll) return errorResponse(res, 'Payroll not found.', 404);

        const upd = { status };
        if (status === 'approved') { upd.approved_by_user_id = req.user.id; upd.approved_at = new Date(); }
        if (status === 'paid') { upd.paid_at = new Date(); }

        await payroll.update(upd);
        const full = await Payroll.findByPk(payroll.id, { include: PAYROLL_INCLUDES });
        return successResponse(res, full, `Nómina marcada como ${status}.`);
    } catch (error) {
        console.error('updatePayrollStatus error:', error);
        return errorResponse(res, 'Failed to update status.', 500);
    }
};

// ─── DELETE /api/payroll/:id ──────────────────────────────────────────────────
const deletePayroll = async (req, res) => {
    try {
        const payroll = await Payroll.findOne({ where: { id: req.params.id, is_active: true } });
        if (!payroll) return errorResponse(res, 'Payroll not found.', 404);
        if (payroll.status === 'paid') return errorResponse(res, 'No se puede eliminar una nómina pagada.', 400);
        await payroll.update({ is_active: false });
        return successResponse(res, { id: payroll.id }, 'Nómina eliminada.');
    } catch (error) {
        console.error('deletePayroll error:', error);
        return errorResponse(res, 'Failed to delete payroll.', 500);
    }
};

// ─── PATCH /api/payroll/lines/:id/pay ────────────────────────────────────────
const markWorkerPaid = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { payment_method, payment_reference, notes } = req.body;
        const line = await PayrollLine.findOne({ where: { id: req.params.id, is_active: true }, transaction: t });
        if (!line) return errorResponse(res, 'Payroll line not found.', 404);

        await line.update({
            status: 'paid',
            paid_at: new Date(),
            payment_method: payment_method || 'cash',
            payment_reference: payment_reference || '',
            notes: notes || '',
        }, { transaction: t });

        // Mark per_diem as paid if applicable
        if (parseFloat(line.per_diem_amount || 0) > 0) {
            const payroll = await Payroll.findByPk(line.payroll_id, { attributes: ['week_start_date'], transaction: t });
            if (payroll) {
                await PerDiemEntry.update(
                    { status: 'paid', paid_at: new Date() },
                    { where: { worker_id: line.worker_id, week_start_date: payroll.week_start_date, is_active: true }, transaction: t }
                ).catch(() => { });
            }
        }

        // Check if all lines in the payroll are paid → update payroll status
        const payroll = await Payroll.findByPk(line.payroll_id, { include: [{ model: PayrollLine, as: 'lines', attributes: ['status'] }], transaction: t });
        if (payroll) {
            const allLines = payroll.lines || [];
            const allPaid = allLines.every(l => l.status === 'paid');
            const somePaid = allLines.some(l => l.status === 'paid');
            await payroll.update({
                status: allPaid ? 'paid' : somePaid ? 'partial' : 'approved',
                paid_at: allPaid ? new Date() : null,
            }, { transaction: t });

            // Create Transaction Record for the payment
            await Transaction.create({
                date: new Date(),
                amount: parseFloat(line.gross_pay),
                type: 'expense',
                description: `Payroll week ${payroll.week_start_date}`,
                worker_id: line.worker_id,
                payroll_id: line.payroll_id,
                source: 'auto_generated',
                notes: notes || '',
            }, { transaction: t });
        }

        await t.commit();
        const updatedLine = await PayrollLine.findByPk(line.id, { include: LINE_INCLUDES });
        return successResponse(res, updatedLine, 'Worker marcado como pagado.');
    } catch (error) {
        await t.rollback();
        console.error('markWorkerPaid error:', error);
        return errorResponse(res, 'Failed to mark worker as paid.', 500);
    }
};

// ─── PUT /api/payroll/lines/:id ───────────────────────────────────────────────
// Update deductions on a payroll line
const updatePayrollLine = async (req, res) => {
    try {
        const { deductions_detail, notes } = req.body;
        const line = await PayrollLine.findOne({ where: { id: req.params.id, is_active: true } });
        if (!line) return errorResponse(res, 'Payroll line not found.', 404);
        if (line.status === 'paid') return errorResponse(res, 'No se puede editar una línea pagada.', 400);

        const details = Array.isArray(deductions_detail) ? deductions_detail : (line.deductions_detail || []);
        const totalDed = parseFloat(details.reduce((s, d) => s + parseFloat(d.amount || 0), 0).toFixed(2));
        const newNet = parseFloat((parseFloat(line.gross_pay) - totalDed).toFixed(2));
        const newTransfer = parseFloat((newNet + parseFloat(line.per_diem_amount || 0)).toFixed(2));

        await line.update({
            deductions_detail: details,
            deductions: totalDed,
            net_pay: newNet,
            total_to_transfer: newTransfer,
            notes: notes !== undefined ? notes : line.notes,
        });

        // Update payroll totals
        const allLines = await PayrollLine.findAll({ where: { payroll_id: line.payroll_id, is_active: true } });
        const totalDedAll = allLines.reduce((s, l) => s + parseFloat(l.deductions || 0), 0);
        const totalNetAll = allLines.reduce((s, l) => s + parseFloat(l.net_pay || 0), 0);
        const totalPD = allLines.reduce((s, l) => s + parseFloat(l.per_diem_amount || 0), 0);
        await Payroll.update({
            total_deductions: parseFloat(totalDedAll.toFixed(2)),
            total_net: parseFloat(totalNetAll.toFixed(2)),
            total_amount: parseFloat((totalNetAll + totalPD).toFixed(2)),
        }, { where: { id: line.payroll_id } });

        const upd = await PayrollLine.findByPk(line.id, { include: LINE_INCLUDES });
        return successResponse(res, upd, 'Línea actualizada.');
    } catch (error) {
        console.error('updatePayrollLine error:', error);
        return errorResponse(res, 'Failed to update payroll line.', 500);
    }
};

// Legacy
const approvePayroll = (req, res) => { req.body = { status: 'approved' }; return updatePayrollStatus(req, res); };
const getPayrollReview = getAllPayrolls;

const getPayrollLineById = async (req, res) => {
    try {
        const line = await PayrollLine.findByPk(req.params.id, {
            include: [
                {
                    model: Worker, as: 'worker',
                    attributes: ['id', 'worker_code', 'first_name', 'last_name', 'hourly_rate', 'ssn_encrypted', 'address'],
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name'] }],
                },
                { model: Payroll, as: 'payroll', attributes: ['week_start_date', 'week_end_date'] },
                {
                    model: Project, as: 'project', attributes: ['id', 'name'],
                    include: [{ model: Client, as: 'client', attributes: ['id', 'company_name'] }],
                },
            ]
        });
        if (!line) return errorResponse(res, 'Line not found', 404);
        return successResponse(res, line);
    } catch (error) {
        console.error('getPayrollLineById Error:', error);
        return errorResponse(res, 'Failed to fetch payroll line.', 500);
    }
};

// ─── POST /api/payroll/lines/:id/upload-screenshot ───────────────────────────
const uploadPaymentScreenshot = async (req, res) => {
    try {
        if (!req.file) return errorResponse(res, 'No file uploaded.', 400);

        const line = await PayrollLine.findOne({ where: { id: req.params.id, is_active: true } });
        if (!line) return errorResponse(res, 'Payroll line not found.', 404);

        const screenshotUrl = `/uploads/payment_screenshots/${req.file.filename}`;
        const filePath = path.resolve(req.file.path); // absolute path, works on Windows
        console.log('[upload-screenshot] file:', req.file.filename, '| path:', filePath);
        const imageBuffer = fs.readFileSync(filePath);
        const base64Image = imageBuffer.toString('base64');
        const mediaType = req.file.mimetype === 'image/png' ? 'image/png' : 'image/jpeg';

        let extractedData = { payment_type: 'unknown' };
        try {
            extractedData = await extractPaymentData(base64Image, mediaType);
        } catch (aiErr) {
            console.error('Claude Vision error:', aiErr.message);
        }

        return successResponse(res, {
            screenshot_url: screenshotUrl,
            extracted_data: extractedData,
            needs_confirmation: true,
        }, 'Screenshot uploaded and analyzed.');
    } catch (error) {
        console.error('uploadPaymentScreenshot error:', error.message, error.stack);
        return errorResponse(res, `Failed to process screenshot: ${error.message}`, 500);
    }
};

// ─── POST /api/payroll/lines/:id/confirm-payment-data ────────────────────────
const confirmPaymentData = async (req, res) => {
    try {
        const { extracted_data, payment_method, screenshot_url } = req.body;
        const line = await PayrollLine.findOne({ where: { id: req.params.id, is_active: true } });
        if (!line) return errorResponse(res, 'Payroll line not found.', 404);

        const updates = {
            payment_data: extracted_data || null,
            payment_method: payment_method || line.payment_method,
            payment_screenshot_url: screenshot_url || line.payment_screenshot_url,
        };

        if (!line.voucher_number) {
            updates.voucher_number = await getNextVoucherNumber();
        }

        await line.update(updates);
        const updated = await PayrollLine.findByPk(line.id, {
            include: [...LINE_INCLUDES, { model: Payroll, as: 'payroll', attributes: ['week_start_date', 'week_end_date'] }]
        });
        return successResponse(res, updated, 'Payment data confirmed.');
    } catch (error) {
        console.error('confirmPaymentData error:', error);
        return errorResponse(res, 'Failed to confirm payment data.', 500);
    }
};

// ─── GET /api/payroll/lines/my ────────────────────────────────────────────────
const getMyPayrollLines = async (req, res) => {
    try {
        const worker = await Worker.findOne({ where: { user_id: req.user.id, is_active: true } });
        if (!worker) return errorResponse(res, 'Worker profile not found.', 404);

        const lines = await PayrollLine.findAll({
            where: { worker_id: worker.id, is_active: true },
            include: [
                { model: Payroll, as: 'payroll', attributes: ['week_start_date', 'week_end_date', 'status'] },
                {
                    model: Project, as: 'project', attributes: ['id', 'name'],
                    include: [{ model: Client, as: 'client', attributes: ['id', 'company_name'] }]
                },
            ],
            order: [[{ model: Payroll, as: 'payroll' }, 'week_start_date', 'DESC']],
        });
        return successResponse(res, lines, 'My payroll lines retrieved.');
    } catch (error) {
        console.error('getMyPayrollLines error:', error);
        return errorResponse(res, 'Failed to retrieve payroll lines.', 500);
    }
};

// ─── GET /api/payroll/lines/:id/voucher-view ─────────────────────────────────
// BUG-006: Ownership check — contractor can only view their own voucher.
// SEC-004: ssn_encrypted removed from worker attributes — not needed in voucher HTML.
const getVoucherView = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const line = await PayrollLine.findOne({
            where: { id: req.params.id, is_active: true },
            include: [
                {
                    model: Worker, as: 'worker',
                    // SEC-004: removed ssn_encrypted — SSN must never appear in HTML voucher
                    attributes: ['id', 'worker_code', 'first_name', 'last_name', 'hourly_rate', 'address', 'user_id'],
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name'] }],
                },
                { model: Payroll, as: 'payroll', attributes: ['week_start_date', 'week_end_date'] },
                {
                    model: Project, as: 'project', attributes: ['id', 'name'],
                    include: [{ model: Client, as: 'client', attributes: ['id', 'company_name'] }]
                },
            ],
        });

        if (!line) return errorResponse(res, 'Payroll line not found.', 404);

        // BUG-006: If requester is a contractor, verify they own this payroll line.
        if (req.user.role === 'contractor') {
            const ownerId = line.worker?.user_id;
            if (!ownerId || ownerId !== req.user.id) {
                return errorResponse(res, 'Acceso denegado.', 403);
            }
        }

        // Access control: admin or owner contractor
        if (req.user.role !== 'admin' && line.worker.user_id !== req.user.id) {
            return errorResponse(res, 'Access denied.', 403);
        }

        const w = line.worker;
        const payroll = line.payroll;
        const project = line.project;
        const client = project?.client;

        // SSN last 4
        const ssnLast4 = w.ssn_encrypted ? w.ssn_encrypted.replace(/\D/g, '').slice(-4) : '----';

        // YTD calculation
        const yearStart = new Date(new Date().getFullYear(), 0, 1);
        const yearLines = await PayrollLine.findAll({
            where: { worker_id: w.id, is_active: true },
            include: [{ model: Payroll, as: 'payroll', attributes: ['week_start_date'] }],
        });
        const ytdRegular = yearLines.reduce((s, l) => {
            const d = new Date((l.payroll?.week_start_date || '') + 'T00:00:00');
            return d >= yearStart ? s + parseFloat(l.regular_pay || 0) : s;
        }, 0);
        const ytdOvertime = yearLines.reduce((s, l) => {
            const d = new Date((l.payroll?.week_start_date || '') + 'T00:00:00');
            return d >= yearStart ? s + parseFloat(l.overtime_pay || 0) : s;
        }, 0);
        const ytdPerDiem = yearLines.reduce((s, l) => {
            const d = new Date((l.payroll?.week_start_date || '') + 'T00:00:00');
            return d >= yearStart ? s + parseFloat(l.per_diem_amount || 0) : s;
        }, 0);

        // Week number
        const weekStartDate = payroll?.week_start_date || '';
        const weekDate = new Date(weekStartDate + 'T00:00:00');
        const startOfYear = new Date(weekDate.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((weekDate - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);

        // Per diem days & rate
        const pdAmount = parseFloat(line.per_diem_amount || 0);
        const pdDays = 5;
        const pdRate = pdAmount > 0 ? (pdAmount / pdDays).toFixed(2) : '0.00';

        // Format dates
        const fmtDate = (d) => {
            if (!d) return '';
            const [y, m, day] = (d + '').split('T')[0].split('-');
            return `${m}/${day}/${y}`;
        };

        const payData = line.payment_data || {};
        const method = (line.payment_method || '').toLowerCase();
        const deductions = Array.isArray(line.deductions_detail) ? line.deductions_detail : [];

        // Payment date display
        const paidAtStr = payData.paid_at_datetime ? fmtDate(payData.paid_at_datetime.split('T')[0]) : fmtDate(line.paid_at);

        // Issue date = today
        const today = new Date();
        const issueDate = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;

        const fmt = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Earnings Statement — ${line.voucher_number || 'Draft'}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  ${isAdmin
  ? `@media print {
      body { background: white !important; }
      .voucher { max-width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
    }`
  : `@media print { body { display: none !important; } }`
}
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #f3f4f6; color: #111827; font-size: 13px; }
  .voucher { background: #1f2937; color: #f9fafb; max-width: 900px; margin: 24px auto; border-radius: 12px; overflow: hidden; padding: 28px 32px; }
  .v-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
  .v-header-left .label-sm { font-size: 10px; letter-spacing: 1.5px; color: #9ca3af; text-transform: uppercase; margin-bottom: 6px; }
  .v-header-left h1 { font-family: 'Montserrat', sans-serif; font-size: 22px; font-weight: 600; color: #f9fafb; margin-bottom: 4px; }
  .v-header-left .addr { font-size: 12px; color: #9ca3af; line-height: 1.6; }
  .v-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 12px; }
  .v-logo { width: 52px; height: 52px; border-radius: 8px; object-fit: cover; }
  .v-header-meta { display: flex; gap: 24px; align-items: flex-start; }
  .v-meta-block { text-align: right; }
  .v-meta-block .label-sm { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }
  .v-meta-block .val { font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 600; color: #f9fafb; margin-top: 2px; }
  .v-sep { width: 1px; background: #374151; }
  .v-info-row { display: grid; grid-template-columns: repeat(5, 1fr); border-top: 1px solid #374151; border-bottom: 1px solid #374151; margin-bottom: 20px; }
  .v-info-cell { padding: 14px 16px; border-right: 1px solid #374151; }
  .v-info-cell:last-child { border-right: none; }
  .v-info-cell .cell-label { font-size: 9px; letter-spacing: 1.2px; color: #6b7280; text-transform: uppercase; margin-bottom: 6px; }
  .v-info-cell .cell-val { font-size: 13px; font-weight: 600; color: #f9fafb; line-height: 1.4; }
  .v-info-cell .cell-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }
  .v-two-col { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #374151; border-radius: 8px; margin-bottom: 16px; overflow: hidden; }
  .v-col { padding: 16px 20px; }
  .v-col + .v-col { border-left: 1px solid #374151; }
  .v-col-title { font-size: 10px; letter-spacing: 1.5px; color: #6b7280; text-transform: uppercase; margin-bottom: 12px; font-weight: 600; }
  table.v-table { width: 100%; border-collapse: collapse; }
  table.v-table thead tr { border-bottom: 1px solid #374151; }
  table.v-table th { font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; padding: 4px 6px; text-align: left; font-weight: 500; }
  table.v-table th.r, table.v-table td.r { text-align: right; }
  table.v-table td { padding: 8px 6px; color: #e5e7eb; font-size: 13px; border-bottom: 1px solid #1f2937; }
  .v-table-foot td { border-top: 1px solid #374151; border-bottom: none; font-weight: 600; color: #f9fafb; padding-top: 12px; }
  .ded-amt { color: #ef4444; }
  .ded-ytd { color: #6b7280; font-size: 12px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 14px; }
  .badge-zelle { background: #6D1ED4; color: #fff; }
  .badge-cash { background: #08543D; color: #fff; }
  .badge-check { background: #2A6C95; color: #fff; }
  .pay-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #374151; color: #e5e7eb; font-size: 13px; }
  .pay-row:last-of-type { border-bottom: none; }
  .pay-row .pay-label { color: #9ca3af; }
  .pay-total { margin-top: 12px; padding-top: 12px; }
  .pay-total-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
  .pay-total-amt { font-family: 'Montserrat', sans-serif; font-size: 28px; font-weight: 700; }
  .amt-zelle { color: #08543D; }
  .amt-cash { color: #08543D; }
  .amt-check { color: #2A6C95; }
  .pay-divider-zelle { border-top: 2px solid #08543D; margin-top: 14px; padding-top: 10px; }
  .pay-divider-cash { border-top: 2px solid #08543D; margin-top: 14px; padding-top: 10px; }
  .pay-divider-check { border-top: 2px solid #2A6C95; margin-top: 14px; padding-top: 10px; }
  .screenshot-box { border: 1.5px dashed #374151; border-radius: 8px; min-height: 180px; display: flex; align-items: center; justify-content: center; flex-direction: column; color: #6b7280; font-size: 12px; gap: 8px; }
  .screenshot-box img { width: 100%; border-radius: 6px; object-fit: cover; max-height: 260px; }
  .screenshot-tag { background: #374151; border-radius: 4px; padding: 3px 8px; font-size: 10px; color: #9ca3af; margin-top: 6px; }
  .v-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid #374151; }
  .v-footer-left { font-size: 11px; color: #6b7280; line-height: 1.5; }
  .paid-badge { background: #374151; color: #10b981; border-radius: 20px; padding: 6px 14px; font-size: 12px; font-weight: 600; }
</style>
</head>
<body>
<div class="voucher">

  <!-- HEADER -->
  <div class="v-header">
    <div class="v-header-left">
      <div class="label-sm">Earnings Statement</div>
      <h1>HM Construction Staffing LLLP</h1>
      <div class="addr">500 Lucas Dr, Savannah, GA<br>hmcs@hmconstructionlllp.com</div>
    </div>
    <div class="v-header-right">
      <img src="http://localhost:3000/imagen/logo_cuadrado.jpg" alt="HMCS" class="v-logo" onerror="this.style.display='none'">
      <div class="v-header-meta">
        <div class="v-meta-block">
          <div class="label-sm">Statement #</div>
          <div class="val">${line.voucher_number || 'DRAFT'}</div>
        </div>
        <div class="v-sep"></div>
        <div class="v-meta-block">
          <div class="label-sm">Issue Date</div>
          <div class="val">${issueDate}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- INFO ROW -->
  <div class="v-info-row">
    <div class="v-info-cell">
      <div class="cell-label">Worker</div>
      <div class="cell-val">${w.first_name} ${w.last_name}</div>
      <div class="cell-sub">${w.worker_code}</div>
    </div>
    <div class="v-info-cell">
      <div class="cell-label">Address</div>
      <div class="cell-val">${w.address || '—'}</div>
    </div>
    <div class="v-info-cell">
      <div class="cell-label">SSN (Last 4)</div>
      <div class="cell-val">XXX-XX-${ssnLast4}</div>
    </div>
    <div class="v-info-cell">
      <div class="cell-label">Pay Period</div>
      <div class="cell-val">${fmtDate(weekStartDate)} – ${fmtDate(payroll?.week_end_date)}</div>
      <div class="cell-sub">${weekDate.getFullYear()} · Week ${weekNum}</div>
    </div>
    <div class="v-info-cell">
      <div class="cell-label">Project / Client</div>
      <div class="cell-val">${client?.company_name || '—'}</div>
      <div class="cell-sub">${project?.name || '—'}${w.trade?.name ? ' · ' + w.trade.name : ''}</div>
    </div>
  </div>

  <!-- DEDUCTIONS + EARNINGS -->
  <div class="v-two-col">
    <div class="v-col">
      <div class="v-col-title">Deductions</div>
      <table class="v-table">
        <thead><tr><th>Description</th><th class="r">Amount</th><th class="r">YTD</th></tr></thead>
        <tbody>
          ${deductions.length === 0 ? `<tr><td colspan="3" style="color:#6b7280;font-size:12px;padding:12px 6px;">No deductions</td></tr>` :
            deductions.map(d => `<tr>
              <td>${d.description || d.type || 'Deduction'}</td>
              <td class="r ded-amt">– ${fmt(d.amount)}</td>
              <td class="r ded-ytd">– ${fmt(d.amount)}</td>
            </tr>`).join('')}
        </tbody>
        <tfoot class="v-table-foot">
          <tr><td>Total Deductions</td><td class="r ded-amt">– ${fmt(line.deductions)}</td><td class="r ded-ytd">– ${fmt(line.deductions)}</td></tr>
        </tfoot>
      </table>
    </div>
    <div class="v-col">
      <div class="v-col-title">Earnings</div>
      <table class="v-table">
        <thead><tr><th>Description</th><th class="r">Hrs</th><th class="r">Rate</th><th class="r">Amt</th><th class="r">YTD</th></tr></thead>
        <tbody>
          <tr>
            <td>Regular Time</td>
            <td class="r">${parseFloat(line.regular_hours).toFixed(1)}</td>
            <td class="r">${fmt(line.regular_rate)}</td>
            <td class="r">${fmt(line.regular_pay)}</td>
            <td class="r" style="color:#6b7280;">${fmt(ytdRegular)}</td>
          </tr>
          ${parseFloat(line.overtime_hours || 0) > 0 ? `<tr>
            <td>Overtime 1.5x</td>
            <td class="r">${parseFloat(line.overtime_hours).toFixed(1)}</td>
            <td class="r">${fmt(line.overtime_rate)}</td>
            <td class="r">${fmt(line.overtime_pay)}</td>
            <td class="r" style="color:#6b7280;">${fmt(ytdOvertime)}</td>
          </tr>` : ''}
          ${pdAmount > 0 ? `<tr>
            <td>Per Diem</td>
            <td class="r">${pdDays}d</td>
            <td class="r">$${pdRate}</td>
            <td class="r">${fmt(pdAmount)}</td>
            <td class="r" style="color:#6b7280;">${fmt(ytdPerDiem)}</td>
          </tr>` : ''}
        </tbody>
        <tfoot class="v-table-foot">
          <tr><td colspan="3">Gross Earnings</td><td class="r">${fmt(line.gross_pay)}</td><td class="r" style="color:#6b7280;">${fmt(ytdRegular + ytdOvertime)}</td></tr>
        </tfoot>
      </table>
    </div>
  </div>

  <!-- PAYMENT INFO + SCREENSHOT -->
  <div class="v-two-col">
    <div class="v-col">
      ${method === 'zelle' ? `
        <span class="badge badge-zelle">✓ PAID VIA ZELLE</span>
        <div class="pay-row"><span class="pay-label">Sent to</span><span>${payData.sent_to || w.first_name + ' ' + w.last_name}</span></div>
        <div class="pay-row"><span class="pay-label">Registered as</span><span>${payData.registered_as || '—'}</span></div>
        <div class="pay-row"><span class="pay-label">From account</span><span>${payData.from_account || '—'}</span></div>
        <div class="pay-row"><span class="pay-label">Confirmation #</span><span>${payData.confirmation_number || '—'}</span></div>
        <div class="pay-row"><span class="pay-label">Date &amp; Time</span><span>${paidAtStr || '—'}</span></div>
        <div class="pay-row"><span class="pay-label">Bank</span><span>${payData.bank || 'Wells Fargo'}</span></div>
        <div class="pay-divider-zelle">
          <div class="pay-total-label">NET TRANSFER</div>
          <div class="pay-total-amt amt-zelle">${fmt(line.total_to_transfer)}</div>
        </div>
      ` : method === 'cash' ? `
        <span class="badge badge-cash">&#x2Fef; CASH EWITHDRAWAL</span>
        <div class="pay-row"><span class="pay-label">Bank</span><span>${payData.bank || 'Wells Fargo Bank'}</span></div>
        <div class="pay-row"><span class="pay-label">Account</span><span>${payData.account || '—'}</span></div>
        <div class="pay-row"><span class="pay-label">Branch #</span><span>${payData.branch_number || '—'}</span></div>
        <div class="pay-row"><span class="pay-label">Transaction #</span><span>${payData.transaction_number || '—'}</span></div>
        <div class="pay-row"><span class="pay-label">Date &amp; Time</span><span>${paidAtStr || '—'}</span></div>
        <div class="pay-row"><span class="pay-label">Type</span><span>Cash Paid to Customer</span></div>
        <div class="pay-divider-cash">
          <div class="pay-total-label">CASH PAID</div>
          <div class="pay-total-amt amt-cash">${fmt(line.total_to_transfer)}</div>
        </div>
      ` : method === 'check' ? `
        <span class="badge badge-check">&#x2Fef; CHECK</span>
        <div class="pay-row"><span class="pay-label">Payable to</span><span>${payData.payable_to || w.first_name + ' ' + w.last_name}</span></div>
        <div class="pay-row"><span class="pay-label">Check #</span><span>${payData.check_number || '—'}</span></div>
        <div class="pay-row"><span class="pay-label">Bank</span><span>${payData.bank || 'Wells Fargo Bank'}</span></div>
        <div class="pay-row"><span class="pay-label">Account</span><span>${payData.account || '—'}</span></div>
        <div class="pay-row"><span class="pay-label">Issue Date</span><span>${paidAtStr || issueDate}</span></div>
        <div class="pay-row"><span class="pay-label">Memo</span><span>Week ${weekNum} · ${w.worker_code}</span></div>
        <div class="pay-divider-check">
          <div class="pay-total-label">CHECK AMOUNT</div>
          <div class="pay-total-amt amt-check">${fmt(line.total_to_transfer)}</div>
        </div>
      ` : `
        <div style="color:#6b7280; font-size:13px; padding-top:8px;">No payment information recorded yet.</div>
      `}
    </div>
    <div class="v-col">
      <div class="v-col-title">${method === 'check' ? 'Check / Receipt Photo' : 'Payment Screenshot'}</div>
      ${line.payment_screenshot_url
        ? `<img src="http://localhost:5000${line.payment_screenshot_url}" alt="Payment screenshot" style="width:100%;border-radius:6px;object-fit:cover;max-height:260px;">
           <div class="screenshot-tag">${method === 'zelle' ? 'Zelle' : method === 'cash' ? 'Cash' : 'Check'} · Wells Fargo</div>`
        : `<div class="screenshot-box">
             <svg width="40" height="40" fill="none" stroke="#6b7280" stroke-width="1.5" viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
             <span>No screenshot uploaded</span>
           </div>`}
    </div>
  </div>

  <!-- FOOTER -->
  <div class="v-footer">
    <div class="v-footer-left">
      HM Construction Staffing LLLP — Independent Contractor (1099)<br>
      No se retienen impuestos federales ni estatales.
    </div>
    <div class="paid-badge">● Pagado · ${fmtDate(line.paid_at?.toISOString?.()?.split('T')[0] || '')}</div>
  </div>

</div>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
    } catch (error) {
        console.error('getVoucherView error:', error);
        return errorResponse(res, 'Failed to generate voucher.', 500);
    }
};

module.exports = {
    getAllPayrolls, getPayrollStats, getPendingWeeks, getPayrollById,
    generatePayroll, updatePayrollStatus, deletePayroll,
    markWorkerPaid, updatePayrollLine, getPayrollLineById,
    approvePayroll, getPayrollReview,
    uploadPaymentScreenshot, confirmPaymentData, getVoucherView, getMyPayrollLines,
};
