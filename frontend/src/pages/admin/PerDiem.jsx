import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
    Plus, X, ChevronDown, ChevronUp, CheckCircle,
    AlertTriangle, Wallet, Search, Trash2, Eye,
    ArrowRight, Clock, DollarSign, Hash, Building2,
    Info, ChevronsUpDown,
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import './PerDiem.css';

/* ─── helpers ─────────────────────────────────────────────────────────── */
const fmt = (n) =>
    `$${parseFloat(n || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const initials = (first = '', last = '') =>
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';

const fmtDate = (d) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${m}/${day}/${y}`;
};

/* ─── StatusChip ───────────────────────────────────────────────────────── */
function StatusChip({ status }) {
    if (status === 'paid')
        return (
            <span className="pd-chip pd-chip--success">
                <CheckCircle size={10} /> Pagado
            </span>
        );
    return (
        <span className="pd-chip pd-chip--warning">
            <Clock size={10} /> Pendiente
        </span>
    );
}

/* ─── SortIcon ─────────────────────────────────────────────────────────── */
function SortIcon({ col, sortCol, sortDir }) {
    if (sortCol !== col) return <ChevronsUpDown size={12} />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
const EMPTY_FORM = {
    worker_id: '',
    assignment_id: '',
    week_start_date: '',
    week_end_date: '',
    amount: '',
    description: '',
};

function CreateModal({ workers, onClose, onCreated }) {
    const { get, post } = useApi();
    const [form, setForm] = useState(EMPTY_FORM);
    const [assignments, setAssignments] = useState([]);
    const [loadingA, setLoadingA] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        if (!form.worker_id) { setAssignments([]); return; }
        setLoadingA(true);
        get(`/assignments?worker_id=${form.worker_id}`)
            .then((res) => {
                const list = res.data || res;
                if (!cancelled) setAssignments(Array.isArray(list) ? list : []);
            })
            .catch(() => { if (!cancelled) setAssignments([]); })
            .finally(() => { if (!cancelled) setLoadingA(false); });
        return () => { cancelled = true; };
    }, [get, form.worker_id]);

    const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

    const validate = () => {
        if (!form.worker_id) return 'Worker es requerido.';
        if (!form.assignment_id) return 'Asignación es requerida.';
        if (!form.week_start_date) return 'Fecha de inicio de semana es requerida.';
        if (!form.week_end_date) return 'Fecha de fin de semana es requerida.';
        if (!form.amount) return 'Monto es requerido.';
        const amt = parseFloat(form.amount);
        if (Number.isNaN(amt) || amt <= 0) return 'Monto debe ser mayor a 0.';
        if (form.week_end_date < form.week_start_date) return 'La fecha fin no puede ser anterior a la de inicio.';
        return '';
    };

    const handleCreate = async () => {
        const msg = validate();
        if (msg) { setError(msg); return; }
        setSaving(true);
        setError('');
        try {
            await post('/per-diem', {
                worker_id: parseInt(form.worker_id, 10),
                assignment_id: parseInt(form.assignment_id, 10),
                week_start_date: form.week_start_date,
                week_end_date: form.week_end_date,
                amount: parseFloat(form.amount),
                description: form.description?.trim() || null,
            });
            onCreated();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al crear Per Diem.');
        } finally {
            setSaving(false);
        }
    };

    return ReactDOM.createPortal(
        <div className="pd-modal-backdrop" onClick={onClose}>
            <div
                className="pd-modal pd-modal--md"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-label="Crear Per Diem"
            >
                {/* ── Header ── */}
                <div className="pd-modal__header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: 'linear-gradient(135deg, #2A6C95, #08543D)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                        }}>
                            <Wallet size={20} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #111827)' }}>Nuevo Per Diem</h2>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #6B7280)' }}>Registro de viáticos y allowances</p>
                        </div>
                    </div>
                    <button className="pd-icon-btn" onClick={onClose} title="Cerrar"><X size={18} /></button>
                </div>

                {/* ── Body ── */}
                <div className="pd-modal__body">
                    <div className="pd-form">

                        {/* Error banner */}
                        {error && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '10px 14px', background: '#FEE2E2',
                                borderLeft: '3px solid #EF4444', borderRadius: 8,
                                color: '#991B1B', fontSize: 13,
                            }}>
                                <AlertTriangle size={15} /> {error}
                            </div>
                        )}

                        {/* Section: Asignación */}
                        <div className="pd-form__section">
                            <div className="pd-form__section-title">
                                <Building2 size={14} /> Asignación
                            </div>

                            {/* Worker */}
                            <div className="pd-field">
                                <label className="pd-field__label">
                                    Worker <span className="pd-field__req">*</span>
                                </label>
                                <select
                                    value={form.worker_id}
                                    onChange={(e) => setForm((p) => ({ ...p, worker_id: e.target.value, assignment_id: '' }))}
                                >
                                    <option value="">Selecciona un worker...</option>
                                    {workers.map((w) => (
                                        <option key={w.id} value={w.id}>
                                            {w.first_name} {w.last_name} ({w.worker_code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Asignación */}
                            <div className="pd-field">
                                <label className="pd-field__label">
                                    Asignación <span className="pd-field__req">*</span>
                                </label>
                                <select
                                    value={form.assignment_id}
                                    onChange={set('assignment_id')}
                                    disabled={!form.worker_id || loadingA}
                                >
                                    <option value="">
                                        {!form.worker_id
                                            ? 'Selecciona un worker primero...'
                                            : loadingA
                                            ? 'Cargando asignaciones...'
                                            : assignments.length === 0
                                            ? 'Sin asignaciones activas'
                                            : 'Selecciona una asignación...'}
                                    </option>
                                    {assignments.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.project?.name || `Proyecto #${a.project_id}`} — {a.status || '—'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Section: Semana */}
                        <div className="pd-form__section">
                            <div className="pd-form__section-title">
                                <Clock size={14} /> Semana de trabajo
                            </div>
                            <div className="pd-form__grid">
                                <div className="pd-field">
                                    <label className="pd-field__label">
                                        Inicio de semana <span className="pd-field__req">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={form.week_start_date}
                                        onChange={set('week_start_date')}
                                    />
                                </div>
                                <div className="pd-field">
                                    <label className="pd-field__label">
                                        Fin de semana <span className="pd-field__req">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={form.week_end_date}
                                        onChange={set('week_end_date')}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Monto */}
                        <div className="pd-form__section">
                            <div className="pd-form__section-title">
                                <DollarSign size={14} /> Monto y descripción
                            </div>
                            <div className="pd-field">
                                <label className="pd-field__label">
                                    Monto ($) <span className="pd-field__req">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="0.00"
                                    value={form.amount}
                                    onChange={set('amount')}
                                />
                            </div>
                            <div className="pd-field">
                                <label className="pd-field__label">
                                    Descripción{' '}
                                    <span style={{ color: '#9CA3AF', fontSize: 11, fontWeight: 400 }}>(opcional)</span>
                                </label>
                                <textarea
                                    placeholder="Ej: Viáticos, gasolina, herramientas..."
                                    value={form.description}
                                    onChange={set('description')}
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="pd-modal__actions">
                            <button className="pd-btn pd-btn--ghost" onClick={onClose}>Cancelar</button>
                            <button className="pd-btn pd-btn--primary" onClick={handleCreate} disabled={saving}>
                                <Plus size={15} /> {saving ? 'Creando...' : 'Crear Per Diem'}
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DETAIL MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
function DetailModal({ pd, onClose, onMarkPaid, markingId }) {
    const workerName = `${pd.worker?.first_name || ''} ${pd.worker?.last_name || ''}`.trim() || '—';
    const workerCode = pd.worker?.worker_code || '';
    const projectName = pd.assignment?.project?.name || '—';
    const isPaid = pd.status === 'paid';

    return ReactDOM.createPortal(
        <div className="pd-modal-backdrop" onClick={onClose}>
            <div className="pd-modal pd-modal--lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Detalle Per Diem">
                <div className="pd-modal__header">
                    <div className="hmcs-modal-identity">
                        <div className="hmcs-modal-identity__avatar-wrap">
                            <div className="hmcs-modal-identity__avatar">
                                {workerName !== '—'
                                    ? initials(pd.worker?.first_name, pd.worker?.last_name)
                                    : <Wallet size={24} />
                                }
                            </div>
                        </div>
                        <div className="hmcs-modal-identity__text">
                            <h2 className="hmcs-modal-identity__name">{workerName}</h2>
                            <div className="hmcs-modal-identity__meta">
                                <span className="hmcs-modal-identity__meta-code">PD-{pd.id}</span>
                                <span className="hmcs-modal-identity__dot">•</span>
                                <span>{projectName}</span>
                            </div>
                        </div>
                    </div>
                    <button className="pd-icon-btn" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="pd-modal__body">
                    <div className="pd-detail">
                        {/* Hero amount */}
                        <div className="pd-detail__hero">
                            <div className="pd-detail__amount-label">Monto Per Diem</div>
                            <div className="pd-detail__amount">{fmt(pd.amount)}</div>
                            <StatusChip status={pd.status} />
                        </div>

                        {/* Traceability flow */}
                        <div className="pd-detail__section">
                            <h4>Flujo de trazabilidad</h4>
                            <div className="pd-flow">
                                <div className="pd-flow__step pd-flow__step--done">
                                    <div className="pd-flow__icon"><DollarSign size={20} /></div>
                                    <div className="pd-flow__label">Registrado</div>
                                    <div className="pd-flow__status">Creado</div>
                                    <div className="pd-flow__date">{fmtDate(pd.createdAt?.slice(0, 10))}</div>
                                </div>
                                <div className="pd-flow__arrow"><ArrowRight size={18} /></div>
                                <div className={`pd-flow__step pd-flow__step--${isPaid ? 'done' : 'pending'}`}>
                                    <div className="pd-flow__icon"><Hash size={20} /></div>
                                    <div className="pd-flow__label">Incluido en Payroll</div>
                                    <div className="pd-flow__status">{isPaid ? 'Incluido' : 'Pendiente'}</div>
                                    <div className="pd-flow__date">—</div>
                                </div>
                                <div className="pd-flow__arrow"><ArrowRight size={18} /></div>
                                <div className={`pd-flow__step pd-flow__step--${isPaid ? 'done' : 'pending'}`}>
                                    <div className="pd-flow__icon"><CheckCircle size={20} /></div>
                                    <div className="pd-flow__label">Pagado</div>
                                    <div className="pd-flow__status">{isPaid ? 'Completado' : 'No pagado'}</div>
                                    <div className="pd-flow__date">{isPaid ? fmtDate(pd.updatedAt?.slice(0, 10)) : '—'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Info grid */}
                        <div className="pd-detail__section">
                            <h4>Información</h4>
                            <div className="pd-detail__grid">
                                <div className="pd-info-item">
                                    <div className="pd-info-item__label">Worker</div>
                                    <div className="pd-info-item__value">{workerName}</div>
                                    {workerCode && <div className="pd-info-item__sub">{workerCode}</div>}
                                </div>
                                <div className="pd-info-item">
                                    <div className="pd-info-item__label">Proyecto</div>
                                    <div className="pd-info-item__value">{projectName}</div>
                                </div>
                                <div className="pd-info-item">
                                    <div className="pd-info-item__label">Semana</div>
                                    <div className="pd-info-item__value">{fmtDate(pd.week_start_date)}</div>
                                    <div className="pd-info-item__sub">→ {fmtDate(pd.week_end_date)}</div>
                                </div>
                                <div className="pd-info-item">
                                    <div className="pd-info-item__label">Monto</div>
                                    <div className="pd-info-item__value" style={{ color: '#2A6C95' }}>{fmt(pd.amount)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        {pd.description && (
                            <div className="pd-detail__section">
                                <h4>Descripción</h4>
                                <p className="pd-detail__notes">{pd.description}</p>
                            </div>
                        )}

                        <div className="pd-modal__actions">
                            <button className="pd-btn pd-btn--ghost" onClick={onClose}>Cerrar</button>
                            {!isPaid && (
                                <button
                                    className="pd-btn pd-btn--success"
                                    onClick={() => onMarkPaid(pd)}
                                    disabled={markingId === pd.id}
                                >
                                    <CheckCircle size={15} />
                                    {markingId === pd.id ? 'Procesando...' : 'Marcar como Pagado'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DELETE CONFIRM MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
function DeleteModal({ pd, onClose, onConfirm, deleting }) {
    return ReactDOM.createPortal(
        <div className="pd-modal-backdrop" onClick={onClose}>
            <div className="pd-modal pd-modal--sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Confirmar eliminación">
                <div className="pd-modal__header">
                    <h2>Eliminar Per Diem</h2>
                    <button className="pd-icon-btn" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="pd-modal__body">
                    <div className="pd-confirm">
                        <div className="pd-confirm__icon">
                            <Trash2 size={32} />
                        </div>
                        <p>
                            ¿Eliminar el Per Diem de <strong>{pd.worker?.first_name} {pd.worker?.last_name}</strong> por <strong>{fmt(pd.amount)}</strong>?
                        </p>
                        <p style={{ fontSize: 13, color: '#6B7280' }}>Esta acción no se puede deshacer.</p>
                    </div>
                    <div className="pd-modal__actions">
                        <button className="pd-btn pd-btn--ghost" onClick={onClose}>Cancelar</button>
                        <button className="pd-btn pd-btn--danger" onClick={() => onConfirm(pd)} disabled={deleting}>
                            <Trash2 size={14} /> {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function PerDiem() {
    const { get, put, del } = useApi();
    const [perDiems, setPerDiems] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /* filters */
    const [search, setSearch] = useState('');
    const [filterWorker, setFilterWorker] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    /* sort */
    const [sortCol, setSortCol] = useState('week_start_date');
    const [sortDir, setSortDir] = useState('desc');

    /* menus */
    const [openMenuId, setOpenMenuId] = useState(null);
    const menuRef = useRef(null);

    /* modals */
    const [createOpen, setCreateOpen] = useState(false);
    const [detailPd, setDetailPd] = useState(null);
    const [deletePd, setDeletePd] = useState(null);
    const [markingId, setMarkingId] = useState(null);
    const [deleting, setDeleting] = useState(false);

    /* ── data load ────────────────────────────────────────────────── */
    const loadWorkers = useCallback(async () => {
        try {
            const res = await get('/workers');
            const list = res.data || res;
            setWorkers(Array.isArray(list) ? list : []);
        } catch {
            setWorkers([]);
        }
    }, [get]);

    const loadPerDiems = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = [];
            if (filterWorker) params.push(`worker_id=${filterWorker}`);
            if (filterStatus) params.push(`status=${filterStatus}`);
            const url = `/per-diem${params.length ? `?${params.join('&')}` : ''}`;
            const res = await get(url);
            const list = res.data || res;
            setPerDiems(Array.isArray(list) ? list : []);
        } catch {
            setError('Error al cargar los Per Diem.');
            setPerDiems([]);
        } finally {
            setLoading(false);
        }
    }, [get, filterWorker, filterStatus]);

    useEffect(() => { loadWorkers(); }, [loadWorkers]);
    useEffect(() => { loadPerDiems(); }, [loadPerDiems]);

    /* close menu on outside click */
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /* ── KPIs ─────────────────────────────────────────────────────── */
    const kpis = useMemo(() => {
        const total = perDiems.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const pending = perDiems.filter((p) => p.status === 'pending').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const paid = perDiems.filter((p) => p.status === 'paid').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const count = perDiems.length;
        return { total, pending, paid, count };
    }, [perDiems]);

    /* ── client-side filter + sort ────────────────────────────────── */
    const visible = useMemo(() => {
        let list = [...perDiems];
        if (search) {
            const q = search.toLowerCase();
            list = list.filter((p) => {
                const wName = `${p.worker?.first_name || ''} ${p.worker?.last_name || ''}`.toLowerCase();
                const proj = (p.assignment?.project?.name || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                return wName.includes(q) || proj.includes(q) || desc.includes(q) || String(p.amount).includes(q);
            });
        }
        if (dateFrom) list = list.filter((p) => p.week_start_date >= dateFrom);
        if (dateTo) list = list.filter((p) => p.week_end_date <= dateTo);
        list.sort((a, b) => {
            let va, vb;
            if (sortCol === 'amount') { va = parseFloat(a.amount); vb = parseFloat(b.amount); }
            else if (sortCol === 'worker') {
                va = `${a.worker?.last_name || ''}`.toLowerCase();
                vb = `${b.worker?.last_name || ''}`.toLowerCase();
            } else {
                va = a[sortCol] || '';
                vb = b[sortCol] || '';
            }
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [perDiems, search, dateFrom, dateTo, sortCol, sortDir]);

    const toggleSort = (col) => {
        if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortCol(col); setSortDir('asc'); }
    };

    /* ── actions ──────────────────────────────────────────────────── */
    const markPaid = async (pd) => {
        setMarkingId(pd.id);
        try {
            await put(`/per-diem/${pd.id}/paid`, {});
            await loadPerDiems();
            if (detailPd?.id === pd.id) setDetailPd(null);
        } catch {
            setError('Error al marcar como pagado.');
        } finally {
            setMarkingId(null);
        }
    };

    const handleDelete = async (pd) => {
        setDeleting(true);
        try {
            await del(`/per-diem/${pd.id}`);
            setDeletePd(null);
            await loadPerDiems();
        } catch {
            setError('Error al eliminar el Per Diem.');
        } finally {
            setDeleting(false);
        }
    };

    /* ── render ───────────────────────────────────────────────────── */
    return (
        <div className="pd-page">
            {/* ── Header ── */}
            <div className="pd-header">
                <div className="pd-title-row">
                    <div className="pd-icon-badge"><Wallet size={24} /></div>
                    <div>
                        <h1 className="pd-title">Per Diem</h1>
                        <p className="pd-subtitle">Viáticos como passthrough — no afectan P&L de la empresa</p>
                    </div>
                </div>
                <div className="pd-header__right">
                    <button className="pd-btn pd-btn--primary" onClick={() => setCreateOpen(true)}>
                        <Plus size={16} /> Nuevo Per Diem
                    </button>
                </div>
            </div>

            {/* ── Info banner ── */}
            <div className="pd-banner">
                <Info size={16} className="pd-banner__icon" />
                <span>
                    El Per Diem es un <strong>passthrough</strong>: es dinero del cliente que pasa directo al contractor.
                    No afecta márgenes ni P&amp;L de la empresa y se incluye automáticamente en el Payroll de la semana correspondiente.
                </span>
            </div>

            {/* ── KPIs ── */}
            <div className="pd-kpis">
                <div className="pd-kpi pd-kpi--blue">
                    <div className="pd-kpi__icon"><DollarSign size={22} /></div>
                    <div className="pd-kpi__body">
                        <div className="pd-kpi__label">Total Per Diem</div>
                        <div className="pd-kpi__value">{fmt(kpis.total)}</div>
                    </div>
                </div>
                <div className="pd-kpi pd-kpi--amber">
                    <div className="pd-kpi__icon"><Clock size={22} /></div>
                    <div className="pd-kpi__body">
                        <div className="pd-kpi__label">Pendiente</div>
                        <div className="pd-kpi__value">{fmt(kpis.pending)}</div>
                    </div>
                </div>
                <div className="pd-kpi pd-kpi--green">
                    <div className="pd-kpi__icon"><CheckCircle size={22} /></div>
                    <div className="pd-kpi__body">
                        <div className="pd-kpi__label">Pagado</div>
                        <div className="pd-kpi__value">{fmt(kpis.paid)}</div>
                    </div>
                </div>
                <div className="pd-kpi pd-kpi--slate">
                    <div className="pd-kpi__icon"><Hash size={22} /></div>
                    <div className="pd-kpi__body">
                        <div className="pd-kpi__label">Registros</div>
                        <div className="pd-kpi__value">{kpis.count}</div>
                    </div>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="pd-filters">
                <div className="pd-search">
                    <Search size={16} />
                    <input
                        placeholder="Buscar por worker, proyecto o descripción..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="pd-filters__row">
                    <select className="pd-select" value={filterWorker} onChange={(e) => setFilterWorker(e.target.value)}>
                        <option value="">Todos los workers</option>
                        {workers.map((w) => (
                            <option key={w.id} value={w.id}>
                                {w.first_name} {w.last_name}
                            </option>
                        ))}
                    </select>
                    <select className="pd-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="">Todos los estados</option>
                        <option value="pending">Pendiente</option>
                        <option value="paid">Pagado</option>
                    </select>
                    <div className="pd-date-range">
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Desde" />
                        <span>→</span>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Hasta" />
                    </div>
                    {(search || filterWorker || filterStatus || dateFrom || dateTo) && (
                        <button
                            className="pd-btn pd-btn--link pd-btn--sm"
                            onClick={() => { setSearch(''); setFilterWorker(''); setFilterStatus(''); setDateFrom(''); setDateTo(''); }}
                        >
                            Limpiar filtros
                        </button>
                    )}
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FEE2E2', borderLeft: '3px solid #EF4444', borderRadius: 8, color: '#991B1B', fontSize: 13, marginBottom: 16 }}>
                    <AlertTriangle size={15} />{error}
                </div>
            )}

            {/* ── Table ── */}
            {loading ? (
                <div className="pd-empty">
                    <div className="pd-spinner" />
                    <p>Cargando Per Diem...</p>
                </div>
            ) : visible.length === 0 ? (
                <div className="pd-card">
                    <div className="pd-empty">
                        <Wallet size={48} />
                        <h3>{perDiems.length === 0 ? 'Sin Per Diem registrados' : 'Sin resultados'}</h3>
                        <p>
                            {perDiems.length === 0
                                ? 'Crea el primer Per Diem para este período.'
                                : 'Ajusta los filtros para ver más registros.'}
                        </p>
                        {perDiems.length === 0 && (
                            <button className="pd-btn pd-btn--primary" onClick={() => setCreateOpen(true)}>
                                <Plus size={15} /> Crear el primero
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="pd-card">
                    <div className="pd-table-wrap">
                        <table className="pd-table">
                            <thead>
                                <tr>
                                    <th
                                        className={`pd-th--sortable ${sortCol === 'worker' ? 'pd-th--active' : ''}`}
                                        onClick={() => toggleSort('worker')}
                                    >
                                        <span>Worker <SortIcon col="worker" sortCol={sortCol} sortDir={sortDir} /></span>
                                    </th>
                                    <th>Proyecto</th>
                                    <th
                                        className={`pd-th--sortable ${sortCol === 'week_start_date' ? 'pd-th--active' : ''}`}
                                        onClick={() => toggleSort('week_start_date')}
                                    >
                                        <span>Semana <SortIcon col="week_start_date" sortCol={sortCol} sortDir={sortDir} /></span>
                                    </th>
                                    <th
                                        className={`pd-th--sortable pd-th--right ${sortCol === 'amount' ? 'pd-th--active' : ''}`}
                                        onClick={() => toggleSort('amount')}
                                    >
                                        <span>Monto <SortIcon col="amount" sortCol={sortCol} sortDir={sortDir} /></span>
                                    </th>
                                    <th>Descripción</th>
                                    <th>Estado</th>
                                    <th className="pd-th-actions">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((pd) => {
                                    const wFirst = pd.worker?.first_name || '';
                                    const wLast = pd.worker?.last_name || '';
                                    const workerName = `${wFirst} ${wLast}`.trim() || '—';
                                    const workerCode = pd.worker?.worker_code || '';
                                    const projectName = pd.assignment?.project?.name || '—';

                                    return (
                                        <tr key={pd.id} className="pd-row">
                                            {/* Worker */}
                                            <td>
                                                <div className="pd-worker-cell">
                                                    <div className="pd-avatar">{initials(wFirst, wLast)}</div>
                                                    <div>
                                                        <div className="pd-worker-name">{workerName}</div>
                                                        {workerCode && <div className="pd-worker-code">{workerCode}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Project */}
                                            <td>
                                                <span className="pd-project-cell">
                                                    <Building2 size={13} /> {projectName}
                                                </span>
                                            </td>
                                            {/* Week */}
                                            <td className="pd-week-cell">
                                                {fmtDate(pd.week_start_date)}<br />
                                                <span style={{ color: '#9CA3AF', fontSize: 12 }}>→ {fmtDate(pd.week_end_date)}</span>
                                            </td>
                                            {/* Amount */}
                                            <td className="pd-amount-cell">{fmt(pd.amount)}</td>
                                            {/* Description */}
                                            <td className="pd-desc-cell">
                                                {pd.description
                                                    ? <span title={pd.description}>{pd.description}</span>
                                                    : <span className="pd-muted">Sin descripción</span>}
                                            </td>
                                            {/* Status */}
                                            <td><StatusChip status={pd.status} /></td>
                                            {/* Actions */}
                                            <td className="pd-actions-cell">
                                                <div className="pd-actions">
                                                    <button
                                                        className="pd-icon-btn"
                                                        title="Ver detalle"
                                                        onClick={() => setDetailPd(pd)}
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                    {pd.status === 'pending' && (
                                                        <button
                                                            className="pd-btn pd-btn--success pd-btn--sm"
                                                            title="Marcar pagado"
                                                            onClick={() => markPaid(pd)}
                                                            disabled={markingId === pd.id}
                                                        >
                                                            <CheckCircle size={13} />
                                                            {markingId === pd.id ? '...' : 'Pagar'}
                                                        </button>
                                                    )}
                                                    <button
                                                        className="pd-icon-btn"
                                                        title="Eliminar"
                                                        style={{ color: '#EF4444' }}
                                                        onClick={() => setDeletePd(pd)}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="pd-footer-bar">
                        <span>
                            Mostrando <strong>{visible.length}</strong> de <strong>{perDiems.length}</strong> registros
                        </span>
                        <span>
                            Total visible: <strong>{fmt(visible.reduce((s, p) => s + parseFloat(p.amount || 0), 0))}</strong>
                        </span>
                    </div>
                </div>
            )}

            {/* ── Modals ── */}
            {createOpen && (
                <CreateModal
                    workers={workers}
                    onClose={() => setCreateOpen(false)}
                    onCreated={loadPerDiems}
                />
            )}
            {detailPd && (
                <DetailModal
                    pd={detailPd}
                    onClose={() => setDetailPd(null)}
                    onMarkPaid={markPaid}
                    markingId={markingId}
                />
            )}
            {deletePd && (
                <DeleteModal
                    pd={deletePd}
                    onClose={() => setDeletePd(null)}
                    onConfirm={handleDelete}
                    deleting={deleting}
                />
            )}
        </div>
    );
}
