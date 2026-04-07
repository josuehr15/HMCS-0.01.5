import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
    ChevronLeft, ChevronRight, Plus, X, CheckCircle, Check,
    Flag, XCircle, Clock, AlertCircle, Edit2, Trash2,
    Calendar, Navigation, Shield, User, Building2,
    Save, Filter
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import './Timesheets.css';

// ─── Helpers ────────────────────────────────────────────────────────────────────
const avatarColor = (name = '') => {
  const colors = [
    { bg: '#E6F1FB', color: '#0C447C' },
    { bg: '#E1F5EE', color: '#085041' },
    { bg: '#FAEEDA', color: '#633806' },
    { bg: '#EEEDFE', color: '#3C3489' },
    { bg: '#FCEBEB', color: '#791F1F' },
    { bg: '#E1F5EE', color: '#08543D' },
  ];
  const idx = (name.charCodeAt(0) || 0) % colors.length;
  return colors[idx];
};

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function fmt12(date) {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtDate(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function workerInitials(w) {
    if (!w) return '?';
    return `${w.first_name?.[0] || ''}${w.last_name?.[0] || ''}`.toUpperCase();
}

function toYMD(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonday(d) {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(dt.setDate(diff));
}

// ─── Component: Status Chip ─────────────────────────────────────────────────────
function StatusChip({ entry, onClick }) {
    let cls = 'ts-chip--live';
    let icon = <span className="ts-pulse" />;
    let text = 'En vivo';

    if (entry.clock_out) {
        if (entry.status === 'pending') {
            cls = 'ts-chip--pending';
            icon = null;
        } else if (entry.status === 'approved') {
            cls = 'ts-chip--approved';
            icon = null;
        } else if (entry.status === 'flagged') {
            cls = 'ts-chip--flagged';
            icon = <Flag size={10} />;
        } else if (entry.status === 'rejected') {
            cls = 'ts-chip--rejected';
            icon = <XCircle size={10} />;
        }
        text = entry.total_hours ? `${parseFloat(entry.total_hours).toFixed(1)}h` : '—';
    }

    return (
        <button className={`ts-chip ${cls}`} onClick={(e) => { e.stopPropagation(); onClick(entry); }} title={`${fmt12(entry.clock_in)} - ${entry.clock_out ? fmt12(entry.clock_out) : '...'}`}>
            {icon}
            <span>{text}</span>
            {entry.is_manual_entry && <span className="ts-chip-manual-dot" title="Entrada manual" />}
        </button>
    );
}

// ─── Component: Drawer (Edit / Details) ─────────────────────────────────────────
function EntryDrawer({ entry, mode, defaultDate, worker, projects, api, showToast, onClose, onRefresh }) {
    const { post, put, del, patch } = api;

    const isCreate = mode === 'create';
    const [form, setForm] = useState({
        project_id: entry?.project_id || '',
        date: entry?.clock_in ? toYMD(entry.clock_in) : (defaultDate || toYMD(new Date())),
        time_in: entry?.clock_in ? new Date(entry.clock_in).toTimeString().slice(0, 5) : '08:00',
        time_out: entry?.clock_out ? new Date(entry.clock_out).toTimeString().slice(0, 5) : '17:00',
        manual_entry_reason: entry?.manual_entry_reason || '',
        notes: entry?.notes || '',
    });
    const [calcHrs, setCalcHrs] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (form.time_in && form.time_out && form.date) {
            try {
                const ci = new Date(`${form.date}T${form.time_in}`);
                const co = new Date(`${form.date}T${form.time_out}`);
                if (co > ci) setCalcHrs(((co - ci) / 3600000).toFixed(2));
                else setCalcHrs('');
            } catch { setCalcHrs(''); }
        } else {
            setCalcHrs('');
        }
    }, [form.date, form.time_in, form.time_out]);

    const handleSave = async () => {
        if (!form.project_id || !form.date || !form.time_in || !form.time_out) {
            return showToast('Faltan campos requeridos.', 'error');
        }
        if (!form.manual_entry_reason && !isCreate) {
            return showToast('Debe proporcionar una razón para la edición.', 'error');
        }

        setLoading(true);
        try {
            const clock_in = `${form.date}T${form.time_in}:00`;
            const clock_out = `${form.date}T${form.time_out}:00`;

            if (isCreate) {
                await post('/time-entries', {
                    worker_id: worker.id,
                    project_id: parseInt(form.project_id),
                    clock_in, clock_out,
                    manual_entry_reason: form.manual_entry_reason.trim() || 'Entrada agregada manualmente',
                    notes: form.notes || null,
                });
                showToast('Entrada manual creada.');
            } else {
                await put(`/time-entries/${entry.id}`, {
                    clock_in, clock_out,
                    manual_entry_reason: form.manual_entry_reason.trim(),
                    notes: form.notes || null,
                });
                showToast('Entrada editada.');
            }
            onRefresh();
            onClose();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al guardar.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const doStatus = async (status) => {
        if (!entry) return;
        setLoading(true);
        try {
            await patch(`/time-entries/${entry.id}/status`, { status });
            showToast(`Estado cambiado a ${status}.`);
            onRefresh();
        } catch {
            showToast('Error al cambiar estado.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const doDelete = async () => {
        if (!entry) return;
        if (!window.confirm('¿Eliminar esta entrada de forma permanente?')) return;
        setLoading(true);
        try {
            await del(`/time-entries/${entry.id}`);
            showToast('Entrada eliminada.');
            onRefresh();
            onClose();
        } catch {
            showToast('Error al eliminar.', 'error');
            setLoading(false);
        }
    };

    return ReactDOM.createPortal(
        <>
            <div className="ts-overlay fade-in" onClick={onClose} />
            <div className="ts-drawer slide-in-right">
                <button className="ts-drawer-close" onClick={onClose}><X size={20} /></button>

                <div className="ts-drawer-hero">
                    <div className="ts-drawer-avatar">{workerInitials(worker)}</div>
                    <div className="ts-drawer-hero-info">
                        <h2>{worker?.first_name} {worker?.last_name}</h2>
                        <span>{worker?.worker_code} · {worker?.trade?.name_es || '—'}</span>
                    </div>
                </div>

                <div className="ts-drawer-body">
                    {!isCreate && entry && (
                        <div className="ts-drawer-badges">
                            <span className={`ts-badge ts-badge--${entry.status}`}>
                                {entry.status.toUpperCase()}
                            </span>
                            {entry.is_manual_entry && <span className="ts-badge ts-badge--manual">ENTRADA MANUAL</span>}
                        </div>
                    )}

                    <div className="ts-drawer-section">
                        <h3>Detalles de la Entrada</h3>
                        <div className="ts-field">
                            <label>Proyecto *</label>
                            <select className="ts-input" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                                <option value="">Seleccionar...</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div className="ts-field">
                            <label>Fecha *</label>
                            <input type="date" className="ts-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                        </div>

                        <div className="ts-grid-2">
                            <div className="ts-field">
                                <label>Entrada *</label>
                                <input type="time" className="ts-input" value={form.time_in} onChange={e => setForm({ ...form, time_in: e.target.value })} />
                            </div>
                            <div className="ts-field">
                                <label>Salida *</label>
                                <input type="time" className="ts-input" value={form.time_out} onChange={e => setForm({ ...form, time_out: e.target.value })} />
                            </div>
                        </div>

                        {calcHrs && (
                            <div className="ts-calc-box">
                                <Clock size={14} /> Total calculado: <strong>{calcHrs}h</strong>
                            </div>
                        )}
                    </div>

                    <div className="ts-drawer-section">
                        <h3>Motivo y Notas</h3>
                        <div className="ts-field">
                            <label>Razón del ajuste {(!isCreate) && '*'}</label>
                            <textarea
                                className="ts-input"
                                rows={2}
                                placeholder="Requerido al editar horas..."
                                value={form.manual_entry_reason}
                                onChange={e => setForm({ ...form, manual_entry_reason: e.target.value })}
                            />
                        </div>
                        <div className="ts-field">
                            <label>Notas Privadas</label>
                            <textarea
                                className="ts-input"
                                rows={2}
                                value={form.notes}
                                onChange={e => setForm({ ...form, notes: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Quick status actions if not create */}
                    {!isCreate && entry && entry.clock_out && (
                        <div className="ts-drawer-section">
                            <h3>Aprobación Rápida</h3>
                            <div className="ts-status-buttons">
                                <button className="ts-btn-approve" onClick={() => doStatus('approved')} disabled={loading || entry.status === 'approved'}>
                                    <CheckCircle size={14} /> Aprobar
                                </button>
                                <button className="ts-btn-reject" onClick={() => doStatus('rejected')} disabled={loading || entry.status === 'rejected'}>
                                    <XCircle size={14} /> Rechazar
                                </button>
                                <button className="ts-btn-flag" onClick={() => doStatus('flagged')} disabled={loading || entry.status === 'flagged'}>
                                    <Flag size={14} /> Flag
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="ts-drawer-footer">
                    {!isCreate && entry && (
                        <button className="ts-btn-delete" onClick={doDelete} disabled={loading}>
                            <Trash2 size={16} />
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <button className="ts-btn-ghost" onClick={onClose}>Cancelar</button>
                    <button className="ts-btn-primary" onClick={handleSave} disabled={loading}>
                        <Save size={16} /> {isCreate ? 'Crear Entrada' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </>,
        document.body
    );
}

// ─── Main Page Component ────────────────────────────────────────────────────────
export default function Timesheets() {
    const api = useApi();
    const { get, patch } = api;

    // View state
    const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
    const [entries, setEntries] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [toastMsg, setToastMsg] = useState(null);
    const [filterProject, setFilterProject] = useState('');

    // Drawer state
    const [drawerState, setDrawerState] = useState({ open: false, mode: 'create', entry: null, defaultDate: null, worker: null });

    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3800);
    };

    // Calculate array of 7 dates for the current week
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            return d;
        });
    }, [weekStart]);

    const weekEnd = weekDays[6];

    // Nav actions
    const prevWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() - 7);
        setWeekStart(d);
    };
    const nextWeek = () => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + 7);
        setWeekStart(d);
    };
    const goToToday = () => setWeekStart(getMonday(new Date()));

    // Fetch data
    const fetchWeekData = useCallback(async () => {
        setLoading(true);
        try {
            const sd = toYMD(weekStart);
            const ed = toYMD(weekEnd);
            let url = `/time-entries?start_date=${sd}&end_date=${ed}`;
            if (filterProject) url += `&project_id=${filterProject}`;

            const [resE, resW, resP] = await Promise.all([
                get(url),
                get('/workers'),
                get('/projects')
            ]);
            
            setEntries((resE.data?.data || resE.data || resE) || []);
            setWorkers((resW.data?.data || resW.data || resW) || []);
            setProjects((resP.data?.data || resP.data || resP) || []);
        } catch {
            showToast('Error al cargar datos de la semana.', 'error');
        } finally {
            setLoading(false);
        }
    }, [weekStart, weekEnd, filterProject, get]);

    useEffect(() => {
        fetchWeekData();
    }, [fetchWeekData]);

    // Group entries by worker
    const workersMap = useMemo(() => {
        const map = {};
        // Only include active workers, or workers who have entries in this week
        workers.forEach(w => {
            map[w.id] = { worker: w, days: {}, totalHours: 0, pendingIds: [] };
            weekDays.forEach(d => { map[w.id].days[toYMD(d)] = []; });
        });

        entries.forEach(e => {
            const wId = e.worker_id;
            if (!map[wId]) {
                // Failsafe if worker is missing from list but has entry
                map[wId] = { worker: e.worker || { id: wId, first_name: 'Desconocido' }, days: {}, totalHours: 0, pendingIds: [] };
                weekDays.forEach(d => { map[wId].days[toYMD(d)] = []; });
            }
            const dateStr = toYMD(e.clock_in);
            if (map[wId].days[dateStr]) {
                map[wId].days[dateStr].push(e);
                map[wId].totalHours += parseFloat(e.total_hours || 0);
                if (e.status === 'pending') {
                    map[wId].pendingIds.push(e.id);
                }
            }
        });

        // Filter out workers with 0 hours IF they don't match active filter, to keep UI clean,
        // BUT usually we want to see all workers to add hours. Let's just show all for now, 
        // sorting by those who have hours first.
        return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
    }, [entries, workers, weekDays]);

    // Bulk approve
    const doApproveWeek = async (workerRow) => {
        const { pendingIds } = workerRow;
        if (pendingIds.length === 0) return;
        setBulkLoading(true);
        try {
            await patch('/time-entries/bulk-status', { ids: pendingIds, status: 'approved' });
            showToast(`${pendingIds.length} entrada(s) aprobadas para ${workerRow.worker.first_name}.`);
            fetchWeekData();
        } catch {
            showToast('Error al aprobar semana.', 'error');
        } finally {
            setBulkLoading(false);
        }
    };

    // Calculate Week Stats
    const stats = useMemo(() => {
        let total = 0, pending = 0, approved = 0, live = 0;
        entries.forEach(e => {
            total += parseFloat(e.total_hours || 0);
            if (!e.clock_out) live++;
            else if (e.status === 'pending') pending++;
            else if (e.status === 'approved') approved++;
        });
        return { total, pending, approved, live };
    }, [entries]);

    return (
        <div className="ts-page fade-in">
            {toastMsg && ReactDOM.createPortal(
                <div className={`ts-toast ts-toast--${toastMsg.type} fade-in-up`}>
                    {toastMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    <span>{toastMsg.msg}</span>
                </div>,
                document.body
            )}

            {/* Header */}
            <div className="ts-header">
                <div className="ts-header-info">
                    <h1 className="ts-title">Registro de Horas</h1>
                    <p className="ts-subtitle">Administración de tiempos (Vista Semanal)</p>
                </div>

                <div className="te-week-nav">
                    <button className="te-nav-btn" onClick={prevWeek}><ChevronLeft size={18} /></button>
                    <div className="te-week-label" onClick={goToToday} title="Ir a esta semana" style={{ cursor: 'pointer' }}>
                        {MONTHS_ES[weekStart.getMonth()]} {weekStart.getFullYear()} · Semana {Math.ceil((weekStart.getDate() - 1 - weekStart.getDay() + 1) / 7) + 1 || ''} <br/>
                        <small>{weekStart.getDate()} {MONTHS_ES[weekStart.getMonth()]} - {weekEnd.getDate()} {MONTHS_ES[weekEnd.getMonth()]}</small>
                    </div>
                    <button className="te-nav-btn" onClick={nextWeek}><ChevronRight size={18} /></button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="ts-stats-grid">
                <div className="te-kpi">
                    <div className="te-kpi__icon ts-kpi-icon--blue"><Clock size={20} /></div>
                    <div>
                        <div className="te-kpi__value">{stats.total.toFixed(1)}h</div>
                        <div className="te-kpi__label">Total Horas (Semana)</div>
                    </div>
                </div>
                <div className="te-kpi">
                    <div className="te-kpi__icon ts-kpi-icon--yellow"><AlertCircle size={20} /></div>
                    <div>
                        <div className="te-kpi__value">{stats.pending}</div>
                        <div className="te-kpi__label">Pendientes</div>
                    </div>
                </div>
                <div className="te-kpi">
                    <div className="te-kpi__icon ts-kpi-icon--green"><CheckCircle size={20} /></div>
                    <div>
                        <div className="te-kpi__value">{stats.approved}</div>
                        <div className="te-kpi__label">Aprobadas</div>
                    </div>
                </div>
                <div className="te-kpi">
                    <div className="te-kpi__icon ts-kpi-icon--red"><Navigation size={20} /></div>
                    <div>
                        <div className="te-kpi__value">{stats.live}</div>
                        <div className="te-kpi__label">En Vivo Ahora</div>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="ts-toolbar">
                <div className="ts-filter-box">
                    <Filter size={16} />
                    <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="ts-select">
                        <option value="">Todos los Proyectos</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
                <div style={{flex: 1}}/>
            </div>

            {/* Main Weekly Grid */}
            <div className="ts-grid-container">
                {loading ? (
                    <div className="ts-loading-state">
                        <span className="ts-pulse-loader" /> Cargando semana...
                    </div>
                ) : (
                    <table className="ts-table">
                        <thead>
                            <tr>
                                <th className="te-td--worker" style={{background: 'var(--bg-main)', padding: '16px 14px', borderBottom: '1px solid var(--border)'}}>Trabajador</th>
                                {weekDays.map(d => {
                                    const isToday = toYMD(d) === toYMD(new Date());
                                    return (
                                        <th key={toYMD(d)} className={`te-th te-th--day ${isToday ? 'te-th--today' : ''} ts-col-day`}>
                                            <div className="te-th-day-label">
                                                {DAYS_SHORT[(d.getDay() + 6) % 7]}
                                            </div>
                                            <div className={isToday 
                                                ? 'te-th-day-num te-th-day-num--today' 
                                                : 'te-th-day-num'}>
                                                {d.getDate()}
                                            </div>
                                        </th>
                                    );
                                })}
                                <th className="ts-col-total">Total</th>
                                <th className="ts-col-actions">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {workersMap.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="ts-empty-state">No hay trabajadores activos.</td>
                                </tr>
                            ) : workersMap.map(row => (
                                <tr key={row.worker.id}>
                                    <td className="te-td te-td--worker">
                                        <div className="te-worker">
                                            <div
                                                className="te-worker__avatar"
                                                style={{
                                                    background: avatarColor(`${row.worker?.first_name || ''} ${row.worker?.last_name || ''}`).bg,
                                                    color: avatarColor(`${row.worker?.first_name || ''} ${row.worker?.last_name || ''}`).color,
                                                }}
                                            >
                                                {(row.worker?.first_name?.[0] || '?')}
                                                {(row.worker?.last_name?.[0] || '')}
                                            </div>
                                            <div>
                                                <div className="te-worker__name">
                                                    {row.worker?.first_name} {row.worker?.last_name}
                                                </div>
                                                <div className="te-worker__trade">
                                                    {row.worker?.trade?.name_es || 'General'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    {weekDays.map(d => {
                                        const dateStr = toYMD(d);
                                        const dayEntries = row.days[dateStr];
                                        return (
                                            <td key={dateStr} className="ts-col-day" style={{padding: '0'}}>
                                                <div className="ts-cell" style={{height: '100%', padding: '14px'}} onClick={() => { if (dayEntries.length === 0) setDrawerState({ open: true, mode: 'create', entry: null, worker: row.worker, defaultDate: dateStr }); }}>
                                                    {dayEntries.length > 0 ? (
                                                        <div className="ts-cell-chips">
                                                            {dayEntries.map(e => (
                                                                <StatusChip 
                                                                    key={e.id} 
                                                                    entry={e} 
                                                                    onClick={() => setDrawerState({ open: true, mode: 'edit', entry: e, worker: row.worker, defaultDate: dateStr })}
                                                                />
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="te-empty-day" style={{cursor: 'pointer', textAlign: 'center'}} title="Añadir entrada">—</div>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="ts-col-total">
                                        <div className="ts-total-hours">
                                            {row.totalHours > 0 ? `${row.totalHours.toFixed(1)}h` : '—'}
                                        </div>
                                    </td>
                                    <td className="ts-col-actions">
                                        <button
                                            className={`te-approve-week ${row.pendingIds.length === 0 ? 'te-approve-week--done' : ''}`}
                                            onClick={() => row.pendingIds.length !== 0 && doApproveWeek(row)}
                                            disabled={row.pendingIds.length === 0 || bulkLoading}
                                            title={row.pendingIds.length === 0 ? 'Semana aprobada' : 'Aprobar todas las horas de esta semana'}
                                        >
                                            <Check size={12} />
                                            {row.pendingIds.length === 0 ? 'Aprobada' : 'Aprobar semana'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Portal Drawer for editing */}
            {drawerState.open && (
                <EntryDrawer 
                    mode={drawerState.mode}
                    entry={drawerState.entry}
                    worker={drawerState.worker}
                    defaultDate={drawerState.defaultDate}
                    projects={projects}
                    api={api}
                    showToast={showToast}
                    onClose={() => setDrawerState({ ...drawerState, open: false })}
                    onRefresh={fetchWeekData}
                />
            )}
        </div>
    );
}
