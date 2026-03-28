import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    DollarSign, Clock, Users, TrendingUp, ChevronDown, X,
    Plus, CheckCircle, AlertCircle, Zap, RefreshCw,
    ChevronRight, ChevronUp, Trash2, Edit2, Banknote
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import './Payroll.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt$ = v => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const DEDUCTION_CATEGORIES = [
    { value: 'gas', label: '⛽ Gasolina' },
    { value: 'tools', label: '🔧 Herramientas' },
    { value: 'equipment', label: '🏗️ Equipo' },
    { value: 'ppe', label: '🦺 PPE / Seguridad' },
    { value: 'advance', label: '💵 Adelanto' },
    { value: 'other', label: '📝 Otro' },
];

const PAYMENT_METHODS = [
    { value: 'zelle', label: '📱 Zelle' },
    { value: 'cash', label: '💵 Efectivo' },
    { value: 'check', label: '📄 Cheque' },
];

// ─── Week status config ──────────────────────────────────────────────────────
const WEEK_STATUS = {
    ungenerated: { label: 'Sin generar', cls: 'pw-week--ungened', dot: '⚠️' },
    pending: { label: 'Pendiente', cls: 'pw-week--pending', dot: '⏳' },
    approved: { label: 'Aprobada', cls: 'pw-week--pending', dot: '⏳' },
    partial: { label: 'Parcial', cls: 'pw-week--partial', dot: '🟡' },
    paid: { label: 'Pagada', cls: 'pw-week--paid', dot: '✅' },
};

// ─── Deduction Modal ─────────────────────────────────────────────────────────
function DeductionModal({ workerName, onAdd, onClose }) {
    const [form, setForm] = useState({ category: 'gas', description: '', amount: '', date: new Date().toISOString().split('T')[0] });
    const [err, setErr] = useState('');

    const handleAdd = () => {
        if (!form.amount || parseFloat(form.amount) <= 0) return setErr('El monto debe ser mayor a $0.');
        onAdd({ ...form, amount: parseFloat(parseFloat(form.amount).toFixed(2)) });
        onClose();
    };

    return (
        <div className="workers-modal-overlay" onClick={onClose}>
            <div className="workers-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                <div className="workers-modal__header">
                    <h2>➖ Agregar Deducción</h2>
                    <button className="workers-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="workers-modal__body">
                    <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>Worker: <strong style={{ color: '#111827' }}>{workerName}</strong></p>
                    {err && <div className="wf-error">{err}</div>}
                    <div className="wf-field">
                        <label className="wf-label">Concepto *</label>
                        <div className="workers-select-wrapper">
                            <select className="wf-select" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                {DEDUCTION_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <ChevronDown size={13} className="workers-select__arrow" />
                        </div>
                    </div>
                    <div className="wf-field">
                        <label className="wf-label">Monto * ($)</label>
                        <input className="wf-input" type="number" min="0.01" step="0.01" placeholder="0.00"
                            value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                    </div>
                    <div className="wf-field">
                        <label className="wf-label">Fecha</label>
                        <input className="wf-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div className="wf-field">
                        <label className="wf-label">Nota (opcional)</label>
                        <input className="wf-input" placeholder="Descripción..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                </div>
                <div className="workers-modal__footer">
                    <button className="workers-btn-outline" onClick={onClose}>Cancelar</button>
                    <button className="workers-btn-primary" onClick={handleAdd}>Agregar Deducción</button>
                </div>
            </div>
        </div>
    );
}

// ─── Worker Line Card ─────────────────────────────────────────────────────────
function WorkerCard({ line, weekLabel, api, showToast, onLineUpdated }) {
    const [expanded, setExpanded] = useState(line.status === 'pending');
    const [payForm, setPayForm] = useState({ payment_method: 'zelle', payment_reference: '', notes: '' });
    const [showDedModal, setShowDedModal] = useState(false);
    const [paying, setPaying] = useState(false);
    const [saving, setSaving] = useState(false);

    const worker = line.worker || {};
    const initials = `${worker.first_name?.[0] || ''}${worker.last_name?.[0] || ''}`.toUpperCase();
    const deductions = Array.isArray(line.deductions_detail) ? line.deductions_detail : [];

    const grossPay = parseFloat(line.gross_pay || 0);
    const perDiem = parseFloat(line.per_diem_amount || 0);
    const totalDedAmt = parseFloat(line.deductions || 0);
    const netPay = parseFloat(line.net_pay || 0);
    const transfer = parseFloat(line.total_to_transfer || 0);

    const addDeduction = async (d) => {
        const updated = [...deductions, d];
        setSaving(true);
        try {
            const res = await api.put(`/payroll/lines/${line.id}`, { deductions_detail: updated });
            onLineUpdated(res.data?.data || res.data || res);
            showToast('Deducción agregada.');
        } catch { showToast('Error al agregar deducción.', 'error'); }
        finally { setSaving(false); }
    };

    const removeDeduction = async (idx) => {
        const updated = deductions.filter((_, i) => i !== idx);
        setSaving(true);
        try {
            const res = await api.put(`/payroll/lines/${line.id}`, { deductions_detail: updated });
            onLineUpdated(res.data?.data || res.data || res);
            showToast('Deducción eliminada.');
        } catch { showToast('Error.', 'error'); }
        finally { setSaving(false); }
    };

    const handlePay = async () => {
        if (!payForm.payment_method) return;
        setPaying(true);
        try {
            const res = await api.patch(`/payroll/lines/${line.id}/pay`, payForm);
            onLineUpdated(res.data?.data || res.data || res);
            showToast(`${worker.first_name} ${worker.last_name} marcado como pagado.`);
        } catch { showToast('Error al marcar como pagado.', 'error'); }
        finally { setPaying(false); }
    };

    const isPaid = line.status === 'paid';

    return (
        <div className={`pw-worker-card ${isPaid ? 'pw-worker-card--paid' : ''}`}>
            {/* Collapsed (paid) header */}
            {isPaid && !expanded ? (
                <div className="pw-worker-paid-summary" onClick={() => setExpanded(true)}>
                    <div className="pw-worker-initials">{initials}</div>
                    <div className="pw-worker-paid-info">
                        <span className="pw-worker-name">{worker.first_name} {worker.last_name}</span>
                        <span className="pw-worker-code">{worker.worker_code}</span>
                    </div>
                    <div className="pw-worker-paid-tag">
                        <CheckCircle size={13} /> Pagado {fmt$(transfer)} vía {PAYMENT_METHODS.find(m => m.value === line.payment_method)?.label?.split(' ')[1] || line.payment_method} · {fmtDate(line.paid_at?.split('T')[0])}
                    </div>
                    <ChevronRight size={14} className="pw-expand-icon" />
                </div>
            ) : (
                <>
                    {/* Header */}
                    <div className="pw-worker-header">
                        <div className="pw-worker-avatar">{initials}</div>
                        <div className="pw-worker-info">
                            <span className="pw-worker-name">{worker.first_name} {worker.last_name}</span>
                            <span className="pw-worker-meta">
                                {worker.worker_code} · {worker.trade?.name || '—'} · {fmt$(worker.hourly_rate)}/hr
                            </span>
                            {line.project?.name && (
                                <span className="pw-worker-proj">📍 {line.project.name}</span>
                            )}
                        </div>
                        <div className="pw-worker-badge-col">
                            <span className={`pw-status-badge ${isPaid ? 'pw-status-badge--paid' : 'pw-status-badge--pending'}`}>
                                {isPaid ? <><CheckCircle size={11} /> Pagado</> : <><Clock size={11} /> Pendiente</>}
                            </span>
                            {isPaid && (
                                <button className="pw-collapse-btn" onClick={() => setExpanded(false)}>
                                    <ChevronUp size={13} /> Colapsar
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Breakdown */}
                    <div className="pw-breakdown">
                        <div className="pw-breakdown-row">
                            <span>Horas Regulares</span>
                            <span className="pw-calc">{parseFloat(line.regular_hours || 0).toFixed(2)} hrs × {fmt$(line.regular_rate)} =</span>
                            <span className="pw-amount">{fmt$(line.regular_pay)}</span>
                        </div>
                        {parseFloat(line.overtime_hours || 0) > 0 && (
                            <div className="pw-breakdown-row pw-ot-row">
                                <span>Horas Overtime</span>
                                <span className="pw-calc">{parseFloat(line.overtime_hours || 0).toFixed(2)} hrs × {fmt$(line.overtime_rate)} =</span>
                                <span className="pw-amount">{fmt$(line.overtime_pay)}</span>
                            </div>
                        )}
                        <div className="pw-breakdown-row pw-breakdown-row--subtotal">
                            <span>Salario Bruto</span>
                            <span></span>
                            <span className="pw-amount">{fmt$(grossPay)}</span>
                        </div>

                        {perDiem > 0 && (
                            <div className="pw-breakdown-row pw-perdiem-row">
                                <span>Per Diem (passthrough)</span>
                                <span></span>
                                <span className="pw-amount pw-perdiem-amt">+{fmt$(perDiem)}</span>
                            </div>
                        )}

                        {/* Deducciones */}
                        {deductions.length > 0 && (
                            <div className="pw-deductions">
                                <p className="pw-ded-header">Deducciones:</p>
                                {deductions.map((d, i) => (
                                    <div key={i} className="pw-ded-row">
                                        <span>{DEDUCTION_CATEGORIES.find(c => c.value === d.category)?.label || d.category}</span>
                                        {d.date && <span className="pw-ded-date">{fmtDate(d.date)}</span>}
                                        {d.description && <span className="pw-ded-desc">{d.description}</span>}
                                        <span className="pw-ded-amt">-{fmt$(d.amount)}</span>
                                        {!isPaid && (
                                            <button className="pw-ded-del" onClick={() => removeDeduction(i)} disabled={saving}>
                                                <Trash2 size={11} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <div className="pw-breakdown-row pw-breakdown-row--subtotal pw-ded-total-row">
                                    <span>Total deducciones</span><span></span>
                                    <span className="pw-amount pw-ded-total">-{fmt$(totalDedAmt)}</span>
                                </div>
                            </div>
                        )}

                        <hr className="pw-divider" />
                        <div className="pw-breakdown-row pw-total-row">
                            <span>💰 Neto a pagar</span>
                            <span className="pw-calc-small">Salario: {fmt$(netPay)}{perDiem > 0 ? ` + Per Diem: ${fmt$(perDiem)}` : ''}</span>
                            <span className="pw-total-amt">{fmt$(transfer)}</span>
                        </div>

                        {!isPaid && (
                            <button className="pw-add-ded-btn" onClick={() => setShowDedModal(true)} disabled={saving}>
                                <Plus size={12} /> Agregar deducción
                            </button>
                        )}
                    </div>

                    {/* Payment section – pending only */}
                    {!isPaid && (
                        <div className="pw-pay-section">
                            <div className="pw-pay-row">
                                <div className="wf-field" style={{ marginBottom: 0, flex: '0 0 160px' }}>
                                    <label className="wf-label">Método de pago</label>
                                    <div className="workers-select-wrapper">
                                        <select className="wf-select" value={payForm.payment_method} onChange={e => setPayForm(f => ({ ...f, payment_method: e.target.value }))}>
                                            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                        <ChevronDown size={11} className="workers-select__arrow" />
                                    </div>
                                </div>
                                <div className="wf-field" style={{ marginBottom: 0, flex: 1 }}>
                                    <label className="wf-label">Referencia / Confirmación</label>
                                    <input className="wf-input" placeholder="# Zelle, # Cheque..." value={payForm.payment_reference} onChange={e => setPayForm(f => ({ ...f, payment_reference: e.target.value }))} />
                                </div>
                                <div className="wf-field" style={{ marginBottom: 0, flex: 1 }}>
                                    <label className="wf-label">Notas</label>
                                    <input className="wf-input" placeholder="Opcional..." value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} />
                                </div>
                            </div>
                            <button className="pw-pay-btn" onClick={handlePay} disabled={paying}>
                                <DollarSign size={14} /> {paying ? 'Procesando...' : `Marcar como Pagado ${fmt$(transfer)}`}
                            </button>
                        </div>
                    )}

                    {/* Paid summary */}
                    {isPaid && (
                        <div className="pw-paid-summary-box">
                            <CheckCircle size={14} className="pw-paid-icon" />
                            Pagado {fmt$(transfer)} vía {PAYMENT_METHODS.find(m => m.value === line.payment_method)?.label?.split(' ')[1] || line.payment_method}
                            {line.payment_reference && ` · Ref: ${line.payment_reference}`}
                            {` · ${fmtDate(line.paid_at?.split?.('T')?.[0])}`}
                        </div>
                    )}
                </>
            )}

            {showDedModal && (
                <DeductionModal
                    workerName={`${worker.first_name} ${worker.last_name}`}
                    onAdd={addDeduction}
                    onClose={() => setShowDedModal(false)}
                />
            )}
        </div>
    );
}

// ─── Right Panel (Payroll Detail) ─────────────────────────────────────────────
function PayrollDetail({ week, api, showToast, onPayrollUpdated }) {
    const [payroll, setPayroll] = useState(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (!week) return;
        if (week.payroll_id) {
            setLoading(true);
            api.get(`/payroll/${week.payroll_id}`)
                .then(r => setPayroll(r.data?.data || r.data || r))
                .catch(() => showToast('Error al cargar nómina.', 'error'))
                .finally(() => setLoading(false));
        } else {
            setPayroll(null);
        }
    }, [week?.payroll_id]);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const res = await api.post('/payroll/generate', {
                week_start_date: week.week_start_date,
                week_end_date: week.week_end_date,
            });
            const newPayroll = res.data?.data || res.data || res;
            setPayroll(newPayroll);
            onPayrollUpdated({ ...week, payroll_id: newPayroll.id, status: 'pending' });
            showToast('Nómina generada.');
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al generar nómina.', 'error');
        } finally { setGenerating(false); }
    };

    const handleApprove = async () => {
        try {
            const res = await api.patch(`/payroll/${payroll.id}/status`, { status: 'approved' });
            const upd = res.data?.data || res.data || res;
            setPayroll(upd);
            onPayrollUpdated({ ...week, status: 'approved' });
            showToast('Nómina aprobada.');
        } catch { showToast('Error al aprobar.', 'error'); }
    };

    const handleLineUpdated = (updatedLine) => {
        setPayroll(prev => {
            if (!prev) return prev;
            const lines = (prev.lines || []).map(l => l.id === updatedLine.id ? updatedLine : l);
            const allPaid = lines.every(l => l.status === 'paid');
            const somePaid = lines.some(l => l.status === 'paid');
            const newStatus = allPaid ? 'paid' : somePaid ? 'partial' : prev.status;
            const upd = { ...prev, lines, status: newStatus };
            onPayrollUpdated({ ...week, status: newStatus });
            return upd;
        });
    };

    if (!week) return (
        <div className="pw-detail-placeholder">
            <Banknote size={48} style={{ color: '#D1D5DB', marginBottom: 12 }} />
            <p>Selecciona una semana del panel izquierdo</p>
        </div>
    );

    if (loading) return <div className="pw-detail-placeholder"><RefreshCw size={28} className="pw-spin" /><p>Cargando...</p></div>;

    if (!payroll) {
        // Ungenerated week
        return (
            <div className="pw-detail-ungened">
                <div className="pw-ungened-banner">
                    <AlertCircle size={18} style={{ color: '#F59E0B' }} />
                    <div>
                        <p className="pw-ungened-title">Semana sin nómina generada</p>
                        <p className="pw-ungened-sub">{week.entry_count} entradas aprobadas · {week.worker_count} workers</p>
                    </div>
                </div>
                <div className="pw-ungened-info">
                    <p>El sistema calculará automáticamente:</p>
                    <ul>
                        <li>Horas regulares ≤40h/semana × <strong>hourly_rate de cada worker</strong></li>
                        <li>Horas overtime &gt;40h × <strong>hourly_rate × 1.5</strong></li>
                        <li>Per Diem de <em>per_diem_entries</em> (passthrough)</li>
                    </ul>
                </div>
                <button className="pw-generate-big-btn" onClick={handleGenerate} disabled={generating}>
                    <Zap size={16} /> {generating ? 'Generando...' : 'Generar Nómina'}
                </button>
            </div>
        );
    }

    const lines = payroll.lines || [];
    const pending = lines.filter(l => l.status === 'pending');
    const paid = lines.filter(l => l.status === 'paid');

    return (
        <div className="pw-detail">
            {/* Detail header */}
            <div className="pw-detail-header">
                <div>
                    <h3 className="pw-detail-title">📋 Nómina: {week.label}</h3>
                    <p className="pw-detail-sub">{lines.length} workers · {fmt$(payroll.total_amount)} a transferir</p>
                </div>
                <div className="pw-detail-actions">
                    {['pending', 'approved'].includes(payroll.status) && lines.length > 0 && payroll.status !== 'approved' && (
                        <button className="workers-btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={handleApprove}>
                            <CheckCircle size={13} /> Aprobar nómina
                        </button>
                    )}
                    <span className={`pw-week-dot ${WEEK_STATUS[payroll.status]?.cls || ''}`}>
                        {WEEK_STATUS[payroll.status]?.dot} {WEEK_STATUS[payroll.status]?.label}
                    </span>
                </div>
            </div>

            {/* Totals bar */}
            <div className="pw-totals-bar">
                <div className="pw-totals-item">
                    <span>Salario Bruto</span>
                    <strong>{fmt$(payroll.total_gross)}</strong>
                </div>
                <div className="pw-totals-item">
                    <span>Deducciones</span>
                    <strong style={{ color: '#EF4444' }}>-{fmt$(payroll.total_deductions)}</strong>
                </div>
                <div className="pw-totals-item">
                    <span>Per Diem</span>
                    <strong style={{ color: '#6366F1' }}>+{fmt$(payroll.total_per_diem)}</strong>
                </div>
                <div className="pw-totals-item pw-totals-item--grand">
                    <span>Total a Transferir</span>
                    <strong>{fmt$(payroll.total_amount)}</strong>
                </div>
                <div className="pw-totals-item">
                    <span>Pendientes</span>
                    <strong style={{ color: '#F59E0B' }}>{pending.length} / {lines.length}</strong>
                </div>
            </div>

            {/* Worker cards */}
            <div className="pw-workers-list">
                {lines.map(line => (
                    <WorkerCard
                        key={line.id}
                        line={line}
                        weekLabel={week.label}
                        api={api}
                        showToast={showToast}
                        onLineUpdated={handleLineUpdated}
                    />
                ))}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Payroll() {
    const { user } = useAuth();
    const api = useApi();
    const { get } = api;

    const [weeks, setWeeks] = useState([]);
    const [stats, setStats] = useState({ pending_amount: '0.00', paid_this_week: '0.00', paid_this_month: '0.00', workers_pending: 0 });
    const [selWeek, setSelWeek] = useState(null);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3600);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [weeksRes, statsRes] = await Promise.all([
                get('/payroll/pending-weeks'),
                get('/payroll/stats'),
            ]);
            const ws = weeksRes.data?.data || weeksRes.data || weeksRes;
            setWeeks(Array.isArray(ws) ? ws : []);
            setStats(statsRes.data?.data || statsRes.data || { pending_amount: '0.00', paid_this_week: '0.00', paid_this_month: '0.00', workers_pending: 0 });
        } catch { showToast('Error al cargar datos.', 'error'); }
        finally { setLoading(false); }
    }, [get]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handlePayrollUpdated = (updatedWeek) => {
        setWeeks(prev => prev.map(w => w.week_start_date === updatedWeek.week_start_date ? { ...w, ...updatedWeek } : w));
        setSelWeek(prev => prev?.week_start_date === updatedWeek.week_start_date ? { ...prev, ...updatedWeek } : prev);
        fetchData(); // refresh stats
    };

    const STAT_CARDS = [
        { label: 'Pendiente de pago', value: fmt$(stats.pending_amount), icon: <AlertCircle size={18} />, color: '#EF4444' },
        { label: 'Pagado esta semana', value: fmt$(stats.paid_this_week), icon: <TrendingUp size={18} />, color: '#10B981' },
        { label: 'Pagado este mes', value: fmt$(stats.paid_this_month), icon: <DollarSign size={18} />, color: '#6366F1' },
        { label: 'Workers por pagar', value: stats.workers_pending, icon: <Users size={18} />, color: '#F59E0B' },
    ];

    return (
        <div className="pw-page fade-in">
            {/* Toast */}
            {toast && (
                <div className={`workers-toast workers-toast--${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={15} /> : <X size={15} />} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="ts-header">
                <div>
                    <h1 className="ts-title">Nómina</h1>
                    <p className="ts-subtitle">Gestión de pagos semanales a workers</p>
                </div>
                <button className="workers-btn-outline" onClick={fetchData}>
                    <RefreshCw size={14} /> Actualizar
                </button>
            </div>

            {/* Stat cards */}
            <div className="ts-stats-grid">
                {STAT_CARDS.map((s, i) => (
                    <div key={i} className="ts-stat-card">
                        <div className="ts-stat-card__icon" style={{ background: `${s.color}15`, color: s.color }}>{s.icon}</div>
                        <div>
                            <p className="ts-stat-card__value">{s.value}</p>
                            <p className="ts-stat-card__label">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Two-panel layout */}
            <div className="pw-panels">
                {/* Left panel – week list */}
                <div className="pw-left-panel">
                    <div className="pw-panel-title">
                        <Clock size={14} /> Semanas
                        {loading && <RefreshCw size={12} className="pw-spin" style={{ marginLeft: 6 }} />}
                    </div>

                    {weeks.length === 0 && !loading && (
                        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                            No hay semanas con horas aprobadas.
                        </div>
                    )}

                    {weeks.map(w => {
                        const cfg = WEEK_STATUS[w.status] || WEEK_STATUS.pending;
                        const isSelected = selWeek?.week_start_date === w.week_start_date;
                        return (
                            <div
                                key={w.week_start_date}
                                className={`pw-week-card ${cfg.cls} ${isSelected ? 'pw-week-card--sel' : ''}`}
                                onClick={() => setSelWeek(w)}
                            >
                                <div className="pw-week-top">
                                    <span className="pw-week-dot-icon">{cfg.dot}</span>
                                    <span className="pw-week-label">{w.label}</span>
                                    <span className="pw-week-badge">{cfg.label}</span>
                                </div>
                                <div className="pw-week-meta">
                                    <span><Users size={11} /> {w.worker_count} workers</span>
                                    {w.total_amount > 0 && <span>{fmt$(w.total_amount)}</span>}
                                </div>
                                {w.status === 'ungenerated' && (
                                    <p className="pw-week-hint">Haz click para generar nómina →</p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Right panel – payroll detail */}
                <div className="pw-right-panel">
                    <PayrollDetail
                        week={selWeek}
                        api={api}
                        showToast={showToast}
                        onPayrollUpdated={handlePayrollUpdated}
                    />
                </div>
            </div>
        </div>
    );
}
