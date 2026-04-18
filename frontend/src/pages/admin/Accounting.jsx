import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import ReactDOM from 'react-dom';
import {
    BarChart2, List, Upload, FolderOpen, FileText,
    Plus, X, Search, ChevronDown, RefreshCw, CheckCircle,
    Download, Edit2, Trash2,
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip,
} from 'chart.js';
import useApi from '../../hooks/useApi';
import PrintPreviewModal from '../../components/accounting/PrintPreviewModal';
import './Accounting.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt$ = v => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';
const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart2 size={15} /> },
    { id: 'transactions', label: 'Transacciones', icon: <List size={15} /> },
    { id: 'import', label: 'Importar CSV', icon: <Upload size={15} /> },
    { id: 'categories', label: 'Categorías', icon: <FolderOpen size={15} /> },
    { id: 'tax', label: 'Tax', icon: <FileText size={15} /> },
];


// ─── Month label helpers ──────────────────────────────────────────────────────
const MONTH_LABELS_LONG = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function monthLabel(yyyyMM) {
    const [y, m] = yyyyMM.split('-');
    return `${MONTH_LABELS_LONG[parseInt(m, 10) - 1]} de ${y}`;
}

function prevMonth(yyyyMM) {
    const [y, m] = yyyyMM.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(yyyyMM) {
    const [y, m] = yyyyMM.split('-').map(Number);
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────
const IconIncome = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 10L6 6L9 8L12 4" stroke="#3B6D11" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="10,4 12,4 12,6" stroke="#3B6D11" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
const IconExpense = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 4L6 8L9 6L12 10" stroke="#A32D2D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="10,10 12,10 12,8" stroke="#A32D2D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);
const IconNet = ({ isLoss }) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <line x1="7" y1="2" x2="7" y2="12" stroke={isLoss ? '#A32D2D' : '#3B6D11'} strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M4.5 4.5 Q4.5 3 7 3 Q9.5 3 9.5 5 Q9.5 7 7 7 Q4.5 7 4.5 9 Q4.5 11 7 11 Q9.5 11 9.5 9.5" stroke={isLoss ? '#A32D2D' : '#3B6D11'} strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
);
const IconMargin = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="4.5" cy="4.5" r="1.5" stroke="#854F0B" strokeWidth="1.5"/>
        <circle cx="9.5" cy="9.5" r="1.5" stroke="#854F0B" strokeWidth="1.5"/>
        <line x1="3" y1="11" x2="11" y2="3" stroke="#854F0B" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);

// ═════════════════════════════════════════════════════════════════════════════
// TAB 1 — DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
function TabDashboard({ api, setActiveTab, onUncatCountChange }) {
    const now = new Date();
    const todayMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [period, setPeriod] = useState(todayMonth);
    const [summary, setSummary] = useState(null);
    const [cashflow, setCashflow] = useState(null);
    const [wMargins, setWMargins] = useState([]);
    const [cMargins, setCMargins] = useState([]);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [loadingMargins, setLoadingMargins] = useState(false);

    const fetchSummary = useCallback(async (mon) => {
        setLoadingSummary(true);
        try {
            const year = mon.split('-')[0];
            const [sRes, cfRes] = await Promise.all([
                api.get(`/accounting/dashboard-summary?month=${mon}`),
                api.get(`/accounting/cashflow-year?year=${year}`),
            ]);
            const s = sRes.data?.data || sRes.data || sRes;
            setSummary(s);
            setCashflow(cfRes.data?.data || cfRes.data || cfRes);
            if (onUncatCountChange) onUncatCountChange(s?.uncategorized_count || 0);
        } catch (e) { console.error(e); }
        finally { setLoadingSummary(false); }
    }, [api]);

    const fetchMargins = useCallback(async () => {
        setLoadingMargins(true);
        try {
            const [wmRes, cmRes] = await Promise.all([
                api.get('/accounting/margins/workers'),
                api.get('/accounting/margins/clients'),
            ]);
            setWMargins(wmRes.data?.data || wmRes.data || []);
            setCMargins(cmRes.data?.data || cmRes.data || []);
        } catch (e) { console.error(e); }
        finally { setLoadingMargins(false); }
    }, [api]);

    useEffect(() => { fetchSummary(period); }, [period]);
    useEffect(() => { fetchMargins(); }, [fetchMargins]);

    const cur = summary?.current || { income: 0, expenses: 0, net: 0, margin: null };
    const prev = summary?.previous || { income: 0, expenses: 0, net: 0, margin: null };
    const uncategorizedCount = summary?.uncategorized_count || 0;
    const plIncome = summary?.pl_by_category?.income || [];
    const plExpenses = summary?.pl_by_category?.expenses || [];
    const totalIncome = plIncome.reduce((s, r) => s + r.total, 0);
    const totalExpenses = plExpenses.reduce((s, r) => s + r.total, 0);

    // Previous month label (for KPI sub-text)
    const prevPeriod = prevMonth(period);
    const [prevY, prevM] = prevPeriod.split('-');
    const prevLabel = `${MONTH_LABELS_LONG[parseInt(prevM, 10) - 1]} ${prevY}`;

    // Trend pill helper
    const trendPill = (current, previous, invertColors = false) => {
        if (previous === 0) return <span className="trend-pill trend-pill--neutral">Sin datos previos</span>;
        const diff = current - previous;
        const isPositive = diff > 0;
        const isGoodUp = !invertColors ? isPositive : !isPositive;
        const cls = diff === 0 ? 'trend-pill--neutral' : (isGoodUp ? 'trend-pill--up' : 'trend-pill--down');
        const sign = diff >= 0 ? '+' : '';
        return <span className={`trend-pill ${cls}`}>{sign}{fmt$(Math.abs(diff))}</span>;
    };

    // Chart.js data
    const cashFlowChartData = cashflow ? {
        labels: cashflow.months.map(m => m.label),
        datasets: [
            {
                label: 'Ingresos',
                data: cashflow.months.map(m => m.income),
                backgroundColor: '#639922',
                borderRadius: 3,
                borderSkipped: false,
                barPercentage: 0.7,
            },
            {
                label: 'Gastos',
                data: cashflow.months.map(m => m.expenses),
                backgroundColor: '#E24B4A',
                borderRadius: 3,
                borderSkipped: false,
                barPercentage: 0.7,
            },
        ],
    } : null;

    const cashFlowOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: {
                grid: { display: false },
                ticks: { font: { size: 10 }, color: '#888780', autoSkip: false, maxRotation: 0 },
            },
            y: {
                grid: { color: 'rgba(128,128,128,0.1)' },
                ticks: {
                    font: { size: 10 }, color: '#888780',
                    callback: v => v === 0 ? '$0' : '$' + (v / 1000).toFixed(0) + 'k',
                },
            },
        },
    };

    return (
        <div className="ac-tab-content">
            {/* Alert banner */}
            {uncategorizedCount > 0 && (
                <div className="alert-uncategorized">
                    <div className="alert-uncategorized__icon">!</div>
                    <span>{uncategorizedCount} transacciones sin categorizar — categorizar antes de cerrar el mes</span>
                    <button onClick={() => setActiveTab('transactions')}>Categorizar ahora →</button>
                </div>
            )}

            {/* Period bar */}
            <div className="period-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="ac-period-label">Período:</span>
                    <button className="period-nav-btn" onClick={() => setPeriod(p => prevMonth(p))}>&#8249;</button>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', minWidth: 140, textAlign: 'center' }}>
                        {monthLabel(period)}
                    </span>
                    <button className="period-nav-btn" onClick={() => setPeriod(p => nextMonth(p))}>&#8250;</button>
                    <button className="period-nav-btn" onClick={() => setPeriod(todayMonth)} style={{ marginLeft: 4 }}>Hoy</button>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button className="quick-action-pill" onClick={() => setActiveTab('import')}>Importar CSV</button>
                    <button className="quick-action-pill" onClick={() => setActiveTab('tax')}>Reporte 1099</button>
                    <button className="quick-action-pill" onClick={() => setActiveTab('tax')}>Exportar Tax</button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
                {/* Card 1 — Ingresos */}
                <div className="kpi-card kpi-card--green">
                    <div className="kpi-card__header">
                        <span className="kpi-card__label">Ingresos</span>
                        <div className="kpi-card__icon" style={{ background: '#c0dd97' }}><IconIncome /></div>
                    </div>
                    {loadingSummary
                        ? <div className="kpi-skeleton" />
                        : <div className="kpi-card__value">{fmt$(cur.income)}</div>
                    }
                    <div className="kpi-card__trend">
                        {loadingSummary ? <div className="kpi-skeleton" style={{ width: 80, height: 16 }} /> : trendPill(cur.income, prev.income)}
                        <span className="kpi-card__sub">vs {prevLabel}</span>
                    </div>
                </div>

                {/* Card 2 — Gastos */}
                <div className="kpi-card kpi-card--red">
                    <div className="kpi-card__header">
                        <span className="kpi-card__label">Gastos</span>
                        <div className="kpi-card__icon" style={{ background: '#f0958b' }}><IconExpense /></div>
                    </div>
                    {loadingSummary
                        ? <div className="kpi-skeleton" />
                        : <div className="kpi-card__value kpi-card__value--red">{fmt$(cur.expenses)}</div>
                    }
                    <div className="kpi-card__trend">
                        {loadingSummary ? <div className="kpi-skeleton" style={{ width: 80, height: 16 }} /> : trendPill(cur.expenses, prev.expenses, true)}
                        <span className="kpi-card__sub">vs {prevLabel}</span>
                    </div>
                </div>

                {/* Card 3 — Ganancia Neta */}
                <div className={`kpi-card ${cur.net >= 0 ? 'kpi-card--green' : 'kpi-card--red'}`}>
                    <div className="kpi-card__header">
                        <span className="kpi-card__label">Ganancia Neta</span>
                        <div className="kpi-card__icon" style={{ background: cur.net >= 0 ? '#c0dd97' : '#f0958b' }}><IconNet isLoss={cur.net < 0} /></div>
                    </div>
                    {loadingSummary
                        ? <div className="kpi-skeleton" />
                        : <div className={`kpi-card__value ${cur.net < 0 ? 'kpi-card__value--red' : ''}`}>{fmt$(cur.net)}</div>
                    }
                    <div className="kpi-card__trend">
                        {loadingSummary
                            ? <div className="kpi-skeleton" style={{ width: 80, height: 16 }} />
                            : cur.net < 0
                                ? <span className="trend-pill trend-pill--down">Pérdida este mes</span>
                                : <span className="trend-pill trend-pill--up">Ganancia este mes</span>
                        }
                    </div>
                </div>

                {/* Card 4 — Margen */}
                <div className="kpi-card kpi-card--amber">
                    <div className="kpi-card__header">
                        <span className="kpi-card__label">Margen</span>
                        <div className="kpi-card__icon" style={{ background: '#fac775' }}><IconMargin /></div>
                    </div>
                    {loadingSummary
                        ? <div className="kpi-skeleton" />
                        : <div className={`kpi-card__value ${cur.margin !== null && cur.margin < 0 ? 'kpi-card__value--amber' : ''}`}>
                            {cur.margin === null ? '—' : `${cur.margin}%`}
                        </div>
                    }
                    <div className="kpi-card__trend">
                        {loadingSummary
                            ? <div className="kpi-skeleton" style={{ width: 120, height: 16 }} />
                            : cur.margin === null
                                ? <span className="trend-pill trend-pill--neutral">Sin ingresos registrados</span>
                                : trendPill(cur.margin || 0, prev.margin || 0)
                        }
                    </div>
                </div>
            </div>

            {/* Two-column: P&L + Cash Flow */}
            <div className="dashboard-two-col">
                {/* P&L Card */}
                <div className="dash-card">
                    <div className="dash-card__header">
                        <div className="dash-card__title">
                            <div className="dash-card__title-dot" style={{ background: '#2A6C95' }} />
                            P&L — {monthLabel(period)}
                        </div>
                    </div>

                    {loadingSummary ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[1,2,3,4,5].map(i => <div key={i} className="kpi-skeleton" />)}
                        </div>
                    ) : (
                        <>
                            <p className="pl-section-label pl-section-label--income">Ingresos</p>
                            {plIncome.map((row, i) => (
                                <div key={i} className="pl-row">
                                    <span>{row.name_es}</span>
                                    <span className={row.total > 0 ? 'pl-row__amount--pos' : ''}>{fmt$(row.total)}</span>
                                </div>
                            ))}
                            <div className="pl-total">
                                <span>Total Ingresos</span>
                                <span>{fmt$(totalIncome)}</span>
                            </div>

                            <div style={{ height: 12 }} />

                            <p className="pl-section-label pl-section-label--expense">Gastos</p>
                            {plExpenses.length === 0
                                ? <div className="pl-row"><span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Sin gastos este mes</span><span>$0.00</span></div>
                                : plExpenses.map((row, i) => (
                                    <div key={i} className="pl-row">
                                        <span>{row.name_es}</span>
                                        <span className="pl-row__amount--neg">{fmt$(row.total)}</span>
                                    </div>
                                ))
                            }
                            <div className="pl-total">
                                <span>Total Gastos</span>
                                <span className="pl-row__amount--neg">{fmt$(totalExpenses)}</span>
                            </div>

                            <div className={`pl-net-box ${cur.net < 0 ? 'pl-net-box--loss' : 'pl-net-box--profit'}`}>
                                <span className="pl-net-box__label">Ganancia Neta</span>
                                <span className={`pl-net-box__amount ${cur.net < 0 ? 'pl-row__amount--neg' : 'pl-row__amount--pos'}`}>{fmt$(cur.net)}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Cash Flow Card */}
                <div className="dash-card">
                    <div className="dash-card__header">
                        <div className="dash-card__title">
                            <div className="dash-card__title-dot" style={{ background: '#08543D' }} />
                            Cash Flow {period.split('-')[0]}
                        </div>
                    </div>
                    <div className="cf-legend">
                        <div className="cf-legend-item">
                            <div className="cf-legend-dot" style={{ background: '#639922' }} />
                            <span>Ingresos</span>
                        </div>
                        <div className="cf-legend-item">
                            <div className="cf-legend-dot" style={{ background: '#E24B4A' }} />
                            <span>Gastos</span>
                        </div>
                    </div>
                    <div style={{ position: 'relative', width: '100%', height: '155px' }}>
                        {cashFlowChartData && <Bar data={cashFlowChartData} options={cashFlowOptions} />}
                    </div>
                </div>
            </div>

            {/* Worker Margins */}
            {(wMargins.length > 0 || loadingMargins) && (
                <div className="dash-card" style={{ marginBottom: 16 }}>
                    <div className="dash-card__header">
                        <div className="dash-card__title">
                            <div className="dash-card__title-dot" style={{ background: '#2A6C95' }} />
                            Márgenes por Worker
                        </div>
                    </div>
                    {loadingMargins ? (
                        <div className="kpi-skeleton" style={{ height: 80 }} />
                    ) : (
                        <div className="inv-table-wrapper">
                            <table className="ac-margins-table">
                                <thead><tr><th>Worker</th><th>Código</th><th className="r">Cobrado</th><th className="r">Pagado</th><th className="r">Margen</th><th className="r">%</th></tr></thead>
                                <tbody>
                                    {wMargins.map((w, i) => (
                                        <tr key={i}>
                                            <td>{w.worker_name}</td>
                                            <td><code>{w.worker_code}</code></td>
                                            <td className="r">{fmt$(w.billed)}</td>
                                            <td className="r">{fmt$(w.paid)}</td>
                                            <td className="r" style={{ color: w.margin >= 0 ? '#3B6D11' : '#A32D2D', fontWeight: 600 }}>{fmt$(w.margin)}</td>
                                            <td className="r">
                                                <div className="margin-bar-wrap">
                                                    <div className="margin-bar-bg">
                                                        <div className="margin-bar-fill" style={{ width: `${Math.min(Math.abs(w.margin_pct), 100)}%` }} />
                                                    </div>
                                                    <span className={`margin-badge ${w.margin_pct < 0 ? 'margin-badge--neg' : 'margin-badge--pos'}`}>{w.margin_pct}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Client Margins */}
            {(cMargins.length > 0 || loadingMargins) && (
                <div className="dash-card">
                    <div className="dash-card__header">
                        <div className="dash-card__title">
                            <div className="dash-card__title-dot" style={{ background: '#08543D' }} />
                            Márgenes por Cliente
                        </div>
                    </div>
                    {loadingMargins ? (
                        <div className="kpi-skeleton" style={{ height: 80 }} />
                    ) : (
                        <div className="inv-table-wrapper">
                            <table className="ac-margins-table">
                                <thead><tr><th>Cliente</th><th className="r">Facturado</th><th className="r">Costo</th><th className="r">Margen</th><th className="r">%</th></tr></thead>
                                <tbody>
                                    {cMargins.map((c, i) => (
                                        <tr key={i}>
                                            <td>{c.client_name}</td>
                                            <td className="r">{fmt$(c.billed)}</td>
                                            <td className="r">{fmt$(c.cost)}</td>
                                            <td className="r" style={{ color: c.margin >= 0 ? '#3B6D11' : '#A32D2D', fontWeight: 600 }}>{fmt$(c.margin)}</td>
                                            <td className="r">
                                                <div className="margin-bar-wrap">
                                                    <div className="margin-bar-bg">
                                                        <div className="margin-bar-fill" style={{ width: `${Math.min(Math.abs(c.margin_pct), 100)}%`, background: c.margin_pct >= 0 ? '#639922' : '#E24B4A' }} />
                                                    </div>
                                                    <span className={`margin-badge ${c.margin_pct < 0 ? 'margin-badge--neg' : 'margin-badge--pos'}`}>{c.margin_pct}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 2 — TRANSACTIONS
// ═════════════════════════════════════════════════════════════════════════════
function NewTxModal({ categories, workers, clients, api, showToast, onCreated, onClose, editTx }) {
    const [form, setForm] = useState(editTx ? {
        type: editTx.type,
        date: editTx.date,
        amount: editTx.amount,
        category_id: editTx.category_id || '',
        description: editTx.description,
        worker_id: editTx.worker_id || '',
        client_id: editTx.client_id || '',
        notes: editTx.notes || '',
    } : { type: 'expense', date: new Date().toISOString().split('T')[0], amount: '', category_id: '', description: '', worker_id: '', client_id: '', notes: '' });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!form.date || !form.amount || !form.description) return showToast('Campos requeridos faltantes.', 'error');
        setSaving(true);
        try {
            if (editTx) {
                await api.put(`/accounting/transactions/${editTx.id}`, form);
                showToast('Transacción actualizada.');
                onCreated(null);
            } else {
                const res = await api.post('/accounting/transactions', form);
                onCreated(res.data?.data || res.data || res);
                showToast('Transacción creada.');
            }
            onClose();
        } catch { showToast('Error al guardar.', 'error'); }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="workers-modal__header">
                    <h2>{editTx ? 'Editar Transacción' : 'Nueva Transacción Manual'}</h2>
                    <button className="workers-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="workers-modal__body">
                    <div className="ac-type-toggle">
                        {['income', 'expense'].map(t => (
                            <button key={t} className={`ac-type-btn ${form.type === t ? 'ac-type-btn--active' : ''}`} onClick={() => setForm(f => ({ ...f, type: t }))}>
                                {t === 'income' ? 'Ingreso' : 'Gasto'}
                            </button>
                        ))}
                    </div>
                    <div className="wf-field"><label className="wf-label">Fecha *</label><input className="wf-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                    <div className="wf-field"><label className="wf-label">Monto * ($)</label><input className="wf-input" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                    <div className="wf-field"><label className="wf-label">Categoría</label>
                        <div className="workers-select-wrapper">
                            <select className="wf-select" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                                <option value="">Sin categoría</option>
                                {categories.filter(c => c.type === form.type).map(c => <option key={c.id} value={c.id}>{c.name_es}</option>)}
                            </select>
                            <ChevronDown size={12} className="workers-select__arrow" />
                        </div>
                    </div>
                    <div className="wf-field"><label className="wf-label">Descripción *</label><input className="wf-input" placeholder="Descripción..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="wf-field"><label className="wf-label">Worker (opcional)</label>
                            <div className="workers-select-wrapper">
                                <select className="wf-select" value={form.worker_id} onChange={e => setForm(f => ({ ...f, worker_id: e.target.value }))}>
                                    <option value="">Ninguno</option>
                                    {workers.map(w => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
                                </select>
                                <ChevronDown size={12} className="workers-select__arrow" />
                            </div>
                        </div>
                        <div className="wf-field"><label className="wf-label">Cliente (opcional)</label>
                            <div className="workers-select-wrapper">
                                <select className="wf-select" value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                                    <option value="">Ninguno</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                                </select>
                                <ChevronDown size={12} className="workers-select__arrow" />
                            </div>
                        </div>
                    </div>
                    <div className="wf-field"><label className="wf-label">Notas</label><input className="wf-input" placeholder="Opcional..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                </div>
                <div className="workers-modal__footer">
                    <button className="workers-btn-outline" onClick={onClose}>Cancelar</button>
                    <button className="workers-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : editTx ? 'Actualizar' : 'Guardar'}</button>
                </div>
            </div>
        </div>
    );
}

// ─── TransactionRow ───────────────────────────────────────────────────────────
// ─── TransactionDetailPanel ───────────────────────────────────────────────────
const TransactionDetailPanel = ({ transaction: t, categories, workers, onCategoryChange, onCreateRule, onClose }) => {
    const isExpense = t.type === 'expense';

    const getSuggestedCategories = () => {
        const desc = (t.description || '').toLowerCase();
        const suggestions = [];
        if (desc.includes('payroll') || desc.includes('online transfer to') || desc.includes('zelle')) {
            const cat = categories.find(c => c.name === 'payroll_check' || c.name === 'payroll_zelle');
            if (cat) suggestions.push({ category: cat, reason: 'La descripción contiene un patrón de transferencia de nómina', confidence: 'alta' });
        }
        if (desc.includes('shell') || desc.includes('exxon') || desc.includes('bp') || desc.includes('gas station') || desc.includes('fuel') || desc.includes('chevron')) {
            const cat = categories.find(c => c.name === 'gas');
            if (cat) suggestions.push({ category: cat, reason: 'Coincide con patrones de gasolineras', confidence: 'alta' });
        }
        if (desc.includes('home depot') || desc.includes('lowes') || desc.includes('tool') || desc.includes('hardware')) {
            const cat = categories.find(c => c.name === 'tools');
            if (cat) suggestions.push({ category: cat, reason: 'Coincide con tiendas de herramientas o materiales', confidence: 'media' });
        }
        if (!isExpense) {
            const cat = categories.find(c => c.name === 'client_payments');
            if (cat) suggestions.push({ category: cat, reason: 'Transacción positiva — posible pago de cliente', confidence: 'media' });
        }
        suggestions.push({ category: null, reason: 'Seleccionar manualmente', confidence: null });
        return suggestions;
    };

    const suggestions = getSuggestedCategories();
    const [selectedCategoryId, setSelectedCategoryId] = useState(
        t.category_id ? String(t.category_id) : (suggestions[0]?.category?.id ? String(suggestions[0].category.id) : '')
    );

    const getDetectedWorker = () => {
        if (t.worker) return t.worker;
        const codeMatch = (t.description || '').match(/\b[A-Z]{2}-\d{4}\b/);
        if (codeMatch) return workers.find(w => w.worker_code === codeMatch[0]) || null;
        return workers.find(w =>
            w.last_name && (t.description || '').toLowerCase().includes(w.last_name.toLowerCase())
        ) || null;
    };
    const detectedWorker = getDetectedWorker();

    const getRulePreview = () => (t.description || '').split(' ').slice(0, 4).join(' ');

    const handleSaveCategory = async () => {
        await onCategoryChange(t.id, selectedCategoryId || null);
        onClose();
    };

    const suggestedIds = suggestions.slice(0, -1).map(s => s.category?.id ? String(s.category.id) : null).filter(Boolean);
    const isManual = selectedCategoryId && !suggestedIds.includes(String(selectedCategoryId));

    return (
        <div className="txn-detail-panel">
            <div className="txn-detail-left">
                <div className="txn-detail-section-label">Descripción completa del banco</div>
                <div className="txn-detail-desc-box">{t.description}</div>

                <div className="txn-detail-section-label" style={{ marginTop: 14 }}>Seleccionar categoría</div>
                <div className="txn-cat-options">
                    {suggestions.map((s, i) => (
                        <div
                            key={i}
                            className={`txn-cat-option ${s.category && String(selectedCategoryId) === String(s.category.id) ? 'txn-cat-option--selected' : ''}`}
                            onClick={() => s.category && setSelectedCategoryId(String(s.category.id))}
                        >
                            <div className="txn-cat-option-left">
                                <div className="txn-cat-option-dot" style={{ background: i === 0 ? '#08543D' : i === 1 ? '#2A6C95' : '#888780' }} />
                                <div>
                                    <div className="txn-cat-option-name">{s.category ? s.category.name_es : 'Otra categoría...'}</div>
                                    {s.reason && <div className="txn-cat-option-sub">{s.reason}</div>}
                                </div>
                            </div>
                            {s.category && (
                                <button
                                    className={`txn-cat-select-btn ${String(selectedCategoryId) === String(s.category.id) ? 'txn-cat-select-btn--active' : ''}`}
                                    onClick={e => { e.stopPropagation(); setSelectedCategoryId(String(s.category.id)); }}
                                >
                                    {String(selectedCategoryId) === String(s.category.id) ? 'Seleccionada' : 'Seleccionar'}
                                </button>
                            )}
                            {!s.category && (
                                <select
                                    className="txn-cat-select-inline"
                                    value={isManual ? selectedCategoryId : ''}
                                    onChange={e => setSelectedCategoryId(e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                >
                                    <option value="">Elegir...</option>
                                    {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name_es}</option>)}
                                </select>
                            )}
                        </div>
                    ))}
                </div>

                <div className="txn-detail-actions">
                    <button className="txn-detail-btn txn-detail-btn--primary" onClick={handleSaveCategory}>Guardar categoría</button>
                    <button className="txn-detail-btn txn-detail-btn--warning">Dividir transacción</button>
                    <button className="txn-detail-btn txn-detail-btn--danger">Excluir del P&L</button>
                </div>
            </div>

            <div className="txn-detail-right">
                {suggestions[0]?.category && (
                    <>
                        <div className="txn-detail-section-label">Sugerencia del sistema</div>
                        <div className="txn-suggestion-box">
                            <div className="txn-suggestion-title">
                                {suggestions[0].category.name_es} —{' '}
                                <span style={{ fontWeight: 400, fontSize: 11 }}>confianza {suggestions[0].confidence}</span>
                            </div>
                            <div className="txn-suggestion-text">{suggestions[0].reason}</div>
                        </div>
                    </>
                )}

                <div className="txn-detail-section-label" style={{ marginTop: 12 }}>Worker detectado</div>
                {detectedWorker ? (
                    <div className="txn-worker-box">
                        <div className="txn-worker-name">{detectedWorker.first_name} {detectedWorker.last_name}</div>
                        <div className="txn-worker-code">
                            {detectedWorker.worker_code} · Detectado por {
                                (t.description || '').includes(detectedWorker.worker_code) ? 'código' : 'nombre'
                            }
                        </div>
                    </div>
                ) : (
                    <div className="txn-worker-box" style={{ color: 'var(--text-tertiary, #9CA3AF)', fontSize: 12 }}>
                        Ningún worker detectado en la descripción
                    </div>
                )}

                <div className="txn-detail-section-label" style={{ marginTop: 12 }}>Si creas una regla automática</div>
                <div className="txn-rule-preview">
                    Si la descripción contiene{' '}
                    <strong>"{getRulePreview()}"</strong>{' '}
                    → categorizar como{' '}
                    <strong style={{ color: '#08543D' }}>
                        {categories.find(c => String(c.id) === String(selectedCategoryId))?.name_es || 'categoría seleccionada'}
                    </strong>{' '}
                    en futuras importaciones.
                </div>
            </div>
        </div>
    );
};

// ─── RuleModal ────────────────────────────────────────────────────────────────
const RuleModal = ({ initialData, categories, workers, api, onSave, onClose }) => {
    const [name, setName]                   = useState(initialData?.name || '');
    const [keywords, setKeywords]           = useState(initialData?.keywords || []);
    const [keywordInput, setKeywordInput]   = useState('');
    const [recordType, setRecordType]       = useState(initialData?.record_type || 'any');
    const [categoryId, setCategoryId]       = useState(initialData?.category_id ? String(initialData.category_id) : '');
    const [workerId, setWorkerId]           = useState(initialData?.worker_id   ? String(initialData.worker_id)   : '');
    const [applyExisting, setApplyExisting] = useState(false);
    const [loading, setLoading]             = useState(false);
    const [affectedCount, setAffectedCount] = useState(0);

    useEffect(() => {
        if (keywords.length === 0) { setAffectedCount(0); return; }
        const timeout = setTimeout(async () => {
            try {
                const res = await api.post('/accounting/rules/preview-count', { keywords, record_type: recordType });
                setAffectedCount(res.data?.count || 0);
            } catch { setAffectedCount(0); }
        }, 400);
        return () => clearTimeout(timeout);
    }, [keywords, recordType]);

    const handleAddKeyword = (e) => {
        if ((e.key === 'Enter' || e.key === ',') && keywordInput.trim()) {
            e.preventDefault();
            setKeywords(prev => [...new Set([...prev, keywordInput.trim().toLowerCase()])]);
            setKeywordInput('');
        }
    };

    const handleSave = async (andApply = false) => {
        if (!name.trim() || keywords.length === 0) return;
        setLoading(true);
        try {
            await onSave({
                name: name.trim(),
                keywords,
                record_type: recordType,
                category_id: categoryId || null,
                worker_id:   workerId   || null,
                apply_to_existing: andApply,
            });
            onClose();
        } finally { setLoading(false); }
    };

    return ReactDOM.createPortal(
        <div className="modal-overlay" style={{ zIndex: 500 }}>
            <div className="rule-modal" style={{ zIndex: 501 }} onClick={e => e.stopPropagation()}>
                <div className="rule-modal__header">
                    <span className="rule-modal__title">{initialData?.id ? 'Editar Regla' : 'Nueva Regla Automática'}</span>
                    <button className="rule-modal__close" onClick={onClose}>×</button>
                </div>

                <div className="rule-field">
                    <label className="rule-field__label">Nombre de la regla</label>
                    <input className="rule-field__input" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Nómina semanal — Josue" />
                </div>

                <div className="rule-field">
                    <label className="rule-field__label">
                        Palabras clave
                        <span className="rule-field__hint"> — si la descripción contiene...</span>
                    </label>
                    <div className="rule-keywords-box">
                        {keywords.map(kw => (
                            <span key={kw} className="rule-keyword-tag">
                                {kw}
                                <button onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}>×</button>
                            </span>
                        ))}
                        <input
                            className="rule-keywords-input"
                            value={keywordInput}
                            onChange={e => setKeywordInput(e.target.value)}
                            onKeyDown={handleAddKeyword}
                            placeholder="Escribe y presiona Enter"
                        />
                    </div>
                    <div className="rule-field__hint-text">La regla aplica si la descripción contiene CUALQUIERA de las palabras clave</div>
                </div>

                <div className="rule-field">
                    <label className="rule-field__label">Tipo de transacción</label>
                    <div className="rule-type-toggle">
                        {[{ value: 'any', label: 'Cualquiera' }, { value: 'expense', label: 'Solo gastos' }, { value: 'income', label: 'Solo ingresos' }].map(t => (
                            <div
                                key={t.value}
                                className={`rule-type-btn ${recordType === t.value ? `rule-type-btn--${t.value}` : ''}`}
                                onClick={() => setRecordType(t.value)}
                            >
                                {t.label}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rule-divider-label">Acciones a aplicar</div>

                <div className="rule-row-two">
                    <div className="rule-field">
                        <label className="rule-field__label">Categoría</label>
                        <select className="rule-field__select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                            <option value="">Sin asignar</option>
                            {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name_es}</option>)}
                        </select>
                    </div>
                    <div className="rule-field">
                        <label className="rule-field__label">Worker <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(opcional)</span></label>
                        <select className="rule-field__select" value={workerId} onChange={e => setWorkerId(e.target.value)}>
                            <option value="">Ninguno</option>
                            {workers.map(w => <option key={w.id} value={String(w.id)}>{w.first_name} {w.last_name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="rule-divider-label">Aplicar a transacciones existentes</div>

                <div className="rule-toggle-row">
                    <div>
                        <div className="rule-toggle-title">Recategorizar transacciones pasadas</div>
                        <div className="rule-toggle-sub">Aplica esta regla a todas las transacciones ya importadas que coincidan</div>
                    </div>
                    <div className={`rule-toggle-switch ${applyExisting ? 'rule-toggle-switch--on' : ''}`} onClick={() => setApplyExisting(v => !v)} />
                </div>

                {applyExisting && affectedCount > 0 && (
                    <div className="rule-affected-preview">
                        <strong>{affectedCount} transacciones existentes</strong> coinciden y serán recategorizadas
                        {categoryId && ` como "${categories.find(c => String(c.id) === String(categoryId))?.name_es || ''}"`}
                    </div>
                )}

                <div className="rule-modal__footer">
                    <button className="txn-detail-btn txn-detail-btn--secondary" onClick={onClose}>Cancelar</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="txn-detail-btn txn-detail-btn--primary" onClick={() => handleSave(false)} disabled={loading || !name || !keywords.length}>
                            Guardar regla
                        </button>
                        <button
                            className="txn-detail-btn"
                            style={{ background: '#08543D', color: '#fff', borderColor: '#08543D' }}
                            onClick={() => handleSave(true)}
                            disabled={loading || !name || !keywords.length}
                        >
                            Guardar y aplicar ahora
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// ─── TransactionRow ───────────────────────────────────────────────────────────
const TransactionRow = ({ transaction: t, categories, workers, onCategoryChange, onEdit, onDelete, onRowClick, onCreateRule, isExpanded, uncategorized }) => {
    const isExpense = t.type === 'expense';
    const displayName = t.worker
        ? `${t.worker.first_name} ${t.worker.last_name}`
        : t.client?.company_name || '—';
    const sourceLabel = t.is_imported ? 'Importado' : 'Manual';

    return (
        <Fragment>
            <tr
                className={`txn-row ${uncategorized ? 'txn-row--uncategorized' : ''} ${isExpanded ? 'txn-row--expanded-trigger' : ''}`}
                onClick={() => onRowClick(t.id)}
                style={{ cursor: 'pointer' }}
            >
                <td className="txn-date">
                    {t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: '2-digit', day: '2-digit', year: 'numeric',
                    }) : '—'}
                </td>
                <td>
                    <div className="txn-desc-text">{t.description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span className={`txn-source ${t.is_imported ? 'txn-source--csv' : 'txn-source--manual'}`}>{sourceLabel}</span>
                        <span className={`txn-expand-arrow ${isExpanded ? 'txn-expand-arrow--open' : ''}`}>
                            {isExpanded ? '▲ cerrar' : '▼ ver detalle'}
                        </span>
                    </div>
                </td>
                <td onClick={e => e.stopPropagation()}>
                    <select
                        className={`txn-cat-select ${uncategorized ? 'txn-cat-select--uncat' : ''}`}
                        value={t.category_id || ''}
                        onChange={e => onCategoryChange(t.id, e.target.value || null)}
                    >
                        <option value="">Sin categoría</option>
                        {categories.filter(c => c.type === t.type).map(c => (
                            <option key={c.id} value={c.id}>{c.name_es}</option>
                        ))}
                    </select>
                </td>
                <td>
                    {displayName !== '—'
                        ? <span className="txn-entity-chip">{displayName}</span>
                        : <span className="txn-empty">—</span>
                    }
                </td>
                <td className={`txn-amount ${isExpense ? 'txn-amount--expense' : 'txn-amount--income'}`}>
                    {isExpense ? '-' : '+'}${parseFloat(t.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td onClick={e => e.stopPropagation()}>
                    <div className="txn-actions">
                        <button className="txn-action-btn" onClick={() => onEdit(t)} title="Editar">
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                                <path d="M2 12L3.5 8.5L10 2L12 4L5.5 10.5L2 12Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        <button className="txn-action-btn txn-action-btn--delete" onClick={() => onDelete(t.id)} title="Eliminar">
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                                <path d="M2 4H12M5 4V2.5H9V4M5.5 6.5V10M8.5 6.5V10M3.5 4L4.5 12H9.5L10.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr className="txn-detail-panel-row">
                    <td colSpan={6} style={{ padding: 0 }}>
                        <TransactionDetailPanel
                            transaction={t}
                            categories={categories}
                            workers={workers}
                            onCategoryChange={onCategoryChange}
                            onCreateRule={onCreateRule}
                            onClose={() => onRowClick(t.id)}
                        />
                    </td>
                </tr>
            )}
        </Fragment>
    );
};

// ─── TabTransactions ──────────────────────────────────────────────────────────
function TabTransactions({ api, categories, workers, clients, showToast, onUncatCountChange, openRuleFromHeader, onRuleModalOpened }) {
    // ── Transaction list state ──
    const [txs, setTxs]                 = useState([]);
    const [loading, setLoading]         = useState(false);
    const [searchTerm, setSearchTerm]   = useState('');
    const [typeFilter, setTypeFilter]   = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [editingTx, setEditingTx]     = useState(null);
    const [expandedTransactionId, setExpandedTransactionId] = useState(null);

    // ── View toggle & rules state ──
    const [transactionView, setTransactionView] = useState('list'); // 'list' | 'rules'
    const [rules, setRules]             = useState([]);
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);

    // ── Data fetching ──
    const fetchTxs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (typeFilter) params.set('type', typeFilter);
            if (categoryFilter === 'uncategorized') params.set('uncategorized', 'true');
            else if (categoryFilter) params.set('category_id', categoryFilter);
            const res = await api.get(`/accounting/transactions?${params}`);
            const data = res.data?.data || res.data || [];
            setTxs(data);
            const unc = data.filter(t => !t.category_id && !t.parent_transaction_id).length;
            if (onUncatCountChange) onUncatCountChange(unc);
        } catch { showToast('Error al cargar transacciones.', 'error'); }
        finally { setLoading(false); }
    }, [api, typeFilter, categoryFilter]);

    const fetchRules = useCallback(async () => {
        try {
            const res = await api.get('/accounting/rules');
            setRules(res.data?.data || []);
        } catch { /* silent */ }
    }, [api]);

    useEffect(() => { fetchTxs(); }, [fetchTxs]);
    useEffect(() => { fetchRules(); }, [fetchRules]);
    useEffect(() => {
        if (openRuleFromHeader) {
            setEditingRule(null);
            setShowRuleModal(true);
            setTransactionView('rules');
            if (onRuleModalOpened) onRuleModalOpened();
        }
    }, [openRuleFromHeader]);

    // ── Transaction handlers ──
    const handleCategoryChange = async (transactionId, categoryId) => {
        try {
            await api.put(`/accounting/transactions/${transactionId}`, { category_id: categoryId || null });
            await fetchTxs();
        } catch { showToast('Error al actualizar categoría.', 'error'); }
    };

    const handleDeleteTransaction = async (transactionId) => {
        if (!window.confirm('¿Eliminar esta transacción? Esta acción no se puede deshacer.')) return;
        try {
            await api.delete(`/accounting/transactions/${transactionId}`);
            if (expandedTransactionId === transactionId) setExpandedTransactionId(null);
            await fetchTxs();
        } catch { showToast('Error al eliminar.', 'error'); }
    };

    const handleRowClick = (transactionId) => {
        setExpandedTransactionId(prev => prev === transactionId ? null : transactionId);
    };

    // ── Rule handlers ──
    const handleCreateRule = (prefill) => {
        setEditingRule({
            keywords:    prefill.keyword ? [prefill.keyword] : [],
            record_type: prefill.type || 'any',
            category_id: prefill.category_id || '',
            worker_id:   prefill.worker_id   || '',
        });
        setShowRuleModal(true);
    };

    const handleSaveRule = async (data) => {
        if (editingRule?.id) {
            await api.put(`/accounting/rules/${editingRule.id}`, data);
        } else {
            await api.post('/accounting/rules', data);
        }
        await fetchRules();
        await fetchTxs();
    };

    const handleApplyRule = async (ruleId) => {
        try {
            const res = await api.post(`/accounting/rules/${ruleId}/apply`);
            showToast(`Regla aplicada a ${res.data.applied_count} transacciones.`);
            await fetchTxs();
            await fetchRules();
        } catch { showToast('Error al aplicar regla.', 'error'); }
    };

    const handleDeleteRule = async (ruleId) => {
        if (!window.confirm('¿Eliminar esta regla? Las transacciones ya categorizadas no se verán afectadas.')) return;
        try {
            await api.delete(`/accounting/rules/${ruleId}`);
            await fetchRules();
        } catch { showToast('Error al eliminar regla.', 'error'); }
    };

    // ── Derived data ──
    const filteredTransactions = useMemo(() => {
        const base = txs.filter(t => !t.parent_transaction_id);
        if (!searchTerm) return base;
        const q = searchTerm.toLowerCase();
        return base.filter(t =>
            t.description?.toLowerCase().includes(q) ||
            t.worker?.first_name?.toLowerCase().includes(q) ||
            t.worker?.last_name?.toLowerCase().includes(q) ||
            t.client?.company_name?.toLowerCase().includes(q) ||
            t.category?.name_es?.toLowerCase().includes(q)
        );
    }, [txs, searchTerm]);

    const uncategorizedCount = txs.filter(t => !t.category_id && !t.parent_transaction_id).length;
    const uncategorized = filteredTransactions.filter(t => !t.category_id);
    const categorized   = filteredTransactions.filter(t => !!t.category_id);

    return (
        <div className="ac-tab-content">

            {/* ── View toggle ── */}
            <div className="txn-view-toggle">
                <button
                    className={`txn-view-btn ${transactionView === 'list' ? 'txn-view-btn--active' : ''}`}
                    onClick={() => setTransactionView('list')}
                >
                    Transacciones
                    {uncategorizedCount > 0 && <span className="tab-badge">{uncategorizedCount}</span>}
                </button>
                <button
                    className={`txn-view-btn ${transactionView === 'rules' ? 'txn-view-btn--active' : ''}`}
                    onClick={() => setTransactionView('rules')}
                >
                    Reglas automáticas
                    {rules.length > 0 && (
                        <span className="tab-badge" style={{ background: '#f0f9f4', color: '#08543D' }}>{rules.length}</span>
                    )}
                </button>
            </div>

            {/* ══════════════ RULES VIEW ══════════════ */}
            {transactionView === 'rules' && (
                <div>
                    <div className="rules-list-header">
                        <span className="rules-list-title">
                            Reglas automáticas
                            <span className="rules-list-sub">Se aplican al importar CSV y pueden aplicarse manualmente</span>
                        </span>
                        <button className="btn-primary" onClick={() => { setEditingRule(null); setShowRuleModal(true); }}>
                            + Nueva Regla
                        </button>
                    </div>

                    {rules.length === 0 ? (
                        <div className="rules-empty">
                            No hay reglas configuradas. Crea una regla desde el panel de detalle de una transacción o con el botón de arriba.
                        </div>
                    ) : (
                        rules.map(rule => (
                            <div key={rule.id} className="rule-card">
                                <div className="rule-card__left">
                                    <div className="rule-card__name">{rule.name}</div>
                                    <div className="rule-card__pills">
                                        {rule.keywords.map(kw => (
                                            <span key={kw} className="rule-pill rule-pill--keyword">{kw}</span>
                                        ))}
                                        <span className="rule-pill rule-pill--arrow">→</span>
                                        {rule.category && <span className="rule-pill rule-pill--cat">{rule.category.name_es}</span>}
                                        {rule.worker && (
                                            <span className="rule-pill rule-pill--worker">{rule.worker.first_name} {rule.worker.last_name}</span>
                                        )}
                                        <span className={`rule-pill rule-pill--type rule-pill--type-${rule.record_type}`}>
                                            {rule.record_type === 'any' ? 'Cualquiera' : rule.record_type === 'expense' ? 'Gasto' : 'Ingreso'}
                                        </span>
                                    </div>
                                    <div className="rule-card__stats">
                                        Aplicada {rule.times_applied || 0} veces
                                        {rule.last_applied_at && ` · Última vez: ${new Date(rule.last_applied_at).toLocaleDateString('es-US')}`}
                                    </div>
                                </div>
                                <div className="rule-card__actions">
                                    <button className="rule-act-btn" onClick={() => { setEditingRule(rule); setShowRuleModal(true); }}>Editar</button>
                                    <button className="rule-act-btn" onClick={() => handleApplyRule(rule.id)}>Aplicar ahora</button>
                                    <button className="rule-act-btn rule-act-btn--del" onClick={() => handleDeleteRule(rule.id)}>Eliminar</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ══════════════ LIST VIEW ══════════════ */}
            {transactionView === 'list' && (
                <>
                    {/* Filter bar */}
                    <div className="txn-filter-bar">
                        <div className="txn-search-wrap">
                            <svg className="txn-search-icon" width="13" height="13" viewBox="0 0 14 14" fill="none">
                                <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
                                <line x1="9.5" y1="9.5" x2="12" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <input
                                type="text"
                                className="txn-search-input"
                                placeholder="Buscar por descripción, worker, cliente..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select className="txn-filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                            <option value="">Todos los tipos</option>
                            <option value="income">Ingresos</option>
                            <option value="expense">Gastos</option>
                        </select>
                        <select className="txn-filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                            <option value="">Todas las categorías</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name_es}</option>)}
                            <option value="uncategorized">Sin categoría</option>
                        </select>
                        {uncategorizedCount > 0 && (
                            <div className="txn-uncategorized-pill" onClick={() => setCategoryFilter('uncategorized')}>
                                {uncategorizedCount} sin categorizar
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="workers-empty"><RefreshCw size={28} /><p>Cargando...</p></div>
                    ) : (
                        <>
                            <div className="inv-table-wrapper">
                                <table className="txn-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 100 }}>Fecha</th>
                                            <th>Descripción</th>
                                            <th style={{ width: 170 }}>Categoría</th>
                                            <th style={{ width: 150 }}>Worker / Cliente</th>
                                            <th className="right" style={{ width: 110 }}>Monto</th>
                                            <th className="right" style={{ width: 80 }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredTransactions.length === 0 && (
                                            <tr><td colSpan={6} className="txn-empty">Sin transacciones</td></tr>
                                        )}
                                        {uncategorized.length > 0 && (
                                            <>
                                                <tr>
                                                    <td colSpan={6} className="txn-section-label">
                                                        Sin categorizar <span className="txn-section-count">{uncategorized.length}</span>
                                                    </td>
                                                </tr>
                                                {uncategorized.map(t => (
                                                    <TransactionRow
                                                        key={t.id}
                                                        transaction={t}
                                                        categories={categories}
                                                        workers={workers}
                                                        onCategoryChange={handleCategoryChange}
                                                        onEdit={setEditingTx}
                                                        onDelete={handleDeleteTransaction}
                                                        onRowClick={handleRowClick}
                                                        onCreateRule={handleCreateRule}
                                                        isExpanded={expandedTransactionId === t.id}
                                                        uncategorized
                                                    />
                                                ))}
                                            </>
                                        )}
                                        {categorized.length > 0 && (
                                            <>
                                                <tr>
                                                    <td colSpan={6} className="txn-section-label">Categorizadas</td>
                                                </tr>
                                                {categorized.map(t => (
                                                    <TransactionRow
                                                        key={t.id}
                                                        transaction={t}
                                                        categories={categories}
                                                        workers={workers}
                                                        onCategoryChange={handleCategoryChange}
                                                        onEdit={setEditingTx}
                                                        onDelete={handleDeleteTransaction}
                                                        onRowClick={handleRowClick}
                                                        onCreateRule={handleCreateRule}
                                                        isExpanded={expandedTransactionId === t.id}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="txn-pagination">
                                <span>Mostrando {filteredTransactions.length} de {txs.filter(t => !t.parent_transaction_id).length} transacciones</span>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Edit modal */}
            {editingTx && ReactDOM.createPortal(
                <NewTxModal
                    categories={categories}
                    workers={workers}
                    clients={clients}
                    api={api}
                    showToast={showToast}
                    onCreated={() => fetchTxs()}
                    onClose={() => setEditingTx(null)}
                    editTx={editingTx}
                />,
                document.body
            )}

            {/* Rule modal */}
            {showRuleModal && (
                <RuleModal
                    initialData={editingRule}
                    categories={categories}
                    workers={workers}
                    api={api}
                    onSave={handleSaveRule}
                    onClose={() => { setShowRuleModal(false); setEditingRule(null); }}
                />
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 3 — CSV IMPORT
// ═════════════════════════════════════════════════════════════════════════════

// ─── Import Step Bar ─────────────────────────────────────────────────────────
const IMPORT_STEPS = [
    { n: 1, label: 'Subir archivo' },
    { n: 2, label: 'Vista previa' },
    { n: 3, label: 'Confirmar' },
];

const ImportStepBar = ({ currentStep }) => (
    <div className="import-steps">
        {IMPORT_STEPS.map((s, i) => (
            <Fragment key={s.n}>
                <div className="import-step">
                    <div className={`import-step__circle ${currentStep > s.n ? 'done' : currentStep === s.n ? 'active' : 'pending'}`}>
                        {currentStep > s.n
                            ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                            : s.n
                        }
                    </div>
                    <span className={`import-step__label ${currentStep > s.n ? 'done' : currentStep === s.n ? 'active' : 'pending'}`}>{s.label}</span>
                </div>
                {i < 2 && <div className={`import-step__connector ${currentStep > s.n + 1 ? 'done' : ''}`} />}
            </Fragment>
        ))}
    </div>
);

// ─── Import History Tab ───────────────────────────────────────────────────────
const ImportHistoryTab = ({ history, loading, expandedBatchId, onToggle, onUndo, onRefresh }) => {
    const getBankLabel = (source) => {
        const labels = { wells_fargo: 'Wells Fargo', bank_of_america: 'Bank of America' };
        return labels[source] || source || 'Banco desconocido';
    };
    const getBankAbbr = (source) => {
        const abbrs = { wells_fargo: 'WF', bank_of_america: 'BoA' };
        return abbrs[source] || '?';
    };
    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
            + ' · ' + d.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <div className="history-loading">
                <div className="history-skeleton" />
                <div className="history-skeleton" />
                <div className="history-skeleton" />
            </div>
        );
    }

    if (history.length === 0) {
        return (
            <div className="history-empty">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.25, marginBottom: 10 }}>
                    <rect x="6" y="4" width="28" height="32" rx="4" stroke="currentColor" strokeWidth="1.5"/>
                    <line x1="12" y1="14" x2="28" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="12" y1="20" x2="28" y2="20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="12" y1="26" x2="20" y2="26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <div>No hay importaciones registradas aún</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Las importaciones aparecerán aquí después de subir tu primer CSV</div>
            </div>
        );
    }

    return (
        <div className="history-tab">
            <div className="history-header">
                <div>
                    <div className="history-title">Historial de importaciones</div>
                    <div className="history-sub">Todas las importaciones de CSV. Puedes deshacer cualquiera si detectas un error.</div>
                </div>
                <button className="history-refresh-btn" onClick={onRefresh} title="Actualizar">
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7C2 4.2 4.2 2 7 2C8.7 2 10.2 2.8 11.1 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        <path d="M12 7C12 9.8 9.8 12 7 12C5.3 12 3.8 11.2 2.9 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                        <polyline points="11,1 11,4 8,4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>
            </div>

            {history.map((batch) => {
                const isExpanded = expandedBatchId === batch.batch_id;
                const isUndone = batch.is_undone;
                return (
                    <div key={batch.batch_id} className={`import-history-card ${isUndone ? 'import-history-card--undone' : ''}`}>
                        <div
                            className={`import-history-header ${isExpanded ? 'import-history-header--expanded' : ''}`}
                            onClick={() => !isUndone && onToggle(batch.batch_id)}
                            style={{ cursor: isUndone ? 'default' : 'pointer' }}
                        >
                            <div className={`import-history-icon ${isUndone ? 'import-history-icon--undone' : ''}`}>
                                {isUndone ? (
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
                                        <line x1="5" y1="5" x2="11" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                                        <line x1="11" y1="5" x2="5" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                                        <line x1="4.5" y1="5.5" x2="11.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                        <line x1="4.5" y1="8" x2="11.5" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                        <line x1="4.5" y1="10.5" x2="8" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                                    </svg>
                                )}
                            </div>

                            <div className="import-history-info">
                                <div className="import-history-filename">
                                    <span className={`import-bank-abbr import-bank-abbr--${batch.import_source}`}>
                                        {getBankAbbr(batch.import_source)}
                                    </span>
                                    {batch.original_filename || batch.batch_id}
                                    {isUndone && <span className="import-undone-badge">Deshecha</span>}
                                </div>
                                <div className="import-history-meta">
                                    <span>{formatDate(batch.created_at)}</span>
                                    <span>{getBankLabel(batch.import_source)}</span>
                                    <span>Lote: {batch.batch_id}</span>
                                </div>
                            </div>

                            <div className="import-history-stats">
                                {isUndone ? (
                                    <span className="import-stat-pill import-stat-pill--undone">{batch.total_count} eliminadas</span>
                                ) : (
                                    <>
                                        <span className="import-stat-pill import-stat-pill--imported">{batch.active_count} importadas</span>
                                        {batch.total_count - batch.active_count > 0 && (
                                            <span className="import-stat-pill import-stat-pill--skipped">{batch.total_count - batch.active_count} duplicadas</span>
                                        )}
                                    </>
                                )}
                            </div>

                            {!isUndone && (
                                <div className={`import-history-chevron ${isExpanded ? 'import-history-chevron--open' : ''}`}>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                            )}
                        </div>

                        {isExpanded && !isUndone && (
                            <div className="import-history-detail">
                                <div className="import-detail-grid">
                                    <div className="import-detail-stat">
                                        <div className="import-detail-val">{batch.active_count}</div>
                                        <div className="import-detail-label">Transacciones importadas</div>
                                    </div>
                                    <div className="import-detail-stat">
                                        <div className="import-detail-val">{batch.total_count - batch.active_count}</div>
                                        <div className="import-detail-label">Duplicadas omitidas</div>
                                    </div>
                                    <div className="import-detail-stat">
                                        <div className="import-detail-val import-detail-val--neg">
                                            -${batch.total_expenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <div className="import-detail-label">Total gastos</div>
                                    </div>
                                    <div className="import-detail-stat">
                                        <div className="import-detail-val import-detail-val--pos">
                                            +${batch.total_income.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                        <div className="import-detail-label">Total ingresos</div>
                                    </div>
                                </div>

                                <div className="import-detail-txns">
                                    <div className="import-detail-txns-label">Transacciones de esta importación</div>
                                    <table className="import-txn-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: 90 }}>Fecha</th>
                                                <th>Descripción</th>
                                                <th style={{ width: 150 }}>Categoría</th>
                                                <th style={{ width: 100, textAlign: 'right' }}>Monto</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batch.transactions.slice(0, 5).map(t => {
                                                const isNeg = t.type === 'expense';
                                                return (
                                                    <tr key={t.id}>
                                                        <td className="import-txn-date">
                                                            {new Date(t.transaction_date + 'T00:00:00').toLocaleDateString('es-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                                                        </td>
                                                        <td className="import-txn-desc">
                                                            {t.description?.length > 60 ? t.description.substring(0, 60) + '...' : t.description}
                                                        </td>
                                                        <td>
                                                            {t.category
                                                                ? <span className="import-cat-chip import-cat-chip--set">{t.category.name_es}</span>
                                                                : <span className="import-cat-chip import-cat-chip--none">Sin categoría</span>
                                                            }
                                                        </td>
                                                        <td className={`import-txn-amount ${isNeg ? 'import-txn-amount--neg' : 'import-txn-amount--pos'}`}>
                                                            {isNeg ? '-' : '+'}${Math.abs(parseFloat(t.amount)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {batch.transactions.length > 5 && (
                                                <tr>
                                                    <td colSpan={4} className="import-txn-more">
                                                        + {batch.transactions.length - 5} transacciones más en esta importación
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="import-detail-footer">
                                    <button
                                        className="import-undo-btn"
                                        onClick={() => {
                                            if (window.confirm(
                                                `¿Deshacer la importación "${batch.batch_id}"?\n\nEsto eliminará ${batch.active_count} transacciones. Las categorizaciones y reglas aplicadas NO se revertirán.`
                                            )) {
                                                onUndo(batch.batch_id);
                                            }
                                        }}
                                    >
                                        Deshacer esta importación — eliminar las {batch.active_count} transacciones
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

function TabImport({ api, categories, showToast }) {
    const [importStep, setImportStep] = useState(1);
    const [bankType, setBankType] = useState('wells_fargo');
    const [csvFile, setCsvFile] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [lastBatchId, setLastBatchId] = useState(null);
    const [importLoading, setImportLoading] = useState(false);
    const [csvSubTab, setCsvSubTab] = useState('upload');
    const [importHistory, setImportHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [expandedBatchId, setExpandedBatchId] = useState(null);

    const fetchImportHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await api.get('/accounting/import/history');
            setImportHistory(res.data.data || []);
        } catch (err) {
            console.error('Error fetching import history:', err);
        } finally {
            setHistoryLoading(false);
        }
    }, [api]);

    useEffect(() => { fetchImportHistory(); }, [fetchImportHistory]);

    const handleAnalyzeCSV = async () => {
        if (!csvFile) return;
        setImportLoading(true);
        try {
            const text = await csvFile.text();
            const res = await api.post('/accounting/import/preview', { csv_content: text, bank_type: bankType });
            setPreviewData(res.data?.data || res.data);
            setImportStep(2);
        } catch (err) {
            showToast('Error al analizar el CSV.', 'error');
            console.error(err);
        } finally { setImportLoading(false); }
    };

    const handleConfirmImport = async () => {
        if (!previewData) return;
        setImportLoading(true);
        try {
            const res = await api.post('/accounting/import/confirm', { rows: previewData.rows, bank_type: bankType, original_filename: csvFile?.name || null });
            const data = res.data?.data || res.data;
            setLastBatchId(data?.batch_id || null);
            setImportStep(3);
        } catch (err) {
            showToast('Error al importar.', 'error');
            console.error(err);
        } finally { setImportLoading(false); }
    };

    const handleUndoImport = async (batchId) => {
        const targetBatchId = batchId || lastBatchId;
        if (!targetBatchId) return;
        try {
            await api.delete(`/accounting/import/${targetBatchId}`);
            showToast('Importación deshecha correctamente.');
            await fetchImportHistory();
            if (targetBatchId === lastBatchId) {
                setLastBatchId(null);
                setImportStep(1);
                setCsvFile(null);
                setPreviewData(null);
            }
        } catch (err) {
            showToast('Error al deshacer.', 'error');
            console.error(err);
        }
    };

    const resetFlow = () => { setImportStep(1); setCsvFile(null); setPreviewData(null); setLastBatchId(null); };

    return (
        <div className="ac-tab-content">
            {/* Sub-tabs */}
            <div className="csv-subtabs">
                <button
                    className={`csv-subtab ${csvSubTab === 'upload' ? 'csv-subtab--active' : ''}`}
                    onClick={() => setCsvSubTab('upload')}
                >
                    Subir archivo
                </button>
                <button
                    className={`csv-subtab ${csvSubTab === 'history' ? 'csv-subtab--active' : ''}`}
                    onClick={() => { setCsvSubTab('history'); fetchImportHistory(); }}
                >
                    Historial
                    {importHistory.length > 0 && (
                        <span className="csv-subtab-badge">{importHistory.length}</span>
                    )}
                </button>
            </div>

            {/* Upload flow */}
            {csvSubTab === 'upload' && (
            <div>
            <ImportStepBar currentStep={importStep} />

            {/* ── STEP 1 ── */}
            {importStep === 1 && (
                <div className="import-card">
                    <div className="import-card__title">Banco de origen</div>
                    <div className="import-card__sub">Selecciona el banco del CSV que vas a importar</div>

                    <div className="bank-options">
                        {[
                            { id: 'wells_fargo',     label: 'Wells Fargo',     abbr: 'WF',  format: '5 col, sin encabezados', available: true },
                            { id: 'bank_of_america', label: 'Bank of America', abbr: 'BoA', format: '4 col, con encabezados', available: true },
                            { id: 'chase',           label: 'Chase',           abbr: 'CH',  format: 'Próximamente',           available: false },
                        ].map(bank => (
                            <div
                                key={bank.id}
                                className={`bank-card ${bankType === bank.id ? 'bank-card--selected' : ''} ${!bank.available ? 'bank-card--disabled' : ''}`}
                                onClick={() => bank.available && setBankType(bank.id)}
                            >
                                <div className={`bank-card__icon bank-card__icon--${bank.id}`}>{bank.abbr}</div>
                                <div>
                                    <div className="bank-card__name">{bank.label}</div>
                                    <div className="bank-card__format">{bank.format}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="import-format-info">
                        {bankType === 'wells_fargo' && (
                            <span><strong>Formato Wells Fargo:</strong> 5 columnas sin encabezados · Fecha, Monto, *, (vacío), Descripción · El sistema detecta códigos de worker automáticamente</span>
                        )}
                        {bankType === 'bank_of_america' && (
                            <span><strong>Formato Bank of America:</strong> 4 columnas con encabezado · Date, Description, Amount, Running Bal.</span>
                        )}
                    </div>

                    <div
                        className={`import-dropzone ${csvFile ? 'import-dropzone--loaded' : ''}`}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.csv')) setCsvFile(f); }}
                        onClick={() => document.getElementById('csv-file-input').click()}
                    >
                        <input id="csv-file-input" type="file" accept=".csv" style={{ display: 'none' }} onChange={e => setCsvFile(e.target.files[0])} />
                        {csvFile ? (
                            <div className="import-dropzone__loaded">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <circle cx="10" cy="10" r="9" stroke="#08543D" strokeWidth="1.5"/>
                                    <path d="M6 10L9 13L14 7" stroke="#08543D" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                                <span>{csvFile.name}</span>
                                <button onClick={e => { e.stopPropagation(); setCsvFile(null); }}>×</button>
                            </div>
                        ) : (
                            <>
                                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.3, marginBottom: 8 }}>
                                    <rect x="4" y="6" width="24" height="22" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                                    <path d="M16 12V22M12 16L16 12L20 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                <div className="import-dropzone__text">Arrastra tu CSV aquí o <strong>haz clic para seleccionar</strong></div>
                                <div className="import-dropzone__sub">Solo archivos .csv · Máximo 5MB</div>
                            </>
                        )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn-primary" disabled={!csvFile || importLoading} onClick={handleAnalyzeCSV}>
                            {importLoading ? 'Analizando...' : 'Analizar CSV →'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP 2 ── */}
            {importStep === 2 && previewData && (
                <div className="import-card">
                    <div className="import-preview-header">
                        <div>
                            <div className="import-card__title">Vista previa — {csvFile?.name}</div>
                            <div className="import-card__sub">Revisa antes de importar. Las categorías sugeridas se pueden cambiar.</div>
                        </div>
                        <div className="import-preview-stats">
                            <span className="stat-chip stat-chip--blue">{previewData.new_count} nuevas</span>
                            {previewData.duplicate_count > 0 && (
                                <span className="stat-chip stat-chip--red">{previewData.duplicate_count} duplicadas</span>
                            )}
                        </div>
                    </div>

                    <div className="inv-table-wrapper">
                        <table className="txn-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 90 }}>Fecha</th>
                                    <th>Descripción</th>
                                    <th style={{ width: 160 }}>Categoría sugerida</th>
                                    <th style={{ width: 140 }}>Worker detectado</th>
                                    <th className="right" style={{ width: 110 }}>Monto</th>
                                    <th className="right" style={{ width: 90 }}>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewData.rows.map((row, i) => (
                                    <tr key={i} className={`txn-row ${row.is_duplicate ? 'txn-row--duplicate' : ''}`}>
                                        <td className="txn-date">{row.date}</td>
                                        <td><div className="txn-desc">{row.description}</div></td>
                                        <td>
                                            {row.is_duplicate
                                                ? <span className="import-badge import-badge--dup">Ya existe</span>
                                                : row.suggested_category
                                                    ? <span className="import-badge import-badge--ok">
                                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 5L4 8L9 2" stroke="#08543D" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                                        {row.suggested_category.name_es}
                                                      </span>
                                                    : <span className="import-badge import-badge--none">Sin sugerencia</span>
                                            }
                                        </td>
                                        <td>
                                            {row.detected_worker
                                                ? <span className="txn-entity-chip">{row.detected_worker.worker_code} · {row.detected_worker.first_name}</span>
                                                : <span className="txn-empty">—</span>
                                            }
                                        </td>
                                        <td className={`txn-amount ${row.type === 'expense' ? 'txn-amount--neg' : 'txn-amount--pos'}`}>
                                            {row.type === 'expense' ? '-' : '+'}${parseFloat(row.amount).toFixed(2)}
                                        </td>
                                        <td className="right">
                                            <span className={`import-status ${row.is_duplicate ? 'import-status--dup' : 'import-status--new'}`}>
                                                {row.is_duplicate ? 'Duplicada' : 'Nueva'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                        <button className="btn-secondary" onClick={() => setImportStep(1)}>← Volver</button>
                        <button className="btn-primary" onClick={handleConfirmImport} disabled={importLoading || previewData.new_count === 0}>
                            {importLoading ? 'Importando...' : `Confirmar e importar ${previewData.new_count} transacciones →`}
                        </button>
                    </div>
                </div>
            )}

            {/* ── STEP 3 ── */}
            {importStep === 3 && (
                <div>
                    <div className="import-success-banner">
                        <div className="import-success-banner__check">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M2 7L5.5 10.5L12 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                        </div>
                        <div className="import-success-banner__text">
                            <strong>{previewData?.new_count} transacciones importadas</strong>
                            {previewData?.duplicate_count > 0 && ` · ${previewData.duplicate_count} duplicadas omitidas`}
                        </div>
                        {lastBatchId && (
                            <button className="btn-danger-outline" onClick={() => {
                                if (window.confirm(`¿Deshacer? Esto eliminará ${previewData?.new_count} transacciones.`)) {
                                    handleUndoImport(lastBatchId);
                                }
                            }}>
                                Deshacer importación
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button className="btn-primary" onClick={resetFlow}>
                            Importar otro archivo
                        </button>
                        <button className="btn-secondary" onClick={() => setCsvSubTab('history')}>
                            Ver historial
                        </button>
                    </div>
                </div>
            )}
            </div>
            )}

            {/* History sub-tab */}
            {csvSubTab === 'history' && (
                <ImportHistoryTab
                    history={importHistory}
                    loading={historyLoading}
                    expandedBatchId={expandedBatchId}
                    onToggle={(batchId) => setExpandedBatchId(prev => prev === batchId ? null : batchId)}
                    onUndo={handleUndoImport}
                    onRefresh={fetchImportHistory}
                />
            )}
        </div>
    );
}

// ─── SplitModal (legacy, kept for reference) ─────────────────────────────────
function SplitModal({ row, categories, workers, onSplit, onClose }) {
    const [parts, setParts] = useState(
        row.matched_workers.length > 0
            ? row.matched_workers.map(w => ({ description: `${row.description} - ${w.worker_code}`, amount: (row.amount / row.matched_workers.length).toFixed(2), category_id: '', worker_id: w.id }))
            : [{ description: row.description, amount: row.amount, category_id: '', worker_id: '' }, { description: '', amount: '0.00', category_id: '', worker_id: '' }]
    );

    const totalParts = parts.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const diff = Math.abs(totalParts - parseFloat(row.amount));

    return (
        <div className="workers-modal-overlay" onClick={onClose}>
            <div className="workers-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                <div className="workers-modal__header"><h2>Dividir Transacción</h2><button className="workers-modal__close" onClick={onClose}><X size={18} /></button></div>
                <div className="workers-modal__body">
                    <div className="ac-split-info">
                        <p>Original: <strong>{row.description}</strong></p>
                        <p>Monto total: <strong>{fmt$(row.amount)}</strong></p>
                    </div>
                    {parts.map((p, i) => (
                        <div key={i} className="ac-split-part">
                            <p className="ac-split-part-label">Parte {i + 1}</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div className="wf-field"><label className="wf-label">Worker</label>
                                    <div className="workers-select-wrapper">
                                        <select className="wf-select" value={p.worker_id} onChange={e => setParts(prev => prev.map((pt, j) => j === i ? { ...pt, worker_id: e.target.value } : pt))}>
                                            <option value="">Ninguno</option>
                                            {workers.map(w => <option key={w.id} value={w.id}>{w.first_name} {w.last_name} ({w.worker_code})</option>)}
                                        </select>
                                        <ChevronDown size={11} className="workers-select__arrow" />
                                    </div>
                                </div>
                                <div className="wf-field"><label className="wf-label">Monto</label><input className="wf-input" type="number" step="0.01" value={p.amount} onChange={e => setParts(prev => prev.map((pt, j) => j === i ? { ...pt, amount: e.target.value } : pt))} /></div>
                            </div>
                            <div className="wf-field"><label className="wf-label">Descripción</label><input className="wf-input" value={p.description} onChange={e => setParts(prev => prev.map((pt, j) => j === i ? { ...pt, description: e.target.value } : pt))} /></div>
                            <div className="wf-field"><label className="wf-label">Categoría</label>
                                <div className="workers-select-wrapper">
                                    <select className="wf-select" value={p.category_id} onChange={e => setParts(prev => prev.map((pt, j) => j === i ? { ...pt, category_id: e.target.value } : pt))}>
                                        <option value="">Sin categoría</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name_es}</option>)}
                                    </select>
                                    <ChevronDown size={11} className="workers-select__arrow" />
                                </div>
                            </div>
                        </div>
                    ))}
                    <button className="ac-add-part-btn" onClick={() => setParts(p => [...p, { description: '', amount: '0.00', category_id: '', worker_id: '' }])}><Plus size={12} /> Agregar parte</button>
                    <div className={`ac-split-total ${diff < 0.01 ? 'ac-split-total--ok' : 'ac-split-total--err'}`}>
                        <span>Total partes: {fmt$(totalParts)}</span>
                        <span>Original: {fmt$(row.amount)}</span>
                        <span>Diferencia: {fmt$(diff)} {diff < 0.01 ? '(ok)' : '(error)'}</span>
                    </div>
                </div>
                <div className="workers-modal__footer">
                    <button className="workers-btn-outline" onClick={onClose}>Cancelar</button>
                    <button className="workers-btn-primary" onClick={() => { if (diff >= 0.01) return; onSplit(parts); onClose(); }} disabled={diff >= 0.01}>Dividir</button>
                </div>
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 4 — CATEGORIES
// ═════════════════════════════════════════════════════════════════════════════
// ─── Category color palettes ─────────────────────────────────────────────────
const getCategoryColor = (type, index) => {
    const incomeColors = ['#3B6D11', '#639922', '#97C459', '#C0DD97'];
    const expenseColors = ['#E24B4A', '#D85A30', '#BA7517', '#888780', '#534AB7', '#185FA5', '#0F6E56', '#993556'];
    return type === 'income'
        ? incomeColors[index % incomeColors.length]
        : expenseColors[index % expenseColors.length];
};

function TabCategories({ categories, api, showToast, onCatsChanged }) {
    const [editCat, setEditCat] = useState(null);
    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState({ name: '', name_es: '', type: 'expense', tax_deductible: true, tax_category: '' });

    const maxUsage = useMemo(
        () => Math.max(...categories.map(c => parseInt(c.transaction_count || 0, 10)), 1),
        [categories]
    );

    const handleSave = async () => {
        try {
            if (editCat) { await api.put(`/accounting/categories/${editCat.id}`, form); showToast('Categoría actualizada.'); }
            else { await api.post('/accounting/categories', form); showToast('Categoría creada.'); }
            onCatsChanged(); setEditCat(null); setShowNew(false);
            setForm({ name: '', name_es: '', type: 'expense', tax_deductible: true, tax_category: '' });
        } catch { showToast('Error.', 'error'); }
    };

    const handleEditCategory = (cat) => {
        setEditCat(cat);
        setForm({ name: cat.name, name_es: cat.name_es, type: cat.type, tax_deductible: cat.tax_deductible, tax_category: cat.tax_category || '' });
        setShowNew(true);
    };

    return (
        <div className="cat-tab">
            <div className="cat-tab-header">
                <div>
                    <div className="cat-tab-title">Categorías contables</div>
                    <div className="cat-tab-sub">Definen cómo se clasifican las transacciones en el P&L</div>
                </div>
                <button className="workers-btn-primary" onClick={() => { setEditCat(null); setForm({ name: '', name_es: '', type: 'expense', tax_deductible: true, tax_category: '' }); setShowNew(true); }}>
                    <Plus size={14} /> Nueva Categoría
                </button>
            </div>

            {['income', 'expense'].map(type => {
                const groupCats = categories.filter(c => c.type === type);
                return (
                    <div key={type} className="cat-group">
                        <div className={`cat-group-header cat-group-header--${type}`}>
                            <div className={`cat-group-dot cat-group-dot--${type}`} />
                            <span className={`cat-group-label cat-group-label--${type}`}>
                                {type === 'income' ? 'Ingresos' : 'Gastos'}
                            </span>
                            <span className="cat-group-count">{groupCats.length} categorías</span>
                        </div>

                        <table className="cat-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 36 }}></th>
                                    <th>Nombre (ES)</th>
                                    <th style={{ width: 160 }}>Clave (EN)</th>
                                    <th style={{ width: 150 }}>Tax Category</th>
                                    <th style={{ width: 90, textAlign: 'center' }}>Deducible</th>
                                    <th style={{ width: 100, textAlign: 'right' }}>Uso</th>
                                    <th style={{ width: 60 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {groupCats.map((cat, i) => (
                                    <tr key={cat.id} className="cat-row">
                                        <td>
                                            <div
                                                className="cat-color-dot"
                                                style={{ background: getCategoryColor(type, i) }}
                                            />
                                        </td>
                                        <td className="cat-name">{cat.name_es}</td>
                                        <td className="cat-slug">{cat.name}</td>
                                        <td>
                                            <span className="cat-tax-pill">{cat.tax_category || '—'}</span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {cat.tax_deductible
                                                ? <div className="cat-check cat-check--yes">
                                                    <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                                                        <path d="M2 5L4 7.5L8 2.5" stroke="#08543D" strokeWidth="1.5" strokeLinecap="round"/>
                                                    </svg>
                                                  </div>
                                                : <div className="cat-check cat-check--no" />
                                            }
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div className="cat-usage">
                                                <span className="cat-usage-num">{parseInt(cat.transaction_count || 0, 10)}</span>
                                                <div className="cat-usage-bar-bg">
                                                    <div
                                                        className="cat-usage-bar-fill"
                                                        style={{ width: `${Math.min((parseInt(cat.transaction_count || 0, 10) / maxUsage) * 100, 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <button className="cat-edit-btn" onClick={() => handleEditCategory(cat)}>
                                                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                                                    <path d="M2 12L3.5 8.5L10 2L12 4L5.5 10.5L2 12Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            })}

            {showNew && (
                <div className="workers-modal-overlay" onClick={() => setShowNew(false)}>
                    <div className="workers-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="workers-modal__header">
                            <h2>{editCat ? 'Editar' : 'Nueva'} Categoría</h2>
                            <button className="workers-modal__close" onClick={() => setShowNew(false)}><X size={18} /></button>
                        </div>
                        <div className="workers-modal__body">
                            <div className="wf-field"><label className="wf-label">Clave (inglés) *</label><input className="wf-input" placeholder="payroll_zelle" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                            <div className="wf-field"><label className="wf-label">Nombre (español) *</label><input className="wf-input" placeholder="Nómina Zelle" value={form.name_es} onChange={e => setForm(f => ({ ...f, name_es: e.target.value }))} /></div>
                            <div className="wf-field"><label className="wf-label">Tipo</label>
                                <div className="workers-select-wrapper"><select className="wf-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}><option value="income">Ingreso</option><option value="expense">Gasto</option></select><ChevronDown size={12} className="workers-select__arrow" /></div>
                            </div>
                            <div className="wf-field"><label className="wf-label">Tax Category</label><input className="wf-input" placeholder="1099_payments, vehicle_expense..." value={form.tax_category} onChange={e => setForm(f => ({ ...f, tax_category: e.target.value }))} /></div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                                <input type="checkbox" checked={!!form.tax_deductible} onChange={e => setForm(f => ({ ...f, tax_deductible: e.target.checked }))} /> Tax deductible
                            </label>
                        </div>
                        <div className="workers-modal__footer">
                            <button className="workers-btn-outline" onClick={() => setShowNew(false)}>Cancelar</button>
                            <button className="workers-btn-primary" onClick={handleSave}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 5 — TAX
// ═════════════════════════════════════════════════════════════════════════════
function TabTax({ api }) {
    const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));
    const [taxData, setTaxData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [printPreview, setPrintPreview] = useState(null);

    const fetchTaxData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/accounting/tax-summary?year=${taxYear}`);
            setTaxData(res.data?.data || res.data || res);
        } catch { console.error('tax fetch failed'); }
        finally { setLoading(false); }
    }, [api, taxYear]);

    useEffect(() => { fetchTaxData(); }, [fetchTaxData]);

    // ── Export helpers ────────────────────────────────────────────────────────
    const downloadBlob = (content, filename, type) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    };

    const downloadCSV = (type) => {
        if (!taxData) return;
        if (type === 'tax') {
            const rows = [
                ['Concepto', 'Monto'],
                ['Ingresos Brutos', taxData.gross_income.toFixed(2)],
                ...(taxData.deductible_by_category || []).map(c => [c.name_es, (-c.total).toFixed(2)]),
                ['Total Deducible', (-taxData.total_deductible).toFixed(2)],
                ['Ingreso Neto Gravable', taxData.net_taxable.toFixed(2)],
                ['Per Diem (no gravable)', taxData.per_diem_total.toFixed(2)],
            ];
            downloadBlob(rows.map(r => r.join(',')).join('\n'), `tax_summary_${taxYear}.csv`, 'text/csv');
        } else {
            const rows = [
                ['Nombre', 'Código', 'SSN', 'Dirección', 'Ciudad', 'Estado', 'ZIP', 'Total Pagado', 'Necesita 1099'],
                ...(taxData.workers_1099 || []).map(w => [
                    `${w.first_name} ${w.last_name}`,
                    w.worker_code,
                    w.ssn || '',
                    w.address || '',
                    w.city || '',
                    w.state || '',
                    w.zip_code || '',
                    w.total_paid.toFixed(2),
                    w.total_paid >= 600 ? 'Sí' : 'No',
                ])
            ];
            downloadBlob(rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n'), `1099_report_${taxYear}.csv`, 'text/csv');
        }
        setPrintPreview(null);
    };

    const downloadExcel = (type) => {
        if (!taxData) return;
        import('xlsx').then(XLSX => {
            const wb = XLSX.utils.book_new();
            let ws;
            if (type === 'tax') {
                const data = [
                    ['HM Construction Staffing LLLP', '', ''],
                    [`Resumen Fiscal ${taxYear}`, '', ''],
                    ['', '', ''],
                    ['Concepto', '', 'Monto'],
                    ['Ingresos Brutos', '', taxData.gross_income],
                    ['', '', ''],
                    ['GASTOS DEDUCIBLES', '', ''],
                    ...(taxData.deductible_by_category || []).map(c => [c.name_es, '', -c.total]),
                    ['Total Deducible', '', -taxData.total_deductible],
                    ['', '', ''],
                    ['Ingreso Neto Gravable', '', taxData.net_taxable],
                    ['', '', ''],
                    ['Per Diem (no gravable)', '', taxData.per_diem_total],
                ];
                ws = XLSX.utils.aoa_to_sheet(data);
                ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 15 }];
                XLSX.utils.book_append_sheet(wb, ws, 'Resumen Fiscal');
                XLSX.writeFile(wb, `tax_summary_${taxYear}.xlsx`);
            } else {
                const data = [
                    ['HM Construction Staffing LLLP — Reporte 1099-NEC', '', '', '', '', '', '', '', ''],
                    [`Año Fiscal ${taxYear}`, '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', ''],
                    ['Nombre Completo', 'Código', 'SSN', 'Dirección', 'Ciudad', 'Estado', 'ZIP', 'Total Pagado', 'Necesita 1099'],
                    ...(taxData.workers_1099 || []).map(w => [
                        `${w.first_name} ${w.last_name}`,
                        w.worker_code,
                        w.ssn || 'Sin SSN',
                        w.address || '',
                        w.city || '',
                        w.state || '',
                        w.zip_code || '',
                        w.total_paid,
                        w.total_paid >= 600 ? 'Sí' : 'No',
                    ])
                ];
                ws = XLSX.utils.aoa_to_sheet(data);
                ws['!cols'] = [{wch:22},{wch:10},{wch:13},{wch:28},{wch:14},{wch:8},{wch:8},{wch:14},{wch:12}];
                XLSX.utils.book_append_sheet(wb, ws, '1099-NEC');
                XLSX.writeFile(wb, `1099_report_${taxYear}.xlsx`);
            }
        });
        setPrintPreview(null);
    };

    const downloadPDF = (type) => {
        if (!taxData) return;
        import('jspdf').then(({ default: jsPDF }) => {
            import('jspdf-autotable').then(() => {
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
                doc.setFontSize(16);
                doc.setTextColor(42, 108, 149);
                doc.text('HM Construction Staffing LLLP', 20, 22);
                doc.setFontSize(10);
                doc.setTextColor(100);
                doc.text('Savannah, Georgia', 20, 29);
                const titleText = type === 'tax' ? `Resumen Fiscal ${taxYear}` : `Reporte 1099-NEC ${taxYear}`;
                doc.setFontSize(13);
                doc.setTextColor(30);
                doc.text(titleText, 140, 22, { align: 'right' });
                doc.setFontSize(9);
                doc.setTextColor(150);
                doc.text(`Generado: ${new Date().toLocaleDateString('es-US')}`, 140, 29, { align: 'right' });
                doc.setDrawColor(42, 108, 149);
                doc.setLineWidth(0.8);
                doc.line(20, 33, 190, 33);

                if (type === 'tax') {
                    doc.autoTable({
                        startY: 40,
                        head: [['Concepto', 'Monto']],
                        body: [
                            ['Ingresos Brutos', `$${taxData.gross_income.toFixed(2)}`],
                            ...(taxData.deductible_by_category || []).map(c => [`  ${c.name_es}`, `($${c.total.toFixed(2)})`]),
                            ['Total Deducible', `($${taxData.total_deductible.toFixed(2)})`],
                            ['Ingreso Neto Gravable', `$${taxData.net_taxable.toFixed(2)}`],
                            ['Per Diem (no gravable)', `$${taxData.per_diem_total.toFixed(2)}`],
                        ],
                        headStyles: { fillColor: [42, 108, 149], fontStyle: 'bold', fontSize: 10 },
                        columnStyles: { 1: { halign: 'right' } },
                        styles: { fontSize: 10, cellPadding: 4 },
                    });
                } else {
                    doc.autoTable({
                        startY: 40,
                        head: [['Nombre', 'Código', 'SSN', 'Dirección', 'Total Pagado', '1099']],
                        body: (taxData.workers_1099 || []).map(w => [
                            `${w.first_name} ${w.last_name}`,
                            w.worker_code,
                            w.ssn || 'N/A',
                            w.address ? `${w.address}${w.city ? ', ' + w.city : ''}${w.state ? ', ' + w.state : ''}${w.zip_code ? ' ' + w.zip_code : ''}` : 'Sin dirección',
                            `$${w.total_paid.toFixed(2)}`,
                            w.total_paid >= 600 ? 'Sí' : 'No',
                        ]),
                        headStyles: { fillColor: [8, 84, 61], fontStyle: 'bold', fontSize: 9 },
                        columnStyles: {
                            0: { cellWidth: 38 }, 1: { cellWidth: 18 }, 2: { cellWidth: 22 },
                            3: { cellWidth: 55 }, 4: { cellWidth: 28, halign: 'right' }, 5: { cellWidth: 14, halign: 'center' },
                        },
                        styles: { fontSize: 9, cellPadding: 3 },
                    });
                    const finalY = doc.lastAutoTable.finalY + 8;
                    doc.setFontSize(8);
                    doc.setTextColor(100);
                    doc.text('Nota: Este reporte contiene el SSN completo para uso exclusivo de la contadora. Mantenga este documento seguro.', 20, finalY);
                }

                const pageCount = doc.internal.getNumberOfPages();
                for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i);
                    doc.setFontSize(8);
                    doc.setTextColor(180);
                    doc.text(`HM Construction Staffing LLLP · HMCS · Página ${i} de ${pageCount}`, 105, 275, { align: 'center' });
                }
                doc.save(type === 'tax' ? `tax_summary_${taxYear}.pdf` : `1099_report_${taxYear}.pdf`);
            });
        });
        setPrintPreview(null);
    };

    const handlePrint = (html) => {
        const win = window.open('', '_blank');
        win.document.write(`<!DOCTYPE html><html><head><title>HMCS</title><style>@media print{body{margin:0;}@page{margin:20mm;}}body{font-family:Arial,sans-serif;}</style></head><body>${html}</body></html>`);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 500);
    };

    // ── Preview triggers ──────────────────────────────────────────────────────
    const handleTaxExport = async (format) => {
        if (!taxData) return;
        const { generateTaxSummaryHtml: genTax } = await import('../../utils/taxExportUtils');
        const html = genTax(taxData, taxYear);
        setPrintPreview({ title: `Resumen Fiscal ${taxYear}`, html, type: 'tax', format });
    };

    const handle1099Export = async (format) => {
        if (!taxData) return;
        const { generate1099Html: gen1099 } = await import('../../utils/taxExportUtils');
        const html = gen1099(taxData.workers_1099, taxYear);
        setPrintPreview({ title: `Reporte 1099-NEC ${taxYear}`, html, type: '1099', format });
    };

    return (
        <div className="tax-tab">
            {/* Year bar */}
            <div className="tax-year-bar">
                <div className="tax-year-left">
                    <span className="tax-year-label">Año fiscal:</span>
                    <select className="tax-year-select" value={taxYear} onChange={e => setTaxYear(e.target.value)}>
                        {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button className="tax-refresh-btn" onClick={fetchTaxData}>
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7C2 4.2 4.2 2 7 2C8.7 2 10.2 2.8 11.1 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            <path d="M12 7C12 9.8 9.8 12 7 12C5.3 12 3.8 11.2 2.9 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                            <polyline points="11,1 11,4 8,4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                    {loading && <span className="ac-loading-txt">Cargando...</span>}
                </div>
                <div className="tax-export-group">
                    <button className="tax-download-btn" onClick={() => handleTaxExport('csv')} title="Descargar / Imprimir">
                        <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                            <path d="M7 2V9M7 9L4.5 6.5M7 9L9.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M2 11H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                        Descargar
                    </button>
                </div>
            </div>

            {/* Tax Summary Card */}
            {taxData && (
                <div className="tax-summary-card">
                    <div className="tax-card-title">
                        <div className="tax-card-dot" style={{ background: '#2A6C95' }} />
                        Resumen Fiscal {taxYear}
                    </div>
                    <div className="tax-row">
                        <span className="tax-row-label">Ingresos Brutos</span>
                        <span className="tax-row-val tax-row-val--pos">${(taxData.gross_income || 0).toFixed(2)}</span>
                    </div>
                    <div className="tax-deductible-label">Gastos Deducibles</div>
                    {(taxData.deductible_by_category || []).map(item => (
                        <div key={item.slug} className="tax-row tax-row--indent">
                            <span className="tax-row-label">{item.name_es}</span>
                            <span className="tax-row-val tax-row-val--neg">${item.total.toFixed(2)}</span>
                        </div>
                    ))}
                    <div className="tax-row tax-row--total">
                        <span className="tax-row-label">Total Deducible</span>
                        <span className="tax-row-val tax-row-val--neg">${(taxData.total_deductible || 0).toFixed(2)}</span>
                    </div>
                    <div className="tax-net-box">
                        <span className="tax-net-label">Ingreso Neto Gravable</span>
                        <span className="tax-net-val">${(taxData.net_taxable || 0).toFixed(2)}</span>
                    </div>
                    <div className="tax-perdiem-note">
                        <div className="tax-info-icon">i</div>
                        Per Diem passthrough (${(taxData.per_diem_total || 0).toFixed(2)}) — NO gravable · No afecta este cálculo
                    </div>
                </div>
            )}

            {/* 1099-NEC Card */}
            {taxData && (
                <div className="tax-1099-card">
                    <div className="tax-1099-header">
                        <div>
                            <div className="tax-card-title">
                                <div className="tax-card-dot" style={{ background: '#08543D' }} />
                                Reporte 1099-NEC — {taxYear}
                            </div>
                            <div className="tax-1099-sub">
                                Requerido si se pagó más de $600 a un contratista en el año fiscal
                            </div>
                        </div>
                        <div className="tax-1099-exports">
                            <button className="tax-download-btn" onClick={() => handle1099Export('csv')} title="Descargar / Imprimir">
                                <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                                    <path d="M7 2V9M7 9L4.5 6.5M7 9L9.5 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M2 11H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                                </svg>
                                Descargar
                            </button>
                        </div>
                    </div>

                    <table className="tax-1099-table">
                        <thead>
                            <tr>
                                <th>Worker</th>
                                <th>Código</th>
                                <th>SSN</th>
                                <th>Dirección</th>
                                <th style={{ textAlign: 'right' }}>Total Pagado</th>
                                <th style={{ textAlign: 'center', width: 130 }}>Necesita 1099</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(taxData.workers_1099 || []).map(w => (
                                <tr key={w.id} className="tax-1099-row">
                                    <td className="tax-worker-name">{w.first_name} {w.last_name}</td>
                                    <td className="tax-worker-code">{w.worker_code}</td>
                                    <td className="tax-worker-ssn">
                                        {w.ssn
                                            ? <span className="tax-ssn-masked">***-**-{String(w.ssn).slice(-4)}</span>
                                            : <span className="tax-ssn-missing">Sin SSN</span>
                                        }
                                    </td>
                                    <td className="tax-worker-addr">
                                        {w.address
                                            ? `${w.address}${w.city ? ', ' + w.city : ''}${w.state ? ', ' + w.state : ''}${w.zip_code ? ' ' + w.zip_code : ''}`
                                            : <span className="tax-ssn-missing">Sin dirección</span>
                                        }
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 500 }}>
                                        ${w.total_paid.toFixed(2)}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {w.total_paid >= 600
                                            ? <span className="tax-needs-1099">Sí — ${w.total_paid.toFixed(2)}</span>
                                            : <span className="tax-no-1099">No — bajo $600</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Print Preview Modal */}
            {printPreview && (
                <PrintPreviewModal
                    title={printPreview.title}
                    previewHtml={printPreview.html}
                    onClose={() => setPrintPreview(null)}
                    onPrint={() => handlePrint(printPreview.html)}
                    onDownloadCsv={() => downloadCSV(printPreview.type)}
                    onDownloadExcel={() => downloadExcel(printPreview.type)}
                    onDownloadPdf={() => downloadPDF(printPreview.type)}
                />
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function Accounting() {
    const api = useApi();
    const { get } = api;

    const [activeTab, setActiveTab] = useState('dashboard');
    const [categories, setCategories] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [clients, setClients] = useState([]);
    const [toast, setToast] = useState(null);
    const [uncategorizedCount, setUncategorizedCount] = useState(0);
    const [showNewTxModal, setShowNewTxModal] = useState(false);
    const [openRuleFromHeader, setOpenRuleFromHeader] = useState(false);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type }); setTimeout(() => setToast(null), 3600);
    };

    const loadCategories = useCallback(async () => {
        try { setCategories(await get('/accounting/categories').then(r => r.data?.data || r.data || r)); } catch { }
    }, [get]);

    useEffect(() => {
        loadCategories();
        get('/workers').then(r => setWorkers(r.data || r)).catch(() => { });
        get('/clients').then(r => setClients(r.data || r)).catch(() => { });
    }, []);

    return (
        <div className="ac-page fade-in">
            {toast && (
                <div className={`workers-toast workers-toast--${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={15} /> : <X size={15} />} {toast.msg}
                </div>
            )}

            {/* Page Header */}
            <div className="ac-page-header">
                <div>
                    <h1 className="ts-title">Contabilidad</h1>
                    <p className="ts-subtitle">P&L · Transacciones · CSV Import · Tax</p>
                </div>
                <div className="ac-header-actions">
                    <button className="ac-btn-outline-pdf" onClick={() => { setActiveTab('transactions'); setOpenRuleFromHeader(true); }}>
                        Nueva Regla
                    </button>
                    <button className="ac-btn-new-tx" onClick={() => setShowNewTxModal(true)}>
                        <Plus size={14} /> Nueva Transacción
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="ac-tabs">
                {TABS.map(tab => (
                    <button key={tab.id} className={`ac-tab ${activeTab === tab.id ? 'ac-tab--active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                        {tab.icon} {tab.label}
                        {tab.id === 'transactions' && uncategorizedCount > 0 && (
                            <span className="tab-badge">{uncategorizedCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="ac-tab-panel">
                {activeTab === 'dashboard' && (
                    <TabDashboard
                        api={api}
                        setActiveTab={setActiveTab}
                        onUncatCountChange={setUncategorizedCount}
                    />
                )}
                {activeTab === 'transactions' && <TabTransactions api={api} categories={categories} workers={workers} clients={clients} showToast={showToast} onUncatCountChange={setUncategorizedCount} openRuleFromHeader={openRuleFromHeader} onRuleModalOpened={() => setOpenRuleFromHeader(false)} />}
                {activeTab === 'import' && <TabImport api={api} categories={categories} showToast={showToast} />}
                {activeTab === 'categories' && <TabCategories categories={categories} api={api} showToast={showToast} onCatsChanged={loadCategories} />}
                {activeTab === 'tax' && <TabTax api={api} />}
            </div>

            {showNewTxModal && ReactDOM.createPortal(
                <NewTxModal
                    categories={categories}
                    workers={workers}
                    clients={clients}
                    api={api}
                    showToast={showToast}
                    onCreated={() => {}}
                    onClose={() => setShowNewTxModal(false)}
                />,
                document.body
            )}
        </div>
    );
}
