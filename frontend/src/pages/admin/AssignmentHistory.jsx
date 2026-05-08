import { useState, useEffect, useCallback } from 'react';
import {
    Search, Filter, Calendar, User, FolderKanban,
    ChevronDown, X, Clock, CheckCircle2, XCircle, AlertCircle,
    Download, RefreshCw, Briefcase,
} from 'lucide-react';
import api from '../../utils/api';
import './AssignmentHistory.css';

// ─── Status config ──────────────────────────────────────────────────────────
const STATUS_CFG = {
    active:    { label: 'Activo',     cls: 'ah-badge--active' },
    completed: { label: 'Completado', cls: 'ah-badge--completed' },
    cancelled: { label: 'Cancelado',  cls: 'ah-badge--cancelled' },
};

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CFG[status] || STATUS_CFG.cancelled;
    return <span className={`ah-badge ${cfg.cls}`}>{cfg.label}</span>;
};

const StatusIcon = ({ status }) => {
    if (status === 'active')    return <CheckCircle2 size={14} style={{ color: '#10B981' }} />;
    if (status === 'completed') return <Clock size={14} style={{ color: '#2A6C95' }} />;
    return <XCircle size={14} style={{ color: '#EF4444' }} />;
};

// ─── Date helpers ───────────────────────────────────────────────────────────
const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('es-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
};

const calcDuration = (start, end) => {
    if (!start) return '—';
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const days = Math.round((e - s) / (1000 * 60 * 60 * 24));
    if (days < 1) return '< 1 día';
    if (days === 1) return '1 día';
    if (days < 30) return `${days} días`;
    const months = Math.floor(days / 30);
    return months === 1 ? '1 mes' : `${months} meses`;
};

// ─── KPI Card ───────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon: Icon, color }) => (
    <div className="ah-kpi" style={{ '--ah-kpi-color': color }}>
        <div className="ah-kpi__icon" style={{ background: `${color}18`, color }}>
            <Icon size={20} />
        </div>
        <div>
            <div className="ah-kpi__value">{value}</div>
            <div className="ah-kpi__label">{label}</div>
        </div>
    </div>
);

// ─── Main component ─────────────────────────────────────────────────────────
const AssignmentHistory = () => {
    const [assignments, setAssignments]   = useState([]);
    const [workers, setWorkers]           = useState([]);
    const [projects, setProjects]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [error, setError]               = useState(null);

    // Filters
    const [search, setSearch]             = useState('');
    const [filterWorker, setFilterWorker] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showFilters, setShowFilters]   = useState(false);

    // Editing inline status
    const [editingId, setEditingId]       = useState(null);
    const [editStatus, setEditStatus]     = useState('');
    const [editEndDate, setEditEndDate]   = useState('');
    const [editNotes, setEditNotes]       = useState('');
    const [saving, setSaving]             = useState(false);
    const [toast, setToast]               = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ── Load reference data ──────────────────────────────────────────────
    useEffect(() => {
        const loadRef = async () => {
            try {
                const [wRes, pRes] = await Promise.all([
                    api.get('/workers?status=active'),
                    api.get('/projects'),
                ]);
                setWorkers(wRes.data?.data || wRes.data || []);
                setProjects(pRes.data?.data || pRes.data || []);
            } catch { /* silencioso */ }
        };
        loadRef();
    }, []);

    // ── Load assignments ─────────────────────────────────────────────────
    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (filterWorker)  params.set('worker_id', filterWorker);
            if (filterProject) params.set('project_id', filterProject);
            if (filterStatus)  params.set('status', filterStatus);

            const res = await api.get(`/assignments?${params.toString()}`);
            setAssignments(res.data?.data || res.data || []);
        } catch {
            setError('No se pudo cargar el historial de asignaciones.');
        } finally {
            setLoading(false);
        }
    }, [filterWorker, filterProject, filterStatus]);

    useEffect(() => { load(); }, [load]);

    // ── Client-side search filter ────────────────────────────────────────
    const filtered = assignments.filter(a => {
        if (!search) return true;
        const q = search.toLowerCase();
        const workerName = `${a.worker?.first_name || ''} ${a.worker?.last_name || ''}`.toLowerCase();
        const projectName = (a.project?.name || '').toLowerCase();
        const code = (a.worker?.worker_code || '').toLowerCase();
        return workerName.includes(q) || projectName.includes(q) || code.includes(q);
    });

    // ── KPIs ─────────────────────────────────────────────────────────────
    const kpiTotal     = assignments.length;
    const kpiActive    = assignments.filter(a => a.status === 'active').length;
    const kpiCompleted = assignments.filter(a => a.status === 'completed').length;
    const kpiCancelled = assignments.filter(a => a.status === 'cancelled').length;

    // ── Edit assignment ──────────────────────────────────────────────────
    const startEdit = (a) => {
        setEditingId(a.id);
        setEditStatus(a.status);
        setEditEndDate(a.end_date || '');
        setEditNotes(a.notes || '');
    };

    const cancelEdit = () => { setEditingId(null); };

    const saveEdit = async (id) => {
        try {
            setSaving(true);
            await api.put(`/assignments/${id}`, {
                status: editStatus,
                end_date: editEndDate || null,
                notes: editNotes,
            });
            showToast('Asignación actualizada.');
            setEditingId(null);
            load();
        } catch {
            showToast('Error al actualizar.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const clearFilters = () => {
        setFilterWorker('');
        setFilterProject('');
        setFilterStatus('');
        setSearch('');
    };

    const hasFilters = filterWorker || filterProject || filterStatus;

    return (
        <div className="ah-page">
            {/* Toast */}
            {toast && (
                <div className={`ah-toast ${toast.type === 'error' ? 'ah-toast--error' : ''}`}>
                    {toast.type === 'error' ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="ah-header">
                <div className="ah-header__left">
                    <h1 className="ah-title">Historial de Asignaciones</h1>
                    <p className="ah-subtitle">Registro completo de asignaciones por worker y proyecto</p>
                </div>
                <div className="ah-header__right">
                    <button className="ah-btn ah-btn--ghost" onClick={load} title="Actualizar">
                        <RefreshCw size={15} />
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="ah-kpis">
                <KpiCard label="Total" value={kpiTotal} icon={Briefcase} color="#2A6C95" />
                <KpiCard label="Activas" value={kpiActive} icon={CheckCircle2} color="#10B981" />
                <KpiCard label="Completadas" value={kpiCompleted} icon={Clock} color="#F59E0B" />
                <KpiCard label="Canceladas" value={kpiCancelled} icon={XCircle} color="#EF4444" />
            </div>

            {/* Search + Filters */}
            <div className="ah-toolbar">
                <div className="ah-search-wrap">
                    <Search size={15} className="ah-search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por worker, proyecto o código..."
                        className="ah-search"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="ah-search-clear" onClick={() => setSearch('')}>
                            <X size={13} />
                        </button>
                    )}
                </div>

                <button
                    className={`ah-btn ah-btn--filter ${showFilters ? 'ah-btn--filter-active' : ''}`}
                    onClick={() => setShowFilters(p => !p)}
                >
                    <Filter size={15} />
                    Filtros
                    {hasFilters && <span className="ah-filter-badge" />}
                    <ChevronDown size={13} style={{ transform: showFilters ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
                </button>
            </div>

            {showFilters && (
                <div className="ah-filters">
                    <div className="ah-filter-group">
                        <label className="ah-filter-label">Worker</label>
                        <select
                            className="ah-select"
                            value={filterWorker}
                            onChange={e => setFilterWorker(e.target.value)}
                        >
                            <option value="">Todos los workers</option>
                            {workers.map(w => (
                                <option key={w.id} value={w.id}>
                                    {w.first_name} {w.last_name} ({w.worker_code})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="ah-filter-group">
                        <label className="ah-filter-label">Proyecto</label>
                        <select
                            className="ah-select"
                            value={filterProject}
                            onChange={e => setFilterProject(e.target.value)}
                        >
                            <option value="">Todos los proyectos</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="ah-filter-group">
                        <label className="ah-filter-label">Estado</label>
                        <select
                            className="ah-select"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="">Todos los estados</option>
                            <option value="active">Activo</option>
                            <option value="completed">Completado</option>
                            <option value="cancelled">Cancelado</option>
                        </select>
                    </div>

                    {hasFilters && (
                        <button className="ah-btn ah-btn--ghost ah-clear-filters" onClick={clearFilters}>
                            <X size={13} /> Limpiar filtros
                        </button>
                    )}
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="ah-loading">
                    <RefreshCw size={24} className="ah-spinning" />
                    <p>Cargando historial...</p>
                </div>
            ) : error ? (
                <div className="ah-error">
                    <AlertCircle size={24} />
                    <p>{error}</p>
                    <button className="ah-btn ah-btn--primary" onClick={load}>Reintentar</button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="ah-empty">
                    <Briefcase size={36} />
                    <p>{search || hasFilters ? 'Sin resultados para los filtros seleccionados.' : 'No hay asignaciones registradas.'}</p>
                    {(search || hasFilters) && (
                        <button className="ah-btn ah-btn--ghost" onClick={clearFilters}>
                            Limpiar filtros
                        </button>
                    )}
                </div>
            ) : (
                <div className="ah-table-wrap">
                    <table className="ah-table">
                        <thead>
                            <tr>
                                <th>Worker</th>
                                <th>Proyecto</th>
                                <th>Trade</th>
                                <th>Inicio</th>
                                <th>Fin</th>
                                <th>Duración</th>
                                <th>Estado</th>
                                <th>Notas</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(a => (
                                editingId === a.id ? (
                                    /* ── Inline edit row ── */
                                    <tr key={a.id} className="ah-row ah-row--editing">
                                        <td>
                                            <div className="ah-worker-cell">
                                                <div className="ah-worker-avatar">
                                                    {(a.worker?.first_name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="ah-worker-name">
                                                        {a.worker?.first_name} {a.worker?.last_name}
                                                    </div>
                                                    <div className="ah-worker-code">{a.worker?.worker_code}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="ah-project-name">{a.project?.name}</div>
                                            <div className="ah-project-addr">{a.project?.address}</div>
                                        </td>
                                        <td>{a.worker?.trade?.name || '—'}</td>
                                        <td>{fmtDate(a.start_date)}</td>
                                        <td>
                                            <input
                                                type="date"
                                                className="ah-inline-input"
                                                value={editEndDate}
                                                onChange={e => setEditEndDate(e.target.value)}
                                            />
                                        </td>
                                        <td>{calcDuration(a.start_date, editEndDate || a.end_date)}</td>
                                        <td>
                                            <select
                                                className="ah-inline-select"
                                                value={editStatus}
                                                onChange={e => setEditStatus(e.target.value)}
                                            >
                                                <option value="active">Activo</option>
                                                <option value="completed">Completado</option>
                                                <option value="cancelled">Cancelado</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="ah-inline-input"
                                                value={editNotes}
                                                onChange={e => setEditNotes(e.target.value)}
                                                placeholder="Notas..."
                                            />
                                        </td>
                                        <td>
                                            <div className="ah-actions">
                                                <button
                                                    className="ah-btn ah-btn--primary ah-btn--sm"
                                                    onClick={() => saveEdit(a.id)}
                                                    disabled={saving}
                                                >
                                                    {saving ? <RefreshCw size={12} className="ah-spinning" /> : 'Guardar'}
                                                </button>
                                                <button
                                                    className="ah-btn ah-btn--ghost ah-btn--sm"
                                                    onClick={cancelEdit}
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    /* ── Normal row ── */
                                    <tr key={a.id} className="ah-row">
                                        <td>
                                            <div className="ah-worker-cell">
                                                <div className="ah-worker-avatar">
                                                    {(a.worker?.first_name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="ah-worker-name">
                                                        {a.worker?.first_name} {a.worker?.last_name}
                                                    </div>
                                                    <div className="ah-worker-code">{a.worker?.worker_code}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="ah-project-name">{a.project?.name || '—'}</div>
                                            <div className="ah-project-addr">{a.project?.address || ''}</div>
                                        </td>
                                        <td>
                                            {a.worker?.trade ? (
                                                <span className="ah-trade-badge">
                                                    <Briefcase size={11} />
                                                    {a.worker.trade.name}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td>
                                            <div className="ah-date-cell">
                                                <Calendar size={12} />
                                                {fmtDate(a.start_date)}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="ah-date-cell">
                                                {a.end_date ? (
                                                    <><Calendar size={12} />{fmtDate(a.end_date)}</>
                                                ) : (
                                                    <span className="ah-ongoing">En curso</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="ah-duration">
                                                {calcDuration(a.start_date, a.end_date)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="ah-status-cell">
                                                <StatusIcon status={a.status} />
                                                <StatusBadge status={a.status} />
                                            </div>
                                        </td>
                                        <td>
                                            <span className="ah-notes" title={a.notes || ''}>
                                                {a.notes ? (a.notes.length > 30 ? a.notes.substring(0, 30) + '…' : a.notes) : '—'}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className="ah-btn ah-btn--ghost ah-btn--sm"
                                                onClick={() => startEdit(a)}
                                                title="Editar asignación"
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                )
                            ))}
                        </tbody>
                    </table>
                    <div className="ah-table-footer">
                        Mostrando {filtered.length} de {assignments.length} asignaciones
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssignmentHistory;
