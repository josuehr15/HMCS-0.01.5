import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    BarChart2, List, Upload, FolderOpen, FileText,
    TrendingUp, TrendingDown, DollarSign, Percent,
    Plus, X, Search, ChevronDown, RefreshCw, CheckCircle,
    AlertCircle, AlertTriangle, Download, Eye, Edit2,
    Split, ArrowRight, Trash2, Tag
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import './Accounting.css';

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

// ═════════════════════════════════════════════════════════════════════════════
// TAB 1 — DASHBOARD
// ═════════════════════════════════════════════════════════════════════════════
function TabDashboard({ api }) {
    const now = new Date();
    const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    const [pnl, setPnl] = useState(null);
    const [wMargins, setWMargins] = useState([]);
    const [cMargins, setCMargins] = useState([]);
    const [cashFlow, setCashFlow] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [pnlRes, wmRes, cmRes, cfRes] = await Promise.all([
                api.get(`/accounting/pnl?period=${period}`),
                api.get('/accounting/margins/workers'),
                api.get('/accounting/margins/clients'),
                api.get(`/accounting/cash-flow?year=${period.split('-')[0]}`),
            ]);
            setPnl(pnlRes.data?.data || pnlRes.data || pnlRes);
            setWMargins(wmRes.data?.data || wmRes.data || []);
            setCMargins(cmRes.data?.data || cmRes.data || []);
            setCashFlow(cfRes.data?.data || cfRes.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [api, period]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const income = pnl?.income || { items: {}, total: 0 };
    const expense = pnl?.expense || { items: {}, total: 0 };

    // Bar chart dimensions for cash flow (mini)
    const maxFlow = cashFlow.length > 0 ? Math.max(...cashFlow.map(b => Math.max(b.income, b.expense, 1))) : 1;

    return (
        <div className="ac-tab-content">
            {/* Period filter */}
            <div className="ac-period-bar">
                <label className="ac-period-label">Período:</label>
                <input type="month" className="ac-month-input" value={period} onChange={e => setPeriod(e.target.value)} />
                <button className="ac-refresh-btn" onClick={fetchAll}><RefreshCw size={13} /></button>
                {loading && <span className="ac-loading-txt">Cargando...</span>}
            </div>

            {/* KPI cards */}
            {pnl && (
                <div className="ts-stats-grid" style={{ marginBottom: 20 }}>
                    {[
                        { label: 'Ingresos', value: fmt$(income.total), icon: <TrendingUp size={18} />, color: '#10B981' },
                        { label: 'Gastos', value: fmt$(expense.total), icon: <TrendingDown size={18} />, color: '#EF4444' },
                        { label: 'Ganancia', value: fmt$(pnl.net), icon: <DollarSign size={18} />, color: pnl.net >= 0 ? '#6366F1' : '#EF4444' },
                        { label: 'Margen', value: income.total > 0 ? `${(pnl.net / income.total * 100).toFixed(1)}%` : '—', icon: <Percent size={18} />, color: '#F59E0B' },
                    ].map((s, i) => (
                        <div key={i} className="ts-stat-card">
                            <div className="ts-stat-card__icon" style={{ background: `${s.color}15`, color: s.color }}>{s.icon}</div>
                            <div><p className="ts-stat-card__value">{s.value}</p><p className="ts-stat-card__label">{s.label}</p></div>
                        </div>
                    ))}
                </div>
            )}

            {/* P&L Statement */}
            {pnl && (
                <div className="ac-pnl-box">
                    <h3 className="ac-section-title">📊 P&L — Profit & Loss</h3>
                    <div className="ac-pnl-cols">
                        {/* Income */}
                        <div className="ac-pnl-col">
                            <p className="ac-pnl-type ac-pnl-type--income">INGRESOS</p>
                            {Object.entries(income.items).map(([k, v]) => (
                                <div key={k} className="ac-pnl-row">
                                    <span>{k}</span><span>{fmt$(v)}</span>
                                </div>
                            ))}
                            <div className="ac-pnl-row ac-pnl-row--total">
                                <span>TOTAL INGRESOS</span><span>{fmt$(income.total)}</span>
                            </div>
                        </div>
                        {/* Expense */}
                        <div className="ac-pnl-col">
                            <p className="ac-pnl-type ac-pnl-type--expense">GASTOS</p>
                            {Object.entries(expense.items).map(([k, v]) => (
                                <div key={k} className="ac-pnl-row">
                                    <span>{k}</span><span className="ac-expense-txt">{fmt$(v)}</span>
                                </div>
                            ))}
                            <div className="ac-pnl-row ac-pnl-row--total">
                                <span>TOTAL GASTOS</span><span className="ac-expense-txt">{fmt$(expense.total)}</span>
                            </div>
                        </div>
                    </div>
                    {/* Net */}
                    <div className="ac-net-row">
                        <span>GANANCIA NETA</span>
                        <span className={pnl.net >= 0 ? 'ac-net-pos' : 'ac-net-neg'}>{fmt$(pnl.net)}</span>
                    </div>
                    {pnl.per_diem_passthrough > 0 && (
                        <p className="ac-perdiem-note">ℹ️ Per Diem passthrough: {fmt$(pnl.per_diem_passthrough)} — NO incluido en P&L</p>
                    )}
                </div>
            )}

            {/* Mini Cash-Flow bar chart */}
            {cashFlow.length > 0 && (
                <div className="ac-cf-box">
                    <h3 className="ac-section-title">📈 Cash Flow {period.split('-')[0]}</h3>
                    <div className="ac-cf-chart">
                        {cashFlow.map((b, i) => (
                            <div key={i} className="ac-cf-col">
                                <div className="ac-cf-bars">
                                    <div className="ac-cf-bar ac-cf-bar--income" style={{ height: `${(b.income / maxFlow * 120).toFixed(0)}px` }} title={`Ingreso: ${fmt$(b.income)}`} />
                                    <div className="ac-cf-bar ac-cf-bar--expense" style={{ height: `${(b.expense / maxFlow * 120).toFixed(0)}px` }} title={`Gasto: ${fmt$(b.expense)}`} />
                                </div>
                                <span className="ac-cf-label">{b.period.split('-')[1] || b.period}</span>
                            </div>
                        ))}
                    </div>
                    <div className="ac-cf-legend">
                        <span className="ac-cf-dot ac-cf-dot--income" />Ingresos
                        <span className="ac-cf-dot ac-cf-dot--expense" style={{ marginLeft: 12 }} />Gastos
                    </div>
                </div>
            )}

            {/* Worker margins */}
            {wMargins.length > 0 && (
                <div className="ac-margins-box">
                    <h3 className="ac-section-title">💰 Márgenes por Worker</h3>
                    <table className="ac-margins-table">
                        <thead><tr><th>Worker</th><th>Código</th><th className="r">Cobrado</th><th className="r">Pagado</th><th className="r">Margen</th><th className="r">%</th></tr></thead>
                        <tbody>
                            {wMargins.map((w, i) => (
                                <tr key={i}>
                                    <td>{w.worker_name}</td>
                                    <td><code>{w.worker_code}</code></td>
                                    <td className="r">{fmt$(w.billed)}</td>
                                    <td className="r">{fmt$(w.paid)}</td>
                                    <td className="r" style={{ color: w.margin >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>{fmt$(w.margin)}</td>
                                    <td className="r"><span className={`ac-pct ${w.margin_pct > 30 ? 'ac-pct--hi' : w.margin_pct > 10 ? 'ac-pct--mid' : 'ac-pct--lo'}`}>{w.margin_pct}%</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Client margins */}
            {cMargins.length > 0 && (
                <div className="ac-margins-box">
                    <h3 className="ac-section-title">🏢 Márgenes por Cliente</h3>
                    <table className="ac-margins-table">
                        <thead><tr><th>Cliente</th><th className="r">Facturado</th><th className="r">Costo</th><th className="r">Margen</th><th className="r">%</th></tr></thead>
                        <tbody>
                            {cMargins.map((c, i) => (
                                <tr key={i}>
                                    <td>{c.client_name}</td>
                                    <td className="r">{fmt$(c.billed)}</td>
                                    <td className="r">{fmt$(c.cost)}</td>
                                    <td className="r" style={{ color: c.margin >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>{fmt$(c.margin)}</td>
                                    <td className="r"><span className={`ac-pct ${c.margin_pct > 30 ? 'ac-pct--hi' : c.margin_pct > 10 ? 'ac-pct--mid' : 'ac-pct--lo'}`}>{c.margin_pct}%</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 2 — TRANSACTIONS
// ═════════════════════════════════════════════════════════════════════════════
function NewTxModal({ categories, workers, clients, api, showToast, onCreated, onClose }) {
    const [form, setForm] = useState({ type: 'expense', date: new Date().toISOString().split('T')[0], amount: '', category_id: '', description: '', worker_id: '', client_id: '', notes: '' });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!form.date || !form.amount || !form.description) return showToast('Campos requeridos faltantes.', 'error');
        setSaving(true);
        try {
            const res = await api.post('/accounting/transactions', form);
            onCreated(res.data?.data || res.data || res);
            showToast('Transacción creada.');
            onClose();
        } catch { showToast('Error al crear.', 'error'); }
        finally { setSaving(false); }
    };

    return (
        <div className="workers-modal-overlay" onClick={onClose}>
            <div className="workers-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                <div className="workers-modal__header">
                    <h2>➕ Nueva Transacción Manual</h2>
                    <button className="workers-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="workers-modal__body">
                    <div className="ac-type-toggle">
                        {['income', 'expense'].map(t => (
                            <button key={t} className={`ac-type-btn ${form.type === t ? 'ac-type-btn--active' : ''}`} onClick={() => setForm(f => ({ ...f, type: t }))}>
                                {t === 'income' ? '💵 Ingreso' : '💸 Gasto'}
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
                    <button className="workers-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
                </div>
            </div>
        </div>
    );
}

function TabTransactions({ api, categories, workers, clients, showToast }) {
    const [txs, setTxs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterCat, setFilterCat] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [savedId, setSavedId] = useState(null); // ID row that just got saved

    const fetchTxs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterType !== 'all') params.set('type', filterType);
            if (filterCat) params.set('category_id', filterCat);
            const res = await api.get(`/accounting/transactions?${params}`);
            setTxs(res.data?.data || res.data || []);
        } catch { showToast('Error al cargar transacciones.', 'error'); }
        finally { setLoading(false); }
    }, [api, filterType, filterCat]);

    useEffect(() => { fetchTxs(); }, [fetchTxs]);

    const handleCatChange = async (tx, catId) => {
        try {
            const res = await api.put(`/accounting/transactions/${tx.id}`, { category_id: catId || null });
            const upd = res.data?.data || res.data || res;
            setTxs(prev => prev.map(t => t.id === upd.id ? upd : t));
            // Visual feedback: flash verde
            setSavedId(tx.id);
            setTimeout(() => setSavedId(null), 1100);
        } catch { showToast('Error al categorizar.', 'error'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar esta transacción?')) return;
        try { await api.delete(`/accounting/transactions/${id}`); setTxs(prev => prev.filter(t => t.id !== id)); }
        catch { showToast('Error.', 'error'); }
    };

    const displayed = useMemo(() => {
        if (!search) return txs;
        const q = search.toLowerCase();
        return txs.filter(t => t.description?.toLowerCase().includes(q) || t.category?.name_es?.toLowerCase().includes(q));
    }, [txs, search]);

    const uncatCount = txs.filter(t => !t.category_id && !t.parent_transaction_id).length;

    return (
        <div className="ac-tab-content">
            <div className="workers-toolbar" style={{ marginBottom: 14 }}>
                <button className="workers-btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Nueva Transacción</button>
                <div className="workers-search-box"><Search size={13} className="workers-search-icon" /><input className="workers-search" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} /></div>
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="all">Todos los tipos</option>
                        <option value="income">Ingresos</option>
                        <option value="expense">Gastos</option>
                    </select>
                    <ChevronDown size={12} className="workers-select__arrow" />
                </div>
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                        <option value="">Todas las categorías</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name_es}</option>)}
                    </select>
                    <ChevronDown size={12} className="workers-select__arrow" />
                </div>
                <button className="ts-month-btn" onClick={fetchTxs}><RefreshCw size={13} /></button>
                {uncatCount > 0 && <span className="ac-uncat-badge">⚠️ {uncatCount} sin categorizar</span>}
            </div>

            {loading ? (
                <div className="workers-empty"><RefreshCw size={28} /><p>Cargando...</p></div>
            ) : (
                <div className="inv-table-wrapper">
                    <table className="inv-list-table">
                        <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Worker/Cliente</th><th className="r">Monto</th><th>Acciones</th></tr></thead>
                        <tbody>
                            {displayed.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px' }}>Sin transacciones</td></tr>}
                            {displayed.map(tx => {
                                const isParent = tx.is_split;
                                const uncat = !tx.category_id && !tx.parent_transaction_id;
                                return (
                                    <>
                                        <tr key={tx.id} className={`inv-list-row ${uncat ? 'ac-tx-uncat' : ''}`}>
                                            <td className="inv-date">{fmtDate(tx.date)}</td>
                                            <td>
                                                {isParent && <span className="ac-split-tag">🔀 Split</span>}
                                                {tx.description}
                                            </td>
                                            <td>
                                                <div className="workers-select-wrapper" style={{ minWidth: 140 }}>
                                                    <select
                                                        className={`ac-inline-cat-sel ${savedId === tx.id ? 'ac-cat-saved' : ''}`}
                                                        value={tx.category_id || ''}
                                                        onChange={e => handleCatChange(tx, e.target.value)}
                                                    >
                                                        <option value="">⚠️ Sin categoría</option>
                                                        {categories.filter(c => c.type === tx.type).map(c => <option key={c.id} value={c.id}>{c.name_es}</option>)}
                                                    </select>
                                                    <ChevronDown size={11} className="workers-select__arrow" />
                                                </div>
                                            </td>
                                            <td style={{ fontSize: 11, color: '#6B7280' }}>
                                                {tx.worker && `👷 ${tx.worker.first_name} ${tx.worker.last_name}`}
                                                {tx.client && `🏢 ${tx.client.company_name}`}
                                            </td>
                                            <td className={`r inv-total ${tx.type === 'income' ? 'ac-income-amt' : 'ac-expense-amt'}`}>
                                                {tx.type === 'income' ? '+' : '-'}{fmt$(tx.amount)}
                                            </td>
                                            <td onClick={e => e.stopPropagation()}>
                                                <div className="inv-row-actions">
                                                    <button className="inv-row-btn" onClick={() => handleDelete(tx.id)} title="Eliminar"><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Split children */}
                                        {tx.splitChildren?.map(ch => (
                                            <tr key={`ch-${ch.id}`} className="ac-tx-child">
                                                <td></td>
                                                <td style={{ paddingLeft: 24, fontSize: 12, color: '#6B7280' }}>↳ {ch.description}</td>
                                                <td style={{ fontSize: 12 }}>{ch.category?.name_es || '—'}</td>
                                                <td style={{ fontSize: 11 }}>{ch.worker?.worker_code || ''}</td>
                                                <td className="r" style={{ fontSize: 12 }}>{fmt$(ch.amount)}</td>
                                                <td></td>
                                            </tr>
                                        ))}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && <NewTxModal categories={categories} workers={workers} clients={clients} api={api} showToast={showToast} onCreated={tx => setTxs(p => [tx, ...p])} onClose={() => setShowModal(false)} />}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 3 — CSV IMPORT
// ═════════════════════════════════════════════════════════════════════════════
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
                <div className="workers-modal__header"><h2>🔀 Dividir Transacción</h2><button className="workers-modal__close" onClick={onClose}><X size={18} /></button></div>
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
                        <span>Diferencia: {fmt$(diff)} {diff < 0.01 ? '✅' : '❌'}</span>
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

function TabImport({ api, categories, workers, showToast }) {
    const [csvText, setCsvText] = useState('');
    const [preview, setPreview] = useState(null);
    const [rows, setRows] = useState([]);
    const [importing, setImporting] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [splitRow, setSplitRow] = useState(null);
    const fileRef = useRef();

    const handleFile = (file) => {
        const reader = new FileReader();
        reader.onload = e => setCsvText(e.target.result);
        reader.readAsText(file);
    };

    const handlePreview = async () => {
        if (!csvText.trim()) return showToast('Pega el CSV o sube un archivo primero.', 'error');
        setParsing(true);
        try {
            const res = await api.post('/accounting/import-csv', { csv_text: csvText });
            const data = res.data?.data || res.data || res;
            setPreview(data);
            setRows((data.rows || []).map(r => ({ ...r, selected: r.status === 'new', category_id: r.suggested_category_id || '', split_parts: null })));
        } catch (e) { showToast(e.response?.data?.message || 'Error al parsear CSV.', 'error'); }
        finally { setParsing(false); }
    };

    const handleConfirm = async () => {
        const toImport = rows.filter(r => r.selected && r.status !== 'duplicate');
        if (toImport.length === 0) return showToast('Sin filas seleccionadas.', 'error');
        setImporting(true);
        try {
            const res = await api.post('/accounting/import-csv/confirm', {
                file_name: 'wells_fargo_import.csv',
                rows: toImport.map(r => ({
                    date: r.date, description: r.description, amount: r.amount, type: r.type,
                    category_id: r.category_id || null,
                    worker_id: r.worker_id || null,
                    bank_reference: r.bank_reference || null,
                    split_parts: r.split_parts || null,
                })),
            });
            const out = res.data?.data || res.data || res;
            showToast(`${out.imported} transacciones importadas.`);
            setPreview(null); setRows([]); setCsvText('');
        } catch { showToast('Error al importar.', 'error'); }
        finally { setImporting(false); }
    };

    return (
        <div className="ac-tab-content">
            <div className="ac-import-header">
                <h3>📥 Importar CSV — Wells Fargo</h3>
                <p className="ac-import-sub">Formato: 5 columnas sin encabezados · Fecha, Monto, *, (vacío), Descripción</p>
            </div>

            {/* Drop zone */}
            <div className="ac-dropzone" onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current?.click()}>
                <Upload size={28} style={{ color: '#9CA3AF', marginBottom: 8 }} />
                <p>Arrastra tu CSV aquí o <span style={{ color: '#2A6C95', fontWeight: 700 }}>haz clic para subir</span></p>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>También puedes pegar el contenido del CSV abajo</p>
                <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            </div>

            <textarea className="ac-csv-paste" placeholder="O pega el contenido del CSV aquí..." value={csvText} onChange={e => setCsvText(e.target.value)} rows={5} />

            <button className="workers-btn-primary" style={{ marginBottom: 20 }} onClick={handlePreview} disabled={parsing || !csvText.trim()}>
                {parsing ? 'Analizando...' : 'Analizar CSV →'}
            </button>

            {/* Preview table */}
            {preview && (
                <>
                    <div className="ac-preview-summary">
                        <span>📋 {preview.total} filas</span>
                        <span className="ac-ok">✅ {preview.new} nuevas</span>
                        <span className="ac-dup">⚠️ {preview.duplicates} duplicadas</span>
                    </div>
                    <div className="inv-table-wrapper" style={{ marginBottom: 16 }}>
                        <table className="inv-list-table">
                            <thead><tr>
                                <th style={{ width: 32 }}><input type="checkbox" checked={rows.every(r => r.selected || r.status === 'duplicate')} onChange={e => setRows(p => p.map(r => r.status === 'duplicate' ? r : { ...r, selected: e.target.checked }))} /></th>
                                <th>Fecha</th><th>Descripción</th><th className="r">Monto</th><th>Tipo</th><th>Categoría</th><th>Sugerencia</th><th>Acción</th>
                            </tr></thead>
                            <tbody>
                                {rows.map((row, i) => (
                                    <tr key={i} className={`${row.status === 'duplicate' ? 'ac-dup-row' : ''} ${row.needs_split ? 'ac-split-row' : ''}`}>
                                        <td><input type="checkbox" checked={!!row.selected} disabled={row.status === 'duplicate'} onChange={e => setRows(p => p.map((r, j) => j === i ? { ...r, selected: e.target.checked } : r))} /></td>
                                        <td style={{ fontSize: 12 }}>{fmtDate(row.date)}</td>
                                        <td style={{ fontSize: 12, maxWidth: 200 }}>{row.description}</td>
                                        <td className="r" style={{ fontWeight: 700, color: row.type === 'income' ? '#10B981' : '#EF4444', fontSize: 12 }}>{row.type === 'income' ? '+' : '-'}{fmt$(row.amount)}</td>
                                        <td><span className={`ac-type-chip ac-type-chip--${row.type}`}>{row.type === 'income' ? '💵 IN' : '💸 OUT'}</span></td>
                                        <td>
                                            <div className="workers-select-wrapper" style={{ minWidth: 130 }}>
                                                <select className="ac-inline-cat-sel" value={row.category_id || ''} onChange={e => setRows(p => p.map((r, j) => j === i ? { ...r, category_id: e.target.value } : r))}>
                                                    <option value="">Sin categoría</option>
                                                    {categories.filter(c => c.type === row.type).map(c => <option key={c.id} value={c.id}>{c.name_es}</option>)}
                                                </select>
                                                <ChevronDown size={10} className="workers-select__arrow" />
                                            </div>
                                        </td>
                                        <td style={{ fontSize: 11 }}>
                                            {row.status === 'duplicate' && <span className="ac-dup-tag">❌ Dup</span>}
                                            {row.suggested_category_name && <span className="ac-sug-tag">🤖 {row.suggested_category_name}</span>}
                                            {row.needs_split && !row.split_parts && <span className="ac-split-tag">🔀 Split sugerido</span>}
                                            {row.split_parts && <span className="ac-done-tag">✅ Split listo</span>}
                                        </td>
                                        <td>
                                            {row.needs_split && (
                                                <button className="inv-row-btn" title="Dividir" onClick={() => setSplitRow({ row, i })}>🔀</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="workers-btn-outline" onClick={() => { setPreview(null); setRows([]); }}>Cancelar</button>
                        <button className="workers-btn-primary" onClick={handleConfirm} disabled={importing || rows.filter(r => r.selected && r.status !== 'duplicate').length === 0}>
                            {importing ? 'Importando...' : `Importar ${rows.filter(r => r.selected && r.status !== 'duplicate').length} transacciones`}
                        </button>
                    </div>
                </>
            )}

            {splitRow && (
                <SplitModal
                    row={splitRow.row}
                    categories={categories}
                    workers={workers}
                    onSplit={parts => setRows(p => p.map((r, j) => j === splitRow.i ? { ...r, split_parts: parts, needs_split: false } : r))}
                    onClose={() => setSplitRow(null)}
                />
            )}
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// TAB 4 — CATEGORIES
// ═════════════════════════════════════════════════════════════════════════════
function TabCategories({ categories, api, showToast, onCatsChanged }) {
    const [editCat, setEditCat] = useState(null);
    const [showNew, setShowNew] = useState(false);
    const [form, setForm] = useState({ name: '', name_es: '', type: 'expense', tax_deductible: true, tax_category: '' });

    const handleSave = async () => {
        try {
            if (editCat) { await api.put(`/accounting/categories/${editCat.id}`, form); showToast('Categoría actualizada.'); }
            else { await api.post('/accounting/categories', form); showToast('Categoría creada.'); }
            onCatsChanged(); setEditCat(null); setShowNew(false); setForm({ name: '', name_es: '', type: 'expense', tax_deductible: true, tax_category: '' });
        } catch { showToast('Error.', 'error'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Eliminar categoría?')) return;
        try { await api.delete(`/accounting/categories/${id}`); onCatsChanged(); showToast('Eliminada.'); }
        catch { showToast('Error.', 'error'); }
    };

    const income = categories.filter(c => c.type === 'income');
    const expense = categories.filter(c => c.type === 'expense');

    const CatTable = ({ cats, label }) => (
        <div className="ac-cat-section">
            <p className={`ac-cat-type-label ac-cat-type-label--${cats[0]?.type || 'expense'}`}>{label}</p>
            <table className="inv-list-table">
                <thead><tr><th>Nombre (EN)</th><th>Nombre (ES)</th><th>Tax Category</th><th>Deducible</th><th>Acciones</th></tr></thead>
                <tbody>
                    {cats.map(c => (
                        <tr key={c.id} className="inv-list-row">
                            <td><code style={{ fontSize: 11 }}>{c.name}</code></td>
                            <td>{c.name_es}</td>
                            <td style={{ fontSize: 11, color: '#6B7280' }}>{c.tax_category || '—'}</td>
                            <td>{c.tax_deductible ? <span style={{ color: '#10B981' }}>✅</span> : '—'}</td>
                            <td onClick={e => e.stopPropagation()}>
                                <div className="inv-row-actions">
                                    <button className="inv-row-btn" onClick={() => { setEditCat(c); setForm({ name: c.name, name_es: c.name_es, type: c.type, tax_deductible: c.tax_deductible, tax_category: c.tax_category || '' }); setShowNew(true); }}><Edit2 size={13} /></button>
                                    <button className="inv-row-btn" onClick={() => handleDelete(c.id)}><Trash2 size={13} /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="ac-tab-content">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button className="workers-btn-primary" onClick={() => { setEditCat(null); setForm({ name: '', name_es: '', type: 'expense', tax_deductible: true, tax_category: '' }); setShowNew(true); }}><Plus size={14} /> Nueva Categoría</button>
            </div>
            {income.length > 0 && <CatTable cats={income} label="💵 INGRESOS" />}
            {expense.length > 0 && <CatTable cats={expense} label="💸 GASTOS" />}

            {showNew && (
                <div className="workers-modal-overlay" onClick={() => setShowNew(false)}>
                    <div className="workers-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="workers-modal__header"><h2>{editCat ? 'Editar' : 'Nueva'} Categoría</h2><button className="workers-modal__close" onClick={() => setShowNew(false)}><X size={18} /></button></div>
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
    const [year, setYear] = useState(new Date().getFullYear());
    const [tax, setTax] = useState(null);
    const [r1099, setR1099] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const [taxRes, r1099Res] = await Promise.all([
                api.get(`/accounting/tax-summary?year=${year}`),
                api.get(`/accounting/1099-report?year=${year}`),
            ]);
            setTax(taxRes.data?.data || taxRes.data || taxRes);
            setR1099(r1099Res.data?.data || r1099Res.data || []);
        } catch { console.error('tax fetch failed'); }
        finally { setLoading(false); }
    }, [api, year]);

    useEffect(() => { fetch(); }, [fetch]);

    const exportTaxCSV = () => {
        if (!tax) return;
        const rows = [['Categoría', 'Monto'], ['INGRESOS BRUTOS', tax.total_income], ...tax.deductible_by_category.map(d => [d.label, d.amount]), ['TOTAL DEDUCIBLE', tax.total_deductible], ['INGRESO NETO GRAVABLE', tax.net_taxable], ['PER DIEM PASSTHROUGH', tax.per_diem_passthrough]];
        const csv = rows.map(r => r.join(',')).join('\n');
        const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = `tax_summary_${year}.csv`; a.click();
    };

    const export1099CSV = () => {
        if (!r1099.length) return;
        const rows = [['Worker', 'Código', 'Total Pagado', 'Necesita 1099'], ...r1099.map(w => [w.name, w.worker_code, w.total_paid, w.needs_1099 ? 'Sí' : 'No'])];
        const csv = rows.map(r => r.join(',')).join('\n');
        const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = `1099_report_${year}.csv`; a.click();
    };

    return (
        <div className="ac-tab-content">
            <div className="ac-period-bar">
                <label className="ac-period-label">Año fiscal:</label>
                <select className="ac-month-input" value={year} onChange={e => setYear(e.target.value)}>
                    {[2026, 2025, 2024].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button className="ac-refresh-btn" onClick={fetch}><RefreshCw size={13} /></button>
                {loading && <span className="ac-loading-txt">Cargando...</span>}
            </div>

            {tax && (
                <div className="ac-tax-box">
                    <div className="ac-tax-row ac-tax-row--head"><span>INGRESOS BRUTOS</span><span>{fmt$(tax.total_income)}</span></div>
                    <div className="ac-tax-section-label">GASTOS DEDUCIBLES</div>
                    {(tax.deductible_by_category || []).map((d, i) => (
                        <div key={i} className="ac-tax-row"><span>├── {d.label}</span><span>{fmt$(d.amount)}</span></div>
                    ))}
                    <div className="ac-tax-row ac-tax-row--sub"><span>TOTAL DEDUCIBLE</span><span className="ac-expense-txt">{fmt$(tax.total_deductible)}</span></div>
                    <div className="ac-tax-divider" />
                    <div className="ac-tax-row ac-tax-row--net"><span>INGRESO NETO GRAVABLE</span><span>{fmt$(tax.net_taxable)}</span></div>
                    <p className="ac-perdiem-note" style={{ marginTop: 8 }}>ℹ️ Per Diem passthrough ({fmt$(tax.per_diem_passthrough)}) — NO gravable</p>
                    <button className="workers-btn-outline" style={{ marginTop: 16, fontSize: 12 }} onClick={exportTaxCSV}><Download size={13} /> Exportar Tax Summary (CSV)</button>
                </div>
            )}

            {r1099.length > 0 && (
                <div className="ac-margins-box" style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <h3 className="ac-section-title" style={{ margin: 0 }}>📋 Reporte 1099 — {year}</h3>
                        <button className="workers-btn-outline" style={{ fontSize: 12 }} onClick={export1099CSV}><Download size={13} /> Exportar CSV</button>
                    </div>
                    <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>1099 requerido si se pagó más de $600 en el año fiscal.</p>
                    <table className="ac-margins-table">
                        <thead><tr><th>Worker</th><th>Código</th><th className="r">Total Pagado</th><th>Necesita 1099</th></tr></thead>
                        <tbody>
                            {r1099.map((w, i) => (
                                <tr key={i}>
                                    <td>{w.name}</td>
                                    <td><code>{w.worker_code}</code></td>
                                    <td className="r" style={{ fontWeight: 700 }}>{fmt$(w.total_paid)}</td>
                                    <td>{w.needs_1099 ? <span style={{ color: '#10B981', fontWeight: 700 }}>✅ Sí</span> : 'No'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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

            <div className="ts-header">
                <div>
                    <h1 className="ts-title">Contabilidad</h1>
                    <p className="ts-subtitle">P&L · Transacciones · CSV Import · Tax</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="ac-tabs">
                {TABS.map(tab => (
                    <button key={tab.id} className={`ac-tab ${activeTab === tab.id ? 'ac-tab--active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="ac-tab-panel">
                {activeTab === 'dashboard' && <TabDashboard api={api} />}
                {activeTab === 'transactions' && <TabTransactions api={api} categories={categories} workers={workers} clients={clients} showToast={showToast} />}
                {activeTab === 'import' && <TabImport api={api} categories={categories} workers={workers} showToast={showToast} />}
                {activeTab === 'categories' && <TabCategories categories={categories} api={api} showToast={showToast} onCatsChanged={loadCategories} />}
                {activeTab === 'tax' && <TabTax api={api} />}
            </div>
        </div>
    );
}
