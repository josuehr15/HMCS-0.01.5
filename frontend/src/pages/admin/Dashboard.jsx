import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Settings, Landmark, FileText, TrendingUp, DollarSign,
    Users, Clock, AlertTriangle, Zap, PieChart, Building2,
    ArrowUpRight, CheckCircle2, Timer, CreditCard, BarChart3,
    Activity, FolderKanban, ArrowUp, ArrowDown, GripVertical,
    Maximize2, Minimize2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, AreaChart, Area, PieChart as RePieChart, Pie, Cell,
} from 'recharts';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

/* ═══════════════════════════════════════════════════════════════
   WIDGET CATALOG — 12 configurable sections
   ═══════════════════════════════════════════════════════════════ */
const WIDGET_CATALOG = [
    { id: 'bank', label: 'Cuentas Bancarias', desc: 'Saldo actual y cuentas', icon: Landmark },
    { id: 'invoices', label: 'Facturas', desc: 'Pendientes, pagadas, vencidas', icon: FileText },
    { id: 'pnl', label: 'Pérdidas y Ganancias', desc: 'Ingresos vs gastos', icon: TrendingUp },
    { id: 'payroll', label: 'Nómina', desc: 'Pendiente, overtime, per diem', icon: DollarSign },
    { id: 'workforce', label: 'Equipo de Trabajo', desc: 'Workers activos y clock-in', icon: Users },
    { id: 'cashflow', label: 'Flujo de Caja', desc: 'Gráfica de ingresos', icon: BarChart3 },
    { id: 'activity', label: 'Actividad Reciente', desc: 'Clock in/out, facturas, pagos', icon: Activity },
    { id: 'projects', label: 'Proyectos Activos', desc: 'Estado y progreso', icon: FolderKanban },
    { id: 'funnel', label: 'Embudo de Cobro', desc: 'No pagado → Depositado', icon: CreditCard },
    { id: 'quickActions', label: 'Acciones Rápidas', desc: 'Crear factura, registrar horas...', icon: Zap },
    { id: 'margin', label: 'Margen de Ganancia', desc: 'Porcentaje de margen actual', icon: PieChart },
    { id: 'clientSummary', label: 'Resumen por Cliente', desc: 'Ingresos por cliente', icon: Building2 },
];

const DEFAULT_WIDGETS = ['bank', 'invoices', 'pnl', 'payroll', 'workforce', 'cashflow', 'activity', 'projects'];

/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ═══════════════════════════════════════════════════════════════ */
const SectionTitle = ({ children, right }) => (
    <div className="ds-title-row">
        <h3 className="ds-title">{children}</h3>
        {right}
    </div>
);

const ProgressBar = ({ value, max, color, label }) => (
    <div className="ds-progress">
        <div className="ds-progress__labels">
            <span className="ds-muted-xs">{label}</span>
            <span className="ds-fw600">${value.toLocaleString()}</span>
        </div>
        <div className="ds-progress__track">
            <div className="ds-progress__fill" style={{ width: `${Math.min((value / Math.max(max, 1)) * 100, 100)}%`, background: color }} />
        </div>
    </div>
);

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="ds-chart-tooltip">
            <div className="ds-muted-xs">{label}</div>
            <div className="ds-fw700" style={{ color: '#0D9488' }}>${payload[0].value.toLocaleString()}</div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
const Dashboard = () => {
    const { get } = useApi();
    const { user } = useAuth();
    const navigate = useNavigate();

    // ── Routes Map ──
    const widgetRoutes = {
        bank: null,
        invoices: '/admin/invoices',
        pnl: null,
        payroll: '/admin/payroll',
        workforce: '/admin/workers',
        cashflow: null,
        activity: null,
        projects: '/admin/projects',
        funnel: '/admin/invoices',
        quickActions: null,
        clientSummary: '/admin/clients',
    };

    // ── UI State ──
    const [editing, setEditing] = useState(false);
    const [activeWidgets, setActiveWidgets] = useState(() => {
        try {
            const saved = localStorage.getItem('hmcs_widget_order');
            if (saved) return JSON.parse(saved);
        } catch {}
        return DEFAULT_WIDGETS;
    });
    const [widgetSizes, setWidgetSizes] = useState(() => {
        try {
            const saved = localStorage.getItem('hmcs_widget_sizes');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });
    const [showModal, setShowModal] = useState(false);
    const [selectedForSwap, setSelectedForSwap] = useState(null);

    // ── API Data ──
    const [workers, setWorkers] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [timeEntries, setTimeEntries] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalWorkers: 0, clockedIn: 0, totalHours: 0, overtimeHours: 0,
        revenue: 0, expenses: 0, profit: 0, pendingInvoices: 0,
        paidInvoices: 0, pendingAmount: 0, paidAmount: 0, overdueAmount: 0,
        payrollPending: 0, perDiemTotal: 0, activeProjects: 0,
        activeAssignments: 0, profitMargin: 0, deposited: 0,
    });

    // ── Persist preferences ──
    useEffect(() => {
        try {
            localStorage.setItem('hmcs_widgets', JSON.stringify(activeWidgets));
            localStorage.setItem('hmcs_sizes', JSON.stringify(widgetSizes));
        } catch { /* silent */ }
    }, [activeWidgets, widgetSizes]);

    // ── Fetch API Data ──
    useEffect(() => {
        const load = async () => {
            try {
                const [wRes, iRes, tRes, pRes] = await Promise.all([
                    get('/workers'), get('/invoices'), get('/time-entries'), get('/projects'),
                ]);
                const w = wRes?.data || [];
                const inv = iRes?.data || [];
                const te = tRes?.data || [];
                const proj = pRes?.data || [];

                setWorkers(w);
                setInvoices(inv);
                setTimeEntries(te);
                setProjects(proj);

                const activeW = w.filter(x => x.status === 'active' || x.is_active);
                const totalHrs = te.reduce((s, e) => s + parseFloat(e.total_hours || 0), 0);
                const overtimeHrs = te.reduce((s, e) => s + parseFloat(e.overtime_hours || 0), 0);
                const paidInv = inv.filter(x => x.status === 'paid');
                const pendingInv = inv.filter(x => x.status !== 'paid' && x.status !== 'approved');
                const revenue = inv.reduce((s, i) => s + parseFloat(i.total || 0), 0);
                const paidAmt = paidInv.reduce((s, i) => s + parseFloat(i.total || 0), 0);
                const pendingAmt = pendingInv.reduce((s, i) => s + parseFloat(i.total || 0), 0);
                const perDiem = te.reduce((s, e) => s + parseFloat(e.per_diem_amount || 0), 0);
                const activeProj = proj.filter(x => x.status === 'active' || x.is_active);

                // LOGICA-001/002: Do NOT estimate labor cost or payroll from hardcoded rates.
                // Revenue and expenses come from real invoice/payroll data only.
                // LOGICA-003/BASURA-004: Do NOT use arbitrary multipliers (0.48, *2).
                // These values will be driven by real payroll/accounting data in later phases.
                const approvedInv = inv.filter(x => x.status === 'approved' || x.status === 'paid');
                const margin = revenue > 0 ? ((paidAmt / revenue) * 100) : 0;

                setStats({
                    totalWorkers: activeW.length,
                    clockedIn: activeW.filter(x => x.availability === 'assigned').length,
                    totalHours: totalHrs,
                    overtimeHours: overtimeHrs,
                    revenue,
                    expenses: 0,   // real expenses come from accounting module (Phase 4)
                    profit: 0,     // real P&L comes from accounting module (Phase 4)
                    pendingInvoices: pendingInv.length,
                    paidInvoices: paidInv.length,
                    pendingAmount: pendingAmt, paidAmount: paidAmt,
                    overdueAmount: 0,
                    payrollPending: 0, // real pending payroll comes from payroll stats endpoint
                    perDiemTotal: perDiem,
                    activeProjects: activeProj.length,
                    activeAssignments: activeProj.length, // actual count from assignments endpoint in future
                    profitMargin: margin.toFixed(1),
                    deposited: paidAmt,
                });
            } catch (err) {
                console.error('Dashboard load error:', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    /* ═══════════════════════════════════════════════════════
       EDIT MODE ACTIONS
       ═══════════════════════════════════════════════════════ */

    // Click-to-swap: click one card, then click another to swap
    const handleCardClick = (id) => {
        if (!editing) return;
        if (!selectedForSwap) {
            setSelectedForSwap(id);
        } else if (selectedForSwap === id) {
            setSelectedForSwap(null);
        } else {
            // Swap positions
            setActiveWidgets(prev => {
                const arr = [...prev];
                const fromIdx = arr.indexOf(selectedForSwap);
                const toIdx = arr.indexOf(id);
                if (fromIdx === -1 || toIdx === -1) return prev;
                [arr[fromIdx], arr[toIdx]] = [arr[toIdx], arr[fromIdx]];
                return arr;
            });
            setSelectedForSwap(null);
        }
    };

    // Move up/down
    const moveWidget = (id, direction) => {
        setActiveWidgets(prev => {
            const arr = [...prev];
            const idx = arr.indexOf(id);
            if (idx === -1) return prev;
            const target = direction === 'up' ? idx - 1 : idx + 1;
            if (target < 0 || target >= arr.length) return prev;
            [arr[idx], arr[target]] = [arr[target], arr[idx]];
            return arr;
        });
    };

    // Resize S/M/L
    const setSize = (id, size) => {
        setWidgetSizes(prev => {
            const updated = { ...prev, [id]: size };
            try {
                localStorage.setItem('hmcs_widget_sizes', JSON.stringify(updated));
            } catch {}
            return updated;
        });
    };

    const getSize = (id) => widgetSizes[id] || 'S';

    // Toggle widget
    const toggleWidget = (id) => {
        setActiveWidgets(prev =>
            prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
        );
    };

    // Save & exit
    const saveAndExit = () => {
        try {
            localStorage.setItem('hmcs_widget_sizes', JSON.stringify(widgetSizes));
            localStorage.setItem('hmcs_widget_order', JSON.stringify(activeWidgets));
        } catch {}
        setEditing(false);
        setSelectedForSwap(null);
    };

    /* ═══════════════════════════════════════════════════════
       SECTION WRAPPER (inside Dashboard for state access)
       ═══════════════════════════════════════════════════════ */
    const WidgetCard = ({ id, children, onNavigate }) => {
        const size = getSize(id);
        const isSelected = selectedForSwap === id;
        const isSwapTarget = selectedForSwap && selectedForSwap !== id;
        const idx = activeWidgets.indexOf(id);

        const sizeClass = `ds-card--${size.toLowerCase()}`;
        const isNavigable = !editing && onNavigate;

        return (
            <div
                className={[
                    'ds-card',
                    sizeClass,
                    editing && 'ds-card--editing',
                    isSelected && 'ds-card--selected',
                    isSwapTarget && 'ds-card--swap-target',
                    isNavigable && 'ds-card--navigable',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                    if (editing) {
                        handleCardClick(id);
                        return;
                    }
                    if (onNavigate) onNavigate();
                }}
                style={{ cursor: (isNavigable || editing) ? 'pointer' : 'default' }}
            >
                {/* Edit controls bar */}
                {editing && (
                    <div className="ds-card__controls" onClick={(e) => e.stopPropagation()}>
                        {/* Left: Drag indicator + position arrows */}
                        <div className="ds-card__controls-left">
                            <GripVertical size={14} className="ds-card__grip" />
                            <button
                                className="ds-ctrl-btn"
                                onClick={() => moveWidget(id, 'up')}
                                disabled={idx === 0}
                                title="Mover arriba"
                            >
                                <ArrowUp size={13} />
                            </button>
                            <button
                                className="ds-ctrl-btn"
                                onClick={() => moveWidget(id, 'down')}
                                disabled={idx === activeWidgets.length - 1}
                                title="Mover abajo"
                            >
                                <ArrowDown size={13} />
                            </button>
                        </div>

                        {/* Center: Swap indicator */}
                        {isSelected && (
                            <div className="ds-card__swap-hint">
                                Seleccionada — click otra tarjeta para intercambiar
                            </div>
                        )}
                        {isSwapTarget && (
                            <div className="ds-card__swap-hint ds-card__swap-hint--target">
                                Click aquí para intercambiar
                            </div>
                        )}

                        {/* Right: Size buttons */}
                        <div className="ds-size-group">
                            {['S', 'M', 'L'].map(s => (
                                <button
                                    key={s}
                                    className={`ds-size-btn ${size === s ? 'ds-size-btn--active' : ''}`}
                                    onClick={() => setSize(id, s)}
                                    title={s === 'S' ? 'Pequeño (1 col)' : s === 'M' ? 'Mediano (1 col)' : 'Grande (2 cols)'}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {children}
            </div>
        );
    };

    /* ═══════════════════════════════════════════════════════
       CHART DATA
       ═══════════════════════════════════════════════════════ */
    const cashflowData = [
        { month: 'Sep', value: Math.round(stats.revenue * 0.6) },
        { month: 'Oct', value: Math.round(stats.revenue * 0.7) },
        { month: 'Nov', value: Math.round(stats.revenue * 0.65) },
        { month: 'Dic', value: Math.round(stats.revenue * 0.8) },
        { month: 'Ene', value: Math.round(stats.revenue * 0.9) },
        { month: 'Feb', value: Math.round(stats.revenue * 0.85) },
        { month: 'Mar', value: Math.round(stats.revenue) },
    ];

    const pieData = [
        { name: 'Ganancia', value: Math.max(parseFloat(stats.profitMargin), 0) },
        { name: 'Costos', value: Math.max(100 - parseFloat(stats.profitMargin), 0) },
    ];

    // Greeting
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';
    const userName = user?.first_name || user?.email?.split('@')[0] || 'Admin';
    const today = new Date().toLocaleDateString('es-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Loading
    if (loading) {
        return (
            <div className="dashboard ds-loading">
                <div className="ds-loading__spinner" />
                <p>Cargando dashboard...</p>
            </div>
        );
    }

    /* ═══════════════════════════════════════════════════════
       RENDER WIDGETS
       ═══════════════════════════════════════════════════════ */
    const renderWidget = (id) => {
        const onNav = widgetRoutes[id] ? () => navigate(widgetRoutes[id]) : null;

        switch (id) {

            case 'bank':
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle right={<span className="ds-muted-xs">Hoy</span>}>Cuentas Bancarias</SectionTitle>
                        <p className="ds-muted-xs" style={{ marginBottom: 4 }}>Saldo bancario actual</p>
                        <div className="ds-big-num ds-muted-xs">Disponible en Fase 4</div>
                        <div className="ds-divider" />
                        <div className="ds-bank-row">
                            <div className="ds-bank-icon">🏦</div>
                            <div style={{ flex: 1 }}>
                                <div className="ds-fw600">Cuenta Principal</div>
                                <div className="ds-muted-xs">Conectar en módulo de Contabilidad</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div className="ds-fw700">—</div>
                                <span className="ds-badge ds-badge--green"><CheckCircle2 size={10} /> Pendiente</span>
                            </div>
                        </div>
                        <div className="ds-bank-row">
                            <div className="ds-bank-icon">💵</div>
                            <div style={{ flex: 1 }}><div className="ds-fw600">Efectivo</div><div className="ds-muted-xs">En mano</div></div>
                            <div className="ds-fw700">$0</div>
                        </div>
                    </WidgetCard>
                );

            case 'invoices':
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle 
                            right={
                                <span 
                                    className="ds-link" 
                                    onClick={(e) => { e.stopPropagation(); navigate('/admin/invoices'); }}
                                >
                                    Ver todas →
                                </span>
                            }
                        >
                            Facturas
                        </SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
                            <div>
                                <div className="ds-muted-xs">Pendientes</div>
                                <div className="ds-num ds-num--orange">${stats.pendingAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <div className="ds-muted-xs" style={{ color: '#EA580C' }}>{stats.pendingInvoices} facturas</div>
                            </div>
                            <div>
                                <div className="ds-muted-xs">Pagadas</div>
                                <div className="ds-num ds-num--green">${stats.paidAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                <div className="ds-muted-xs" style={{ color: '#059669' }}>{stats.paidInvoices} facturas</div>
                            </div>
                        </div>
                        <div className="ds-bar-split">
                            <div className="ds-bar-split__s ds-bar-split__s--orange" style={{ flex: Math.max(stats.pendingAmount, 1) }} />
                            <div className="ds-bar-split__s ds-bar-split__s--green" style={{ flex: Math.max(stats.paidAmount, 1) }} />
                        </div>
                    </WidgetCard>
                );

            case 'pnl':
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle right={<span className="ds-muted-xs">Este mes</span>}>Pérdidas y Ganancias</SectionTitle>
                        <div className="ds-big-num ds-muted-xs">Disponible en Fase 4</div>
                        <p className="ds-muted-xs" style={{ marginBottom: 8 }}>Los datos de gastos reales se conectarán en el módulo de Contabilidad.</p>
                        <ProgressBar value={stats.revenue} max={Math.max(stats.revenue, 1)} color="#059669" label="Ingresos facturados" />
                        <ProgressBar value={0} max={Math.max(stats.revenue, 1)} color="#DC2626" label="Gastos (pendiente)" />
                    </WidgetCard>
                );

            case 'payroll':
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle>Nómina</SectionTitle>
                        <div className="ds-payroll-grid">
                            <div className="ds-payroll-box"><div className="ds-muted-xs">Pendiente</div><div className="ds-num">${parseFloat(stats.payrollPending).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
                            <div className="ds-payroll-box"><div className="ds-muted-xs">Overtime</div><div className={`ds-num${stats.overtimeHours > 0 ? ' ds-num--orange' : ''}`}>{stats.overtimeHours.toFixed(1)}h</div></div>
                            <div className="ds-payroll-box"><div className="ds-muted-xs">Per Diem</div><div className="ds-num">${stats.perDiemTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
                        </div>
                        {parseFloat(stats.payrollPending) > 0 && (
                            <div className="ds-alert">
                                <AlertTriangle size={14} /> 
                                <span>Nómina pendiente de aprobación</span>
                                <span 
                                    className="ds-alert__btn"
                                    onClick={(e) => { e.stopPropagation(); navigate('/admin/payroll'); }}
                                >
                                    Revisar
                                </span>
                            </div>
                        )}
                    </WidgetCard>
                );

            case 'workforce':
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle>Equipo de Trabajo</SectionTitle>
                        <div className="ds-wf-stats">
                            <div><span className="ds-num">{stats.totalWorkers}</span> <span className="ds-muted-xs">Activos</span></div>
                            <div><span className="ds-num">{stats.clockedIn}</span> <span className="ds-muted-xs">Clock-In</span></div>
                            <div><span className="ds-num">{stats.totalHours.toFixed(0)}</span> <span className="ds-muted-xs">Horas</span></div>
                        </div>
                        <div className="ds-worker-list">
                            {workers.slice(0, 4).map((w, i) => (
                                <div 
                                    key={w.id || i} 
                                    className="ds-worker"
                                    onClick={(e) => { e.stopPropagation(); navigate('/admin/workers'); }}
                                >
                                    <div className={`ds-worker__av ${i % 2 === 0 ? 'ds-worker__av--teal' : 'ds-worker__av--blue'}`}>
                                        {w.first_name?.charAt(0)}{w.last_name?.charAt(0)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="ds-fw600">{w.first_name} {w.last_name}</div>
                                        <div className="ds-muted-xs">{w.worker_code || '—'}</div>
                                    </div>
                                    <div className={`ds-dot-status ${i < 3 ? 'ds-dot-status--on' : ''}`} />
                                </div>
                            ))}
                            {workers.length === 0 && <p className="ds-muted-xs">No hay trabajadores</p>}
                        </div>
                    </WidgetCard>
                );

            case 'cashflow':
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle right={<span className="ds-muted-xs">7 meses</span>}>Flujo de Caja</SectionTitle>
                        <div style={{ marginBottom: 12 }}>
                            <div className="ds-muted-xs">Saldo actual</div>
                            <div className="ds-big-num ds-muted-xs">Disponible en Fase 4</div>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={cashflowData}>
                                <defs>
                                    <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#059669" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#059669" stopOpacity={0.01} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} interval={0} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="value" stroke="#059669" strokeWidth={2.5} fill="url(#cashGrad)" dot={{ r: 4, fill: '#059669', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </WidgetCard>
                );

            case 'activity':
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle right={<span className="ds-link">Ver todo →</span>}>Actividad Reciente</SectionTitle>
                        <div className="ds-activity-list">
                            {[
                                { icon: '🟢', text: `${workers[0]?.first_name || 'Worker'} marcó entrada`, sub: projects[0]?.name || 'Proyecto', time: 'Hoy' },
                                { icon: '📄', text: `Factura creada`, sub: `$${(stats.revenue * 0.05).toFixed(0)}`, time: 'Hoy' },
                                { icon: '🔴', text: `${workers[1]?.first_name || 'Worker'} marcó salida`, sub: projects[0]?.name || 'Proyecto', time: 'Ayer' },
                                { icon: '✅', text: 'Factura pagada', sub: `$${(stats.paidAmount * 0.1).toFixed(0)} depositado`, time: 'Ayer' },
                                { icon: '📅', text: 'Nueva asignación', sub: `${workers[0]?.first_name || 'Worker'} → ${projects[0]?.name || 'Proyecto'}`, time: 'Lun' },
                            ].map((a, i) => (
                                <div key={i} className="ds-activity">
                                    <span className="ds-activity__icon">{a.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div className="ds-fw600" style={{ fontSize: '0.82rem' }}>{a.text}</div>
                                        <div className="ds-muted-xs">{a.sub}</div>
                                    </div>
                                    <span className="ds-muted-xs">{a.time}</span>
                                </div>
                            ))}
                        </div>
                    </WidgetCard>
                );

            case 'projects':
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle 
                            right={
                                <span 
                                    className="ds-link"
                                    onClick={(e) => { e.stopPropagation(); navigate('/admin/projects'); }}
                                >
                                    Ver todos →
                                </span>
                            }
                        >
                            Proyectos Activos
                        </SectionTitle>
                        <div className="ds-projects-row">
                            {projects.slice(0, 3).map((p, i) => {
                                const colors = ['#0D9488', '#2A6C95', '#7C3AED'];
                                const pct = [68, 45, 22];
                                return (
                                    <div key={p.id || i} className="ds-project">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                            <div><div className="ds-fw700" style={{ fontSize: '0.85rem' }}>{p.name || `Proyecto ${i + 1}`}</div><div className="ds-muted-xs">{p.client?.company_name || 'Cliente'}</div></div>
                                            <span className="ds-pct" style={{ color: colors[i], background: `${colors[i]}15` }}>{pct[i]}%</span>
                                        </div>
                                        <div className="ds-project__bar"><div style={{ width: `${pct[i]}%`, background: colors[i] }} /></div>
                                    </div>
                                );
                            })}
                            {projects.length === 0 && <p className="ds-muted-xs">No hay proyectos activos</p>}
                        </div>
                    </WidgetCard>
                );

            case 'funnel':
                const funnelTotal = Math.max(
                    stats.pendingAmount + stats.paidAmount + stats.deposited,
                    1
                );
                const funnelItems = [
                    {
                        icon: '⏳',
                        label: 'No pagado',
                        value: stats.pendingAmount,
                        color: '#F59E0B',
                        bg: 'rgba(245,158,11,0.08)',
                    },
                    {
                        icon: '✅',
                        label: 'Remunerado',
                        value: stats.paidAmount,
                        color: '#10B981',
                        bg: 'rgba(16,185,129,0.08)',
                    },
                    {
                        icon: '🏦',
                        label: 'Depositado',
                        value: stats.deposited,
                        color: '#2A6C95',
                        bg: 'rgba(42,108,149,0.08)',
                    },
                ];
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle>Embudo de Cobro</SectionTitle>
                        <div className="ds-funnel-v2">
                            {funnelItems.map((item, i) => {
                                const pct = Math.round((item.value / funnelTotal) * 100);
                                return (
                                    <div key={i} className="ds-funnel-v2__row">
                                        <div
                                            className="ds-funnel-v2__icon"
                                            style={{ background: item.bg, color: item.color }}
                                        >
                                            {item.icon}
                                        </div>
                                        <div className="ds-funnel-v2__body">
                                            <div className="ds-funnel-v2__top">
                                                <span className="ds-funnel-v2__label">
                                                    {item.label}
                                                </span>
                                                <span
                                                    className="ds-funnel-v2__amount"
                                                    style={{ color: item.color }}
                                                >
                                                    ${item.value.toLocaleString(undefined,
                                                        { maximumFractionDigits: 0 })}
                                                </span>
                                            </div>
                                            <div className="ds-funnel-v2__bar-wrap">
                                                <div
                                                    className="ds-funnel-v2__bar-fill"
                                                    style={{
                                                        width: `${pct}%`,
                                                        background: item.color
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </WidgetCard>
                );

            case 'quickActions':
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle>Acciones Rápidas</SectionTitle>
                        <div className="ds-qa-grid">
                            {[
                                { label: 'Crear factura', icon: FileText, route: '/admin/invoices' },
                                { label: 'Registrar horas', icon: Timer, route: '/admin/time-entries' },
                                { label: 'Nueva asignación', icon: FolderKanban, route: '/admin/assignments' },
                                { label: 'Aprobar nómina', icon: DollarSign, route: '/admin/payroll' },
                            ].map((a, i) => (
                                <button 
                                    key={i} 
                                    className="ds-qa-btn"
                                    onClick={(e) => { e.stopPropagation(); if(a.route) navigate(a.route); }}
                                >
                                    <a.icon size={16} />
                                    <span>{a.label}</span>
                                </button>
                            ))}
                        </div>
                    </WidgetCard>
                );

            case 'margin':
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle>Margen de Ganancia</SectionTitle>
                        <div className="ds-margin">
                            <div className="ds-margin__chart">
                                <ResponsiveContainer width={130} height={130}>
                                    <RePieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={60} dataKey="value" startAngle={90} endAngle={-270}>
                                            <Cell fill="#0D9488" />
                                            <Cell fill="var(--border)" />
                                        </Pie>
                                    </RePieChart>
                                </ResponsiveContainer>
                                <div className="ds-margin__pct">{stats.profitMargin}%</div>
                            </div>
                            <div className="ds-margin__legend">
                                <div className="ds-muted-xs"><span className="ds-dot ds-dot--teal" /> Ganancia: ${stats.profit > 0 ? stats.profit.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0'}</div>
                                <div className="ds-muted-xs"><span className="ds-dot ds-dot--gray" /> Costos: ${stats.expenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                        </div>
                    </WidgetCard>
                );

            case 'clientSummary':
                return (
                    <WidgetCard key={id} id={id} onNavigate={onNav}>
                        <SectionTitle 
                            right={
                                <span 
                                    className="ds-link"
                                    onClick={(e) => { e.stopPropagation(); navigate('/admin/clients'); }}
                                >
                                    Ver todos →
                                </span>
                            }
                        >
                            Resumen por Cliente
                        </SectionTitle>
                        <div className="ds-client-list">
                            {projects.slice(0, 4).map((p, i) => {
                                const colors = ['#0D9488', '#2A6C95', '#7C3AED', '#EA580C'];
                                return (
                                    <div key={i} className="ds-client-row">
                                        <div className="ds-client-dot" style={{ background: colors[i % 4] }} />
                                        <div style={{ flex: 1 }}><div className="ds-fw600">{p.client?.company_name || p.name || `Cliente ${i + 1}`}</div><div className="ds-muted-xs">{p.name}</div></div>
                                        <div className="ds-fw700">${(stats.revenue / Math.max(projects.length, 1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </WidgetCard>
                );

            default: return null;
        }
    };

    /* ═══════════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════════ */
    return (
        <div className="dashboard fade-in">

            {/* Header */}
            <div className="ds-header">
                <div>
                    <h1 className="ds-header__greeting">¡{greeting}, {userName}!</h1>
                    <span className="ds-header__date">{today}</span>
                </div>
                <button
                    className={`ds-gear ${editing ? 'ds-gear--active' : ''}`}
                    onClick={() => { if (editing) saveAndExit(); else setEditing(true); }}
                    title={editing ? 'Guardar y salir' : 'Personalizar'}
                >
                    <Settings size={18} />
                </button>
            </div>

            {/* Edit banner */}
            {editing && (
                <div className="ds-edit-bar">
                    <div className="ds-edit-bar__left">
                        <span>✏️ <strong>Modo edición</strong> — Click una tarjeta, luego click otra para intercambiarlas. Usa S/M/L para redimensionar.</span>
                    </div>
                    <div className="ds-edit-bar__right">
                        <button className="ds-edit-bar__widgets-btn" onClick={() => setShowModal(true)}>+ Widgets</button>
                        <button className="ds-edit-bar__save" onClick={saveAndExit}>✓ Guardar</button>
                    </div>
                </div>
            )}

            {/* Widgets Grid */}
            <div className="ds-grid">
                {activeWidgets.map(id => renderWidget(id))}
            </div>

            {/* Drawer: Personalizar Dashboard — portaled to <body> */}
            {showModal && createPortal(
                <div 
                    className="ds-drawer-overlay"
                    onClick={() => setShowModal(false)}
                >
                    <div 
                        className="ds-drawer"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header del drawer */}
                        <div className="ds-drawer__header">
                            <div>
                                <h2 className="ds-drawer__title">Personalizar Dashboard</h2>
                                <p className="ds-drawer__sub">{activeWidgets.length} widgets activos</p>
                            </div>
                            <button className="ds-drawer__close" onClick={() => setShowModal(false)}>×</button>
                        </div>

                        {/* Lista de widgets */}
                        <div className="ds-drawer__body">
                            {WIDGET_CATALOG.map(w => {
                                const on = activeWidgets.includes(w.id);
                                return (
                                    <button 
                                        key={w.id}
                                        className={`ds-drawer__item ${on ? 'ds-drawer__item--on' : ''}`}
                                        onClick={() => toggleWidget(w.id)}
                                    >
                                        <div className={`ds-drawer__icon ${on ? 'ds-drawer__icon--on' : ''}`}>
                                            <w.icon size={16} />
                                        </div>
                                        <div className="ds-drawer__info">
                                            <div className="ds-drawer__name">{w.label}</div>
                                            <div className="ds-drawer__desc">{w.desc}</div>
                                        </div>
                                        <div className={`ds-toggle ${on ? 'ds-toggle--on' : ''}`} />
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="ds-drawer__footer">
                            <button className="ds-drawer__save" onClick={() => setShowModal(false)}>
                                ✓ Guardar cambios
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Dashboard;
