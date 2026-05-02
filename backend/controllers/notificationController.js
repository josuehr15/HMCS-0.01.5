const { Op } = require('sequelize');
const { Invoice, Payroll, PerDiemEntry, Transaction, TimeEntry, Worker } = require('../models');

// ─── GET /api/notifications ─────────────────────────────────────────────────
// Agrega notificaciones reales desde múltiples tablas.
// Cada notificación tiene: id, type, title, desc, time, color, route, count
const getNotifications = async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const notifications = [];

        // ── 1. Facturas vencidas (sent + past due_date) ──────────────────────
        const overdueInvoices = await Invoice.findAll({
            where: {
                status: 'sent',
                due_date: { [Op.lt]: now },
                is_active: true,
            },
            attributes: ['id', 'invoice_number', 'total_amount', 'due_date'],
        });
        if (overdueInvoices.length > 0) {
            const total = overdueInvoices.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
            notifications.push({
                id: 'overdue-invoices',
                type: 'overdue',
                title: overdueInvoices.length === 1
                    ? `Factura vencida`
                    : `${overdueInvoices.length} facturas vencidas`,
                desc: `$${total.toLocaleString('es-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} sin cobrar`,
                time: 'Requiere atención',
                color: '#EF4444',
                route: '/admin/invoices',
                count: overdueInvoices.length,
                priority: 1,
            });
        }

        // ── 2. Nómina pendiente de aprobación ────────────────────────────────
        const pendingPayrolls = await Payroll.count({
            where: { status: 'pending', is_active: true },
        });
        if (pendingPayrolls > 0) {
            notifications.push({
                id: 'pending-payroll',
                type: 'payroll',
                title: pendingPayrolls === 1
                    ? 'Nómina pendiente'
                    : `${pendingPayrolls} nóminas pendientes`,
                desc: 'Esperando aprobación',
                time: 'Pendiente',
                color: '#F59E0B',
                route: '/admin/payroll',
                count: pendingPayrolls,
                priority: 2,
            });
        }

        // ── 3. Per Diem sin pagar ────────────────────────────────────────────
        const pendingPerDiem = await PerDiemEntry.count({
            where: { status: 'pending', is_active: true },
        });
        if (pendingPerDiem > 0) {
            notifications.push({
                id: 'pending-perdiem',
                type: 'perdiem',
                title: pendingPerDiem === 1
                    ? 'Per Diem pendiente'
                    : `${pendingPerDiem} per diem pendientes`,
                desc: 'Sin procesar',
                time: 'Pendiente',
                color: '#8B5CF6',
                route: '/admin/per-diem',
                count: pendingPerDiem,
                priority: 3,
            });
        }

        // ── 4. Transacciones sin categorizar ────────────────────────────────
        const uncategorized = await Transaction.count({
            where: { category_id: null, is_active: true },
        });
        if (uncategorized > 0) {
            notifications.push({
                id: 'uncategorized-transactions',
                type: 'accounting',
                title: uncategorized === 1
                    ? 'Transacción sin categorizar'
                    : `${uncategorized} transacciones sin categorizar`,
                desc: 'Revisar en Contabilidad',
                time: 'Pendiente',
                color: '#2A6C95',
                route: '/admin/accounting',
                count: uncategorized,
                priority: 4,
            });
        }

        // ── 5. Workers con clock-in activo hoy ──────────────────────────────
        const activeClockins = await TimeEntry.findAll({
            where: {
                clock_in: { [Op.gte]: todayStart },
                clock_out: null,
                is_active: true,
            },
            include: [{ model: Worker, as: 'worker', attributes: ['first_name', 'last_name'] }],
            limit: 3,
        });
        if (activeClockins.length > 0) {
            const names = activeClockins
                .map(e => e.worker ? `${e.worker.first_name.split(' ')[0]}` : 'Worker')
                .join(', ');
            notifications.push({
                id: 'active-clockins',
                type: 'clockin',
                title: activeClockins.length === 1
                    ? '1 trabajador activo'
                    : `${activeClockins.length} trabajadores activos`,
                desc: names,
                time: 'Hoy',
                color: '#10B981',
                route: '/admin/time-entries',
                count: activeClockins.length,
                priority: 5,
            });
        }

        // ── 6. Facturas enviadas (pendientes de pago, no vencidas) ──────────
        const sentInvoices = await Invoice.count({
            where: {
                status: 'sent',
                due_date: { [Op.gte]: now },
                is_active: true,
            },
        });
        if (sentInvoices > 0) {
            notifications.push({
                id: 'sent-invoices',
                type: 'invoice',
                title: sentInvoices === 1
                    ? 'Factura enviada sin cobrar'
                    : `${sentInvoices} facturas sin cobrar`,
                desc: 'Pendientes de pago',
                time: 'En proceso',
                color: '#2A6C95',
                route: '/admin/invoices',
                count: sentInvoices,
                priority: 6,
            });
        }

        // Ordenar por prioridad
        notifications.sort((a, b) => a.priority - b.priority);

        return res.json({
            success: true,
            data: notifications,
            total: notifications.length,
        });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener notificaciones' });
    }
};

module.exports = { getNotifications };
