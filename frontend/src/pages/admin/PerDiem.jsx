import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { Plus, X, ChevronDown, CheckCircle, AlertTriangle, Wallet } from 'lucide-react';
import useApi from '../../hooks/useApi';
import './PerDiem.css';

const fmtMoney = (n) =>
    `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_LABEL = {
    pending: 'Pendiente',
    paid: 'Pagado',
};

function StatusBadge({ status }) {
    const cls = status === 'paid' ? 'pd-badge--paid' : 'pd-badge--pending';
    return <span className={`pd-badge ${cls}`}>{STATUS_LABEL[status] || status}</span>;
}

const EMPTY_FORM = {
    worker_id: '',
    assignment_id: '',
    week_start_date: '',
    week_end_date: '',
    amount: '',
    description: '',
};

function CreatePerDiemModal({ workers, onClose, onCreated }) {
    const { get, post } = useApi();
    const [form, setForm] = useState(EMPTY_FORM);
    const [assignments, setAssignments] = useState([]);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const selectedWorkerId = form.worker_id;

    useEffect(() => {
        let cancelled = false;
        const loadAssignments = async () => {
            if (!selectedWorkerId) {
                setAssignments([]);
                return;
            }
            setLoadingAssignments(true);
            try {
                const res = await get(`/assignments?worker_id=${selectedWorkerId}`);
                const list = res.data || res;
                if (!cancelled) setAssignments(Array.isArray(list) ? list : []);
            } catch {
                if (!cancelled) setAssignments([]);
            } finally {
                if (!cancelled) setLoadingAssignments(false);
            }
        };
        loadAssignments();
        return () => { cancelled = true; };
    }, [get, selectedWorkerId]);

    const validate = () => {
        if (!form.worker_id) return 'Worker es requerido.';
        if (!form.assignment_id) return 'Asignación es requerida.';
        if (!form.week_start_date) return 'Fecha inicio de semana es requerida.';
        if (!form.week_end_date) return 'Fecha fin de semana es requerida.';
        if (!form.amount && form.amount !== 0) return 'Monto es requerido.';
        const amt = parseFloat(form.amount);
        if (Number.isNaN(amt) || amt <= 0) return 'Monto inválido.';
        if (form.week_end_date < form.week_start_date) return 'La fecha fin no puede ser menor que la fecha inicio.';
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
        <div className="pd-modal-overlay" onClick={onClose}>
            <div className="pd-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Crear Per Diem">
                <div className="pd-modal__header">
                    <h2 className="pd-modal__title"><Wallet size={16} /> Nuevo Per Diem</h2>
                    <button className="pd-modal__close" onClick={onClose} title="Cerrar"><X size={18} /></button>
                </div>

                <div className="pd-modal__body">
                    {error && (
                        <div className="pd-error">
                            <AlertTriangle size={15} />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="pd-field">
                        <label className="pd-label">Worker <span className="pd-required">*</span></label>
                        <div className="pd-select-wrap">
                            <select
                                className="pd-select"
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
                            <ChevronDown size={13} className="pd-select__arrow" />
                        </div>
                    </div>

                    <div className="pd-field">
                        <label className="pd-label">Asignación <span className="pd-required">*</span></label>
                        <div className="pd-select-wrap">
                            <select
                                className="pd-select"
                                value={form.assignment_id}
                                onChange={(e) => setForm((p) => ({ ...p, assignment_id: e.target.value }))}
                                disabled={!form.worker_id || loadingAssignments}
                            >
                                <option value="">
                                    {!form.worker_id ? 'Selecciona un worker primero...' : (loadingAssignments ? 'Cargando asignaciones...' : 'Selecciona una asignación...')
                                    }
                                </option>
                                {assignments.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.project?.name || `Proyecto #${a.project_id}`} — {a.status || '—'}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={13} className="pd-select__arrow" />
                        </div>
                    </div>

                    <div className="pd-grid-2">
                        <div className="pd-field">
                            <label className="pd-label">Inicio semana <span className="pd-required">*</span></label>
                            <input
                                className="pd-input"
                                type="date"
                                value={form.week_start_date}
                                onChange={(e) => setForm((p) => ({ ...p, week_start_date: e.target.value }))}
                            />
                        </div>
                        <div className="pd-field">
                            <label className="pd-label">Fin semana <span className="pd-required">*</span></label>
                            <input
                                className="pd-input"
                                type="date"
                                value={form.week_end_date}
                                onChange={(e) => setForm((p) => ({ ...p, week_end_date: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="pd-field">
                        <label className="pd-label">Monto ($) <span className="pd-required">*</span></label>
                        <input
                            className="pd-input"
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.amount}
                            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                            placeholder="0.00"
                        />
                    </div>

                    <div className="pd-field">
                        <label className="pd-label">Descripción (opcional)</label>
                        <input
                            className="pd-input"
                            value={form.description}
                            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            placeholder="Ej: Viáticos, gasolina, herramientas..."
                        />
                    </div>
                </div>

                <div className="pd-modal__footer">
                    <button className="pd-btn-outline" onClick={onClose}>Cancelar</button>
                    <button className="pd-btn-primary" onClick={handleCreate} disabled={saving}>
                        <Plus size={15} /> {saving ? 'Creando...' : 'Crear Per Diem'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default function PerDiem() {
    const { get, put } = useApi();
    const [perDiems, setPerDiems] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [filterWorker, setFilterWorker] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [createOpen, setCreateOpen] = useState(false);

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
            let url = '/per-diem';
            const params = [];
            if (filterWorker) params.push(`worker_id=${filterWorker}`);
            if (filterStatus) params.push(`status=${filterStatus}`);
            if (params.length) url += `?${params.join('&')}`;
            const res = await get(url);
            const list = res.data || res;
            setPerDiems(Array.isArray(list) ? list : []);
        } catch {
            setError('Error al cargar Per Diem.');
            setPerDiems([]);
        } finally {
            setLoading(false);
        }
    }, [get, filterWorker, filterStatus]);

    useEffect(() => { loadWorkers(); }, [loadWorkers]);
    useEffect(() => { loadPerDiems(); }, [loadPerDiems]);

    const kpis = useMemo(() => {
        const total = perDiems.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const pending = perDiems.filter(p => p.status === 'pending').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        const paid = perDiems.filter(p => p.status === 'paid').reduce((s, p) => s + parseFloat(p.amount || 0), 0);
        return { total, pending, paid };
    }, [perDiems]);

    const markPaid = async (pd) => {
        if (!window.confirm('¿Marcar este Per Diem como pagado? Esta acción requiere aprobación del admin.')) return;
        try {
            await put(`/per-diem/${pd.id}/paid`, {});
            await loadPerDiems();
        } catch {
            setError('Error al marcar pagado.');
        }
    };

    return (
        <div className="pd-page fade-in">
            <div className="pd-header">
                <div>
                    <h1 className="pd-title">Per Diem</h1>
                    <p className="pd-subtitle">Registra viáticos como passthrough entre cliente y contractor</p>
                </div>
                <button className="pd-btn-primary" onClick={() => setCreateOpen(true)}>
                    <Plus size={16} /> Nuevo Per Diem
                </button>
            </div>

            <div className="pd-notice">
                ℹ️ El Per Diem es un passthrough — NO afecta márgenes ni P&amp;L de la empresa. Es dinero del cliente que pasa directo al contractor.
            </div>

            <div className="pd-kpis">
                <div className="pd-kpi">
                    <p className="pd-kpi__label">TOTAL PER DIEM</p>
                    <p className="pd-kpi__value" style={{ color: '#2A6C95' }}>{fmtMoney(kpis.total)}</p>
                </div>
                <div className="pd-kpi">
                    <p className="pd-kpi__label">PENDIENTE DE PAGO</p>
                    <p className="pd-kpi__value" style={{ color: '#F59E0B' }}>{fmtMoney(kpis.pending)}</p>
                </div>
                <div className="pd-kpi">
                    <p className="pd-kpi__label">PAGADO</p>
                    <p className="pd-kpi__value" style={{ color: '#08543D' }}>{fmtMoney(kpis.paid)}</p>
                </div>
            </div>

            <div className="pd-filters">
                <div className="pd-select-wrap">
                    <select className="pd-select" value={filterWorker} onChange={(e) => setFilterWorker(e.target.value)}>
                        <option value="">Todos los Workers</option>
                        {workers.map((w) => (
                            <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>
                        ))}
                    </select>
                    <ChevronDown size={13} className="pd-select__arrow" />
                </div>
                <div className="pd-select-wrap">
                    <select className="pd-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="">Todos los estados</option>
                        <option value="pending">Pendiente</option>
                        <option value="paid">Pagado</option>
                    </select>
                    <ChevronDown size={13} className="pd-select__arrow" />
                </div>
            </div>

            {error && (
                <div className="pd-error pd-error--page">
                    <AlertTriangle size={15} />
                    <span>{error}</span>
                </div>
            )}

            {loading ? (
                <div className="pd-loading">Cargando Per Diem...</div>
            ) : perDiems.length === 0 ? (
                <div className="pd-empty">
                    <Wallet size={44} />
                    <p>Sin Per Diem para los filtros seleccionados.</p>
                    <button className="pd-btn-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> Crear el primero</button>
                </div>
            ) : (
                <div className="pd-table-card">
                    <div className="pd-table-wrap">
                        <table className="pd-table">
                            <thead>
                                <tr>
                                    <th>Worker</th>
                                    <th>Proyecto</th>
                                    <th>Semana</th>
                                    <th>Monto</th>
                                    <th>Descripción</th>
                                    <th>Estado</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {perDiems.map((pd) => {
                                    const workerName = `${pd.worker?.first_name || ''} ${pd.worker?.last_name || ''}`.trim() || '—';
                                    const workerCode = pd.worker?.worker_code || '';
                                    const projectName = pd.assignment?.project?.name || '—';
                                    const week = `${pd.week_start_date || '—'} → ${pd.week_end_date || '—'}`;
                                    return (
                                        <tr key={pd.id}>
                                            <td>
                                                <div className="pd-worker">
                                                    <div>
                                                        <div className="pd-worker__name">{workerName}</div>
                                                        {workerCode && <code className="pd-code">{workerCode}</code>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{projectName}</td>
                                            <td>{week}</td>
                                            <td><strong>{fmtMoney(pd.amount)}</strong></td>
                                            <td className="pd-desc">{pd.description || '—'}</td>
                                            <td><StatusBadge status={pd.status} /></td>
                                            <td>
                                                {pd.status === 'pending' ? (
                                                    <button className="pd-btn-paid" onClick={() => markPaid(pd)}>
                                                        <CheckCircle size={14} /> Marcar Pagado
                                                    </button>
                                                ) : (
                                                    <span className="pd-muted">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {createOpen && (
                <CreatePerDiemModal
                    workers={workers}
                    onClose={() => setCreateOpen(false)}
                    onCreated={loadPerDiems}
                />
            )}
        </div>
    );
}

