const { Op, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const {
    Payroll, PayrollLine, TimeEntry, Worker, Trade, Project, User, PerDiemEntry,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// ─── Full includes ────────────────────────────────────────────────────────────
const LINE_INCLUDES = [
    {
        model: Worker, as: 'worker',
        attributes: ['id', 'worker_code', 'first_name', 'last_name', 'hourly_rate', 'phone'],
        include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
    },
    { model: Project, as: 'project', attributes: ['id', 'name'] },
];

const PAYROLL_INCLUDES = [
    { model: PayrollLine, as: 'lines', include: LINE_INCLUDES },
    { model: User, as: 'approvedBy', attributes: ['id', 'email'] },
];

// ─── GET /api/payroll ─────────────────────────────────────────────────────────
const getAllPayrolls = async (req, res) => {
    try {
        const { status, start_date, end_date } = req.query;
        const where = { is_active: true };
        if (status && status !== 'all') where.status = status;
        if (start_date && end_date) {
            where.week_start_date = { [Op.between]: [start_date, end_date] };
        }

        const payrolls = await Payroll.findAll({
            where,
            include: [{ model: PayrollLine, as: 'lines', attributes: ['id', 'status', 'total_to_transfer'] }],
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
            include: PAYROLL_INCLUDES,
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

        // Create payroll header
        const payroll = await Payroll.create({ week_start_date, week_end_date }, { transaction: t });

        let totalGross = 0, totalNet = 0, totalPerDiem = 0;

        for (const wId of Object.keys(workerMap)) {
            const { worker, totalHours, projectId } = workerMap[wId];
            const regularRate = parseFloat(worker.hourly_rate || 0);
            const overtimeRate = parseFloat((regularRate * 1.5).toFixed(2));
            const regularHours = parseFloat(Math.min(totalHours, 40).toFixed(2));
            const otHours = parseFloat(Math.max(totalHours - 40, 0).toFixed(2));
            const regularPay = parseFloat((regularHours * regularRate).toFixed(2));
            const otPay = parseFloat((otHours * overtimeRate).toFixed(2));
            const grossPay = parseFloat((regularPay + otPay).toFixed(2));
            const netPay = grossPay; // deductions start at 0
            const perDiem = parseFloat((perDiemMap[parseInt(wId)] || 0).toFixed(2));
            const totalTransfer = parseFloat((netPay + perDiem).toFixed(2));

            await PayrollLine.create({
                payroll_id: payroll.id,
                worker_id: parseInt(wId),
                project_id: projectId || null,
                regular_hours: regularHours,
                overtime_hours: otHours,
                regular_rate: regularRate,
                overtime_rate: overtimeRate,
                regular_pay: regularPay,
                overtime_pay: otPay,
                gross_pay: grossPay,
                deductions: 0,
                deductions_detail: [],
                net_pay: netPay,
                per_diem_amount: perDiem,
                total_to_transfer: totalTransfer,
            }, { transaction: t });

            totalGross += grossPay;
            totalNet += netPay;
            totalPerDiem += perDiem;
        }

        const totalAmount = totalNet + totalPerDiem;
        await payroll.update({
            total_gross: parseFloat(totalGross.toFixed(2)),
            total_deductions: 0,
            total_net: parseFloat(totalNet.toFixed(2)),
            total_per_diem: parseFloat(totalPerDiem.toFixed(2)),
            total_amount: parseFloat(totalAmount.toFixed(2)),
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
    try {
        const { payment_method, payment_reference, notes } = req.body;
        const line = await PayrollLine.findOne({ where: { id: req.params.id, is_active: true } });
        if (!line) return errorResponse(res, 'Payroll line not found.', 404);

        await line.update({
            status: 'paid',
            paid_at: new Date(),
            payment_method: payment_method || 'cash',
            payment_reference: payment_reference || '',
            notes: notes || '',
        });

        // Mark per_diem as paid if applicable
        if (parseFloat(line.per_diem_amount || 0) > 0) {
            const payroll = await Payroll.findByPk(line.payroll_id, { attributes: ['week_start_date'] });
            if (payroll) {
                await PerDiemEntry.update(
                    { status: 'paid', paid_at: new Date() },
                    { where: { worker_id: line.worker_id, week_start_date: payroll.week_start_date, is_active: true } }
                ).catch(() => { });
            }
        }

        // Check if all lines in the payroll are paid → update payroll status
        const payroll = await Payroll.findByPk(line.payroll_id, { include: [{ model: PayrollLine, as: 'lines', attributes: ['status'] }] });
        if (payroll) {
            const allLines = payroll.lines || [];
            const allPaid = allLines.every(l => l.status === 'paid');
            const somePaid = allLines.some(l => l.status === 'paid');
            await payroll.update({
                status: allPaid ? 'paid' : somePaid ? 'partial' : 'approved',
                paid_at: allPaid ? new Date() : null,
            });
        }

        const updatedLine = await PayrollLine.findByPk(line.id, { include: LINE_INCLUDES });
        return successResponse(res, updatedLine, 'Worker marcado como pagado.');
    } catch (error) {
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

module.exports = {
    getAllPayrolls, getPayrollStats, getPendingWeeks, getPayrollById,
    generatePayroll, updatePayrollStatus, deletePayroll,
    markWorkerPaid, updatePayrollLine,
    approvePayroll, getPayrollReview,
};
