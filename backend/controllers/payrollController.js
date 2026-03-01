const { Op } = require('sequelize');
const {
    Payroll, PayrollLine, TimeEntry, Worker, Trade, User,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/responseHandler');

/**
 * POST /api/payroll/generate
 * Generate weekly payroll from approved time entries.
 */
const generatePayroll = async (req, res) => {
    try {
        const { week_start_date, week_end_date } = req.body;

        if (!week_start_date || !week_end_date) {
            return errorResponse(res, 'Missing required fields: week_start_date, week_end_date.', 400);
        }

        // Get approved time entries for the week
        const timeEntries = await TimeEntry.findAll({
            where: {
                status: 'approved',
                is_active: true,
                clock_in: {
                    [Op.between]: [
                        new Date(week_start_date),
                        new Date(week_end_date + 'T23:59:59'),
                    ],
                },
            },
            include: [{ model: Worker, as: 'worker' }],
        });

        if (timeEntries.length === 0) {
            return errorResponse(res, 'No approved time entries found for this period.', 404);
        }

        // Group by worker
        const workerHours = {};
        for (const entry of timeEntries) {
            const wId = entry.worker_id;
            if (!workerHours[wId]) {
                workerHours[wId] = { worker: entry.worker, totalHours: 0 };
            }
            workerHours[wId].totalHours += parseFloat(entry.total_hours || 0);
        }

        // Create payroll
        const payroll = await Payroll.create({ week_start_date, week_end_date });

        let totalAmount = 0;
        for (const wId of Object.keys(workerHours)) {
            const { worker, totalHours } = workerHours[wId];
            const regularRate = parseFloat(worker.hourly_rate);
            const overtimeRate = parseFloat((regularRate * 1.5).toFixed(2));

            const regularHours = Math.min(totalHours, 40);
            const overtimeHours = Math.max(totalHours - 40, 0);

            const regularPay = parseFloat((regularHours * regularRate).toFixed(2));
            const overtimePay = parseFloat((overtimeHours * overtimeRate).toFixed(2));
            const grossPay = parseFloat((regularPay + overtimePay).toFixed(2));
            const netPay = grossPay; // deductions = 0 by default

            await PayrollLine.create({
                payroll_id: payroll.id,
                worker_id: parseInt(wId),
                regular_hours: regularHours,
                overtime_hours: overtimeHours,
                regular_rate: regularRate,
                overtime_rate: overtimeRate,
                regular_pay: regularPay,
                overtime_pay: overtimePay,
                gross_pay: grossPay,
                deductions: 0,
                net_pay: netPay,
            });

            totalAmount += grossPay;
        }

        await payroll.update({ total_amount: totalAmount.toFixed(2) });

        // Fetch complete payroll
        const fullPayroll = await Payroll.findByPk(payroll.id, {
            include: [{
                model: PayrollLine, as: 'lines',
                include: [{ model: Worker, as: 'worker', attributes: ['id', 'worker_code', 'first_name', 'last_name', 'hourly_rate'] }],
            }],
        });

        return successResponse(res, fullPayroll, 'Payroll generated successfully.', 201);
    } catch (error) {
        console.error('generatePayroll error:', error);
        return errorResponse(res, 'Failed to generate payroll.', 500);
    }
};

/**
 * GET /api/payroll
 */
const getAllPayrolls = async (req, res) => {
    try {
        const { status } = req.query;
        const where = { is_active: true };
        if (status) where.status = status;

        const payrolls = await Payroll.findAll({
            where,
            order: [['created_at', 'DESC']],
        });

        return successResponse(res, payrolls, 'Payrolls retrieved successfully.');
    } catch (error) {
        console.error('getAllPayrolls error:', error);
        return errorResponse(res, 'Failed to retrieve payrolls.', 500);
    }
};

/**
 * GET /api/payroll/:id
 */
const getPayrollById = async (req, res) => {
    try {
        const payroll = await Payroll.findOne({
            where: { id: req.params.id, is_active: true },
            include: [{
                model: PayrollLine, as: 'lines',
                include: [{
                    model: Worker, as: 'worker',
                    attributes: ['id', 'worker_code', 'first_name', 'last_name', 'hourly_rate'],
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                }],
            }],
        });

        if (!payroll) return errorResponse(res, 'Payroll not found.', 404);
        return successResponse(res, payroll, 'Payroll retrieved successfully.');
    } catch (error) {
        console.error('getPayrollById error:', error);
        return errorResponse(res, 'Failed to retrieve payroll.', 500);
    }
};

/**
 * PUT /api/payroll/:id/approve
 */
const approvePayroll = async (req, res) => {
    try {
        const payroll = await Payroll.findOne({ where: { id: req.params.id, is_active: true } });
        if (!payroll) return errorResponse(res, 'Payroll not found.', 404);

        await payroll.update({
            status: 'approved',
            approved_by_user_id: req.user.id,
            approved_at: new Date(),
        });

        return successResponse(res, payroll, 'Payroll approved.');
    } catch (error) {
        console.error('approvePayroll error:', error);
        return errorResponse(res, 'Failed to approve payroll.', 500);
    }
};

/**
 * PUT /api/payroll/lines/:id/paid
 */
const markWorkerPaid = async (req, res) => {
    try {
        const line = await PayrollLine.findOne({ where: { id: req.params.id, is_active: true } });
        if (!line) return errorResponse(res, 'Payroll line not found.', 404);

        await line.update({ status: 'paid', paid_at: new Date() });
        return successResponse(res, line, 'Worker marked as paid.');
    } catch (error) {
        console.error('markWorkerPaid error:', error);
        return errorResponse(res, 'Failed to mark worker as paid.', 500);
    }
};

/**
 * GET /api/payroll/review
 * Payroll Review Module — workers with approved unpaid time entries.
 */
const getPayrollReview = async (req, res) => {
    try {
        const timeEntries = await TimeEntry.findAll({
            where: { status: 'approved', is_active: true },
            include: [
                {
                    model: Worker, as: 'worker',
                    attributes: ['id', 'worker_code', 'first_name', 'last_name', 'hourly_rate'],
                    include: [{ model: Trade, as: 'trade', attributes: ['id', 'name', 'name_es'] }],
                },
            ],
        });

        // Group by worker
        const reviewMap = {};
        for (const entry of timeEntries) {
            const wId = entry.worker_id;
            if (!reviewMap[wId]) {
                reviewMap[wId] = {
                    worker_code: entry.worker.worker_code,
                    name: `${entry.worker.first_name} ${entry.worker.last_name}`,
                    trade: entry.worker.trade?.name || 'N/A',
                    hourly_rate: entry.worker.hourly_rate,
                    total_hours: 0,
                    total_pay: 0,
                    status: 'pending',
                };
            }
            const hours = parseFloat(entry.total_hours || 0);
            reviewMap[wId].total_hours += hours;
            reviewMap[wId].total_pay += hours * parseFloat(entry.worker.hourly_rate);
        }

        const review = Object.values(reviewMap).map((r) => ({
            ...r,
            total_hours: parseFloat(r.total_hours.toFixed(2)),
            total_pay: parseFloat(r.total_pay.toFixed(2)),
        }));

        // Sort by status (pending first)
        review.sort((a, b) => (a.status === 'pending' ? -1 : 1));

        return successResponse(res, review, 'Payroll review retrieved.');
    } catch (error) {
        console.error('getPayrollReview error:', error);
        return errorResponse(res, 'Failed to retrieve payroll review.', 500);
    }
};

module.exports = {
    generatePayroll, getAllPayrolls, getPayrollById,
    approvePayroll, markWorkerPaid, getPayrollReview,
};
