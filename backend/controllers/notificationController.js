const { Op } = require('sequelize');
const { Invoice, Payroll, PerDiemEntry, Transaction, TimeEntry, Worker, ShiftChange, Project, Assignment } = require('../models');

// ─── Shared: build notifications array ──────────────────────────────────────
// Extrae notificaciones de múltiples tablas. Reutilizado por REST y SSE.
const buildNotifications = async () => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const notifications = [];

    // 1. Facturas vencidas
    const overdueInvoices = await Invoice.findAll({
        where: { status: 'sent', due_date: { [Op.lt]: now }, is_active: true },
        attributes: ['id', 'invoice_number', 'total', 'due_date'],
    });
    if (overdueInvoices.length > 0) {
        const total = overdueInvoices.reduce((s, i) => s + parseFloat(i.total || 0), 0);
        notifications.push({
            id: 'overdue-invoices',
            type: 'overdue',
            title: overdueInvoices.length === 1 ? 'Factura vencida' : `${overdueInvoices.length} facturas vencidas`,
            desc: `$${total.toLocaleString('es-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} sin cobrar`,
            time: 'Requiere atención',
            color: '#EF4444',
            route: '/admin/invoices',
            count: overdueInvoices.length,
            priority: 1,
        });
    }

    // 2. Nómina pendiente
    const pendingPayrolls = await Payroll.count({ where: { status: 'pending', is_active: true } });
    if (pendingPayrolls > 0) {
        notifications.push({
            id: 'pending-payroll',
            type: 'payroll',
            title: pendingPayrolls === 1 ? 'Nómina pendiente' : `${pendingPayrolls} nóminas pendientes`,
            desc: 'Esperando aprobación',
            time: 'Pendiente',
            color: '#F59E0B',
            route: '/admin/payroll',
            count: pendingPayrolls,
            priority: 2,
        });
    }

    // 3. Per Diem sin pagar
    const pendingPerDiem = await PerDiemEntry.count({ where: { status: 'pending', is_active: true } });
    if (pendingPerDiem > 0) {
        notifications.push({
            id: 'pending-perdiem',
            type: 'perdiem',
            title: pendingPerDiem === 1 ? 'Per Diem pendiente' : `${pendingPerDiem} per diem pendientes`,
            desc: 'Sin procesar',
            time: 'Pendiente',
            color: '#8B5CF6',
            route: '/admin/per-diem',
            count: pendingPerDiem,
            priority: 3,
        });
    }

    // 4. Transacciones sin categorizar
    const uncategorized = await Transaction.count({ where: { category_id: null, is_active: true } });
    if (uncategorized > 0) {
        notifications.push({
            id: 'uncategorized-transactions',
            type: 'accounting',
            title: uncategorized === 1 ? 'Transacción sin categorizar' : `${uncategorized} transacciones sin categorizar`,
            desc: 'Revisar en Contabilidad',
            time: 'Pendiente',
            color: '#2A6C95',
            route: '/admin/accounting',
            count: uncategorized,
            priority: 4,
        });
    }

    // 5. Workers con clock-in activo hoy
    const activeClockins = await TimeEntry.findAll({
        where: { clock_in: { [Op.gte]: todayStart }, clock_out: null, is_active: true },
        include: [{ model: Worker, as: 'worker', attributes: ['first_name', 'last_name'] }],
        limit: 3,
    });
    if (activeClockins.length > 0) {
        const names = activeClockins
            .map(e => e.worker ? e.worker.first_name.split(' ')[0] : 'Worker')
            .join(', ');
        notifications.push({
            id: 'active-clockins',
            type: 'clockin',
            title: activeClockins.length === 1 ? '1 trabajador activo' : `${activeClockins.length} trabajadores activos`,
            desc: names,
            time: 'Hoy',
            color: '#10B981',
            route: '/admin/time-entries',
            count: activeClockins.length,
            priority: 5,
        });
    }

    // 6. Facturas enviadas (no vencidas)
    const sentInvoices = await Invoice.count({
        where: { status: 'sent', due_date: { [Op.gte]: now }, is_active: true },
    });
    if (sentInvoices > 0) {
        notifications.push({
            id: 'sent-invoices',
            type: 'invoice',
            title: sentInvoices === 1 ? 'Factura enviada sin cobrar' : `${sentInvoices} facturas sin cobrar`,
            desc: 'Pendientes de pago',
            time: 'En proceso',
            color: '#2A6C95',
            route: '/admin/invoices',
            count: sentInvoices,
            priority: 6,
        });
    }

    // 7. Cambios de turno pendientes de revisión admin (accepted_target)
    const pendingShiftReview = await ShiftChange.count({ where: { status: 'accepted_target' } });

    if (pendingShiftReview > 0) {
        notifications.push({
            id: 'pending-shift-review',
            type: 'shift_change',
            title: pendingShiftReview === 1
                ? 'Cambio de turno por revisar'
                : `${pendingShiftReview} cambios de turno por revisar`,
            desc: 'Aceptados por ambos workers — esperan aprobación',
            time: 'Pendiente',
            color: '#7C3AED',
            route: '/admin/shift-changes',
            count: pendingShiftReview,
            priority: 2, // alta prioridad — debajo de facturas vencidas
        });
    }

    // 8. Proyectos activos sin workers asignados — sugiere usar Matching
    const activeProjects = await Project.findAll({
        where: { is_active: true, status: 'active' },
        attributes: ['id', 'name'],
        include: [{
            association: 'assignments',
            required: false,
            where: { status: 'active', is_active: true },
            attributes: ['id'],
        }],
    });
    const unstaffedProjects = activeProjects.filter(p => (p.assignments || []).length === 0);
    if (unstaffedProjects.length > 0) {
        notifications.push({
            id: 'unstaffed-projects',
            type: 'matching',
            title: unstaffedProjects.length === 1
                ? '1 proyecto sin workers asignados'
                : `${unstaffedProjects.length} proyectos sin workers asignados`,
            desc: unstaffedProjects.slice(0, 2).map(p => p.name).join(', ') +
                  (unstaffedProjects.length > 2 ? ` y ${unstaffedProjects.length - 2} más` : ''),
            time: 'Requiere atención',
            color: '#0EA5E9',
            route: '/admin/matching',
            count: unstaffedProjects.length,
            priority: 3,
        });
    }

    notifications.sort((a, b) => a.priority - b.priority);
    return notifications;
};

// ─── GET /api/notifications ─────────────────────────────────────────────────
const getNotifications = async (req, res) => {
    try {
        const notifications = await buildNotifications();
        return res.json({ success: true, data: notifications, total: notifications.length });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        return res.status(500).json({ success: false, message: 'Error al obtener notificaciones' });
    }
};

// ─── GET /api/notifications/stream ──────────────────────────────────────────
// SSE — empuja notificaciones cada 30s. El cliente reconecta automáticamente.
// Auth: token en query param (?token=...) porque EventSource no soporta headers.
const SSE_INTERVAL_MS = 30_000;
const HEARTBEAT_MS    = 25_000; // mantiene la conexión viva en proxies que timeout a 30s

const streamNotifications = async (req, res) => {
    // Establecer headers SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // deshabilitar buffering en nginx
    res.flushHeaders();

    // Helper para escribir un evento SSE con formato correcto
    const sendEvent = (eventName, payload) => {
        if (res.writableEnded) return;
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // Envío inmediato al conectar
    try {
        const notifications = await buildNotifications();
        sendEvent('notifications', { data: notifications, total: notifications.length });
    } catch (err) {
        console.error('[SSE] Initial fetch error:', err.message);
    }

    // Polling cada 30s
    const dataTimer = setInterval(async () => {
        try {
            const notifications = await buildNotifications();
            sendEvent('notifications', { data: notifications, total: notifications.length });
        } catch (err) {
            console.error('[SSE] Polling error:', err.message);
        }
    }, SSE_INTERVAL_MS);

    // Heartbeat cada 25s para evitar timeout de proxies/load balancers
    const heartbeatTimer = setInterval(() => {
        if (res.writableEnded) return;
        res.write(': heartbeat\n\n');
    }, HEARTBEAT_MS);

    // Cleanup cuando el cliente cierra la conexión
    const cleanup = () => {
        clearInterval(dataTimer);
        clearInterval(heartbeatTimer);
        if (!res.writableEnded) res.end();
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
};

module.exports = { getNotifications, streamNotifications };
