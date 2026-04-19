import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
    ChevronLeft, ChevronRight, CheckCircle, Check,
    Flag, XCircle, Clock, AlertCircle, Trash2,
    Navigation, Save, Filter, X, Calendar, Lightbulb, Lock
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
    return new Date(date).toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });
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

// ─── AM/PM Time helpers ───────────────────────────────────────────────────────
function fromTime24(timeStr) {
    if (!timeStr) return { hour: '', minute: '00', period: '' };
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const mRaw = parseInt(parts[1] || '0', 10);
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    if (h > 12) h -= 12;
    // Round to nearest 15-minute slot
    const opts = [0, 15, 30, 45];
    const minute = String(opts.reduce((a, b) => Math.abs(b - mRaw) < Math.abs(a - mRaw) ? b : a)).padStart(2, '0');
    return { hour: String(h), minute, period };
}

function toTime24(hour, minute, period) {
    if (!hour || minute === undefined || minute === '' || !period) return null;
    let h = parseInt(hour, 10);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
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
            text = 'Pendiente';
        } else if (entry.status === 'approved') {
            cls = 'ts-chip--approved';
            icon = null;
            text = 'Aprobada';
        } else if (entry.status === 'flagged') {
            cls = 'ts-chip--flagged';
            icon = <Flag size={10} />;
            text = 'Marcada';
        } else if (entry.status === 'rejected') {
            cls = 'ts-chip--rejected';
            icon = <XCircle size={10} />;
            text = 'Rechazada';
        }
        // Overwrite text with hours if available
        if (entry.total_hours) {
            text = `${parseFloat(entry.total_hours).toFixed(1)}h`;
        }
    }

    return (
        <button 
            className={`ts-chip ${cls}`} 
            onClick={(e) => { e.stopPropagation(); onClick(entry); }} 
            title={`${fmt12(entry.clock_in)} - ${entry.clock_out ? fmt12(entry.clock_out) : '...'}`}
        >
            {icon}
            <span>{text}</span>
            {entry.is_manual_entry && <span className="ts-chip-manual-dot" title="Entrada manual" />}
        </button>
    );
}

// ─── Component: Entry Modal (Create / Edit) ──────────────────────────────────
function EntryDrawer({ entry, mode, defaultDate, worker, projects, api, showToast, onClose, onRefresh }) {
    const { post, put, del, patch } = api;
    const isCreate = mode === 'create';

    const initParsed = (hmStr, fallback) => fromTime24(hmStr || fallback);

    const timeInStr  = entry?.clock_in  ? new Date(entry.clock_in).toTimeString().slice(0, 5)  : '';
    const timeOutStr = entry?.clock_out ? new Date(entry.clock_out).toTimeString().slice(0, 5) : '';
    const parsedIn   = initParsed(timeInStr,  isCreate ? '08:00' : '');
    const parsedOut  = initParsed(timeOutStr, isCreate ? '17:00' : '');

    const [form, setForm] = useState({
        project_id:           entry?.project_id || '',
        date:                 entry?.clock_in ? toYMD(entry.clock_in) : (defaultDate || toYMD(new Date())),
        inHour:               parsedIn.hour,
        inMin:                parsedIn.minute,
        inPeriod:             parsedIn.period,
        outHour:              parsedOut.hour,
        outMin:               parsedOut.minute,
        outPeriod:            parsedOut.period,
        manual_entry_reason:  entry?.manual_entry_reason || '',
        notes:                entry?.notes || '',
    });
    const [clockInSuggested,  setClockInSuggested]  = useState(false);
    const [clockOutSuggested, setClockOutSuggested] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleProjectChange = (projectId) => {
        const project = projects.find(p => String(p.id) === String(projectId));
        let next = { ...form, project_id: projectId };
        let sugIn = false, sugOut = false;
        if (isCreate && project) {
            if (project.shift_start_time) {
                const p = fromTime24(project.shift_start_time);
                next = { ...next, inHour: p.hour, inMin: p.minute, inPeriod: p.period };
                sugIn = true;
            }
            if (project.shift_end_time) {
                const p = fromTime24(project.shift_end_time);
                next = { ...next, outHour: p.hour, outMin: p.minute, outPeriod: p.period };
                sugOut = true;
            }
        }
        setForm(next);
        setClockInSuggested(sugIn);
        setClockOutSuggested(sugOut);
    };

    const calculatedHours = useMemo(() => {
        const ci = toTime24(form.inHour,  form.inMin,  form.inPeriod);
        const co = toTime24(form.outHour, form.outMin, form.outPeriod);
        if (!ci || !co) return '0.00';
        const [ih, im] = ci.split(':').map(Number);
        const [oh, om] = co.split(':').map(Number);
        const mins = (oh * 60 + om) - (ih * 60 + im);
        return mins > 0 ? (mins / 60).toFixed(2) : '0.00';
    }, [form.inHour, form.inMin, form.inPeriod, form.outHour, form.outMin, form.outPeriod]);

    const handleSave = async () => {
        const ciTime = toTime24(form.inHour,  form.inMin,  form.inPeriod);
        const coTime = toTime24(form.outHour, form.outMin, form.outPeriod);
        if (!form.project_id || !form.date || !ciTime || !coTime) {
            return showToast('Faltan campos requeridos.', 'error');
        }
        if (!form.manual_entry_reason && !isCreate) {
            return showToast('Debe proporcionar una razón para la edición.', 'error');
        }
        setLoading(true);
        try {
            const ciDate = new Date(`${form.date}T${ciTime}`);
            let coDate   = new Date(`${form.date}T${coTime}`);
            if (coDate <= ciDate) coDate.setDate(coDate.getDate() + 1);
            const pad = n => String(n).padStart(2, '0');
            const clock_in  = `${ciDate.getFullYear()}-${pad(ciDate.getMonth()+1)}-${pad(ciDate.getDate())}T${pad(ciDate.getHours())}:${pad(ciDate.getMinutes())}:00`;
            const clock_out = `${coDate.getFullYear()}-${pad(coDate.getMonth()+1)}-${pad(coDate.getDate())}T${pad(coDate.getHours())}:${pad(coDate.getMinutes())}:00`;

            if (isCreate) {
                await post('/time-entries', {
                    worker_id: worker.id,
                    project_id: parseInt(form.project_id),
                    clock_in, clock_out,
                    manual_entry_reason: form.manual_entry_reason.trim() || 'Entrada agregada manualmente',
                    notes: form.notes?.trim() || null,
                });
                showToast('Entrada manual creada.', 'success');
            } else {
                await put(`/time-entries/${entry.id}`, {
                    clock_in, clock_out,
                    manual_entry_reason: form.manual_entry_reason.trim(),
                    notes: form.notes?.trim() || null,
                });
                showToast('Entrada editada.', 'success');
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
            const res = await patch(`/time-entries/${entry.id}/status`, { status });
            showToast(`Estado cambiado a ${res.data?.data?.status || status}.`, 'success');
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
            showToast('Entrada eliminada.', 'success');
            onRefresh();
            onClose();
        } catch {
            showToast('Error al eliminar.', 'error');
            setLoading(false);
        }
    };

    const HOURS   = [1,2,3,4,5,6,7,8,9,10,11,12];
    const MINUTES = ['00','15','30','45'];

    const modal = (
        <div className="te-modal-overlay" onClick={onClose}>
            <div className="te-modal" onClick={e => e.stopPropagation()}>

                {/* ── HEADER ── */}
                <div className="te-modal__header">
                    <div className="te-modal__worker-info">
                        <div className="te-modal__avatar-wrap">
                            <div className="te-modal__avatar">{workerInitials(worker)}</div>
                            <div className="te-modal__verified"><Check size={10} /></div>
                        </div>
                        <div>
                            <h2 className="te-modal__name">{worker?.first_name} {worker?.last_name}</h2>
                            <div className="te-modal__meta">
                                <span className="te-modal__code">{worker?.worker_code}</span>
                                <span className="te-modal__dot">•</span>
                                <span className="te-modal__trade">{worker?.trade?.name_es || worker?.trade?.name || '—'}</span>
                            </div>
                        </div>
                    </div>
                    <button className="te-modal__close" onClick={onClose}><X size={16} /></button>
                </div>

                {/* ── BODY ── */}
                <div className="te-modal__body">

                    {/* Edit mode: status badges */}
                    {!isCreate && entry && (
                        <div className="ts-drawer-badges">
                            <span className={`ts-badge ts-badge--${entry.status}`}>{entry.status.toUpperCase()}</span>
                            {entry.is_manual_entry && <span className="ts-badge ts-badge--manual">ENTRADA MANUAL</span>}
                        </div>
                    )}

                    {/* Proyecto + Fecha */}
                    <div className="te-modal__row-2col">
                        <div className="te-modal__field">
                            <label className="te-modal__label">Proyecto *</label>
                            <div className="te-modal__select-wrap">
                                <select
                                    className="te-modal__select"
                                    value={form.project_id}
                                    onChange={e => handleProjectChange(e.target.value)}
                                >
                                    <option value="">Seleccionar...</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <span className="te-modal__select-arrow"><ChevronLeft size={13} style={{ transform: 'rotate(-90deg)' }} /></span>
                            </div>
                        </div>
                        <div className="te-modal__field">
                            <label className="te-modal__label">Fecha *</label>
                            <div className="te-modal__input-icon-wrap">
                                <input
                                    type="date"
                                    className="te-modal__input"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                />
                                <span className="te-modal__input-icon"><Calendar size={14} /></span>
                            </div>
                        </div>
                    </div>

                    {/* ── Bloque de tiempo ── */}
                    <div className="te-modal__time-block">
                        {(clockInSuggested || clockOutSuggested) && (
                            <div className="te-modal__suggested-badge">
                                <Lightbulb size={12} /> Horario sugerido por el proyecto
                            </div>
                        )}
                        <div className="te-modal__time-row">
                            {/* ENTRADA */}
                            <div className="te-modal__time-field">
                                <label className="te-modal__label">Entrada *</label>
                                <div className="te-modal__time-selects">
                                    <select className="te-modal__time-select" value={form.inHour} onChange={e => { setForm({...form, inHour: e.target.value}); setClockInSuggested(false); }}>
                                        <option value="">--</option>
                                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                    <span className="te-modal__time-sep">:</span>
                                    <select className="te-modal__time-select" value={form.inMin} onChange={e => { setForm({...form, inMin: e.target.value}); setClockInSuggested(false); }}>
                                        <option value="">--</option>
                                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select className="te-modal__time-select te-modal__time-select--period" value={form.inPeriod} onChange={e => { setForm({...form, inPeriod: e.target.value}); setClockInSuggested(false); }}>
                                        <option value="">--</option>
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                    </select>
                                </div>
                            </div>
                            {/* SALIDA */}
                            <div className="te-modal__time-field">
                                <label className="te-modal__label">Salida *</label>
                                <div className="te-modal__time-selects">
                                    <select className="te-modal__time-select" value={form.outHour} onChange={e => { setForm({...form, outHour: e.target.value}); setClockOutSuggested(false); }}>
                                        <option value="">--</option>
                                        {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                    <span className="te-modal__time-sep">:</span>
                                    <select className="te-modal__time-select" value={form.outMin} onChange={e => { setForm({...form, outMin: e.target.value}); setClockOutSuggested(false); }}>
                                        <option value="">--</option>
                                        {MINUTES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select className="te-modal__time-select te-modal__time-select--period" value={form.outPeriod} onChange={e => { setForm({...form, outPeriod: e.target.value}); setClockOutSuggested(false); }}>
                                        <option value="">--</option>
                                        <option value="AM">AM</option>
                                        <option value="PM">PM</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        {/* Barra total */}
                        <div className="te-modal__total-bar">
                            <div className="te-modal__total-left">
                                <span className="te-modal__total-icon"><Clock size={14} /></span>
                                <span className="te-modal__total-label">Tiempo total de labor</span>
                            </div>
                            <span className="te-modal__total-value">{calculatedHours}h</span>
                        </div>
                    </div>

                    {/* Razón del ajuste */}
                    <div className="te-modal__field">
                        <label className="te-modal__label">Razón del ajuste{!isCreate && ' *'}</label>
                        <textarea
                            className="te-modal__textarea"
                            placeholder={isCreate ? 'Opcional: describa el motivo...' : 'Requerido al editar horas...'}
                            rows={2}
                            value={form.manual_entry_reason}
                            onChange={e => setForm({...form, manual_entry_reason: e.target.value})}
                        />
                    </div>

                    {/* Notas privadas */}
                    <div className="te-modal__field">
                        <label className="te-modal__label">Notas Privadas</label>
                        <div className="te-modal__input-icon-wrap">
                            <input
                                type="text"
                                className="te-modal__input"
                                placeholder="Solo visible para administración"
                                value={form.notes}
                                onChange={e => setForm({...form, notes: e.target.value})}
                            />
                            <span className="te-modal__input-icon"><Lock size={14} /></span>
                        </div>
                    </div>

                    {/* Edit mode: quick approval */}
                    {!isCreate && entry && entry.clock_out && (
                        <div>
                            <p className="te-modal__label" style={{marginBottom: 10}}>Aprobación Rápida</p>
                            <div className="ts-status-buttons">
                                <button className="ts-btn-approve" onClick={() => doStatus('approved')} disabled={loading || entry.status === 'approved'}><CheckCircle size={14} /> Aprobar</button>
                                <button className="ts-btn-reject"  onClick={() => doStatus('rejected')} disabled={loading || entry.status === 'rejected'}><XCircle   size={14} /> Rechazar</button>
                                <button className="ts-btn-flag"    onClick={() => doStatus('flagged')}  disabled={loading || entry.status === 'flagged'}><Flag       size={14} /> Marcar</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── FOOTER ── */}
                <div className="te-modal__footer">
                    {!isCreate && entry && (
                        <button className="ts-btn-delete" onClick={doDelete} disabled={loading} title="Eliminar entrada" style={{marginRight: 'auto'}}>
                            <Trash2 size={16} />
                        </button>
                    )}
                    <button className="te-modal__btn-cancel" onClick={onClose}>Cancelar</button>
                    <button className="te-modal__btn-save" onClick={handleSave} disabled={loading}>
                        <Save size={16} />
                        {loading ? 'Guardando...' : (isCreate ? 'Crear Entrada' : 'Guardar Cambios')}
                    </button>
                </div>

            </div>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
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
        workers.forEach(w => {
            map[w.id] = { worker: w, days: {}, totalHours: 0, pendingIds: [] };
            weekDays.forEach(d => { map[w.id].days[toYMD(d)] = []; });
        });

        entries.forEach(e => {
            const wId = e.worker_id;
            if (!map[wId]) {
                map[wId] = { worker: e.worker || { id: wId, first_name: 'Desconocido', last_name: '' }, days: {}, totalHours: 0, pendingIds: [] };
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

        return Object.values(map).sort((a, b) => b.totalHours - a.totalHours);
    }, [entries, workers, weekDays]);

    // Bulk approve
    const doApproveWeek = async (workerRow) => {
        const { pendingIds } = workerRow;
        if (pendingIds.length === 0) return;
        setBulkLoading(true);
        try {
            const res = await patch('/time-entries/bulk-status', { ids: pendingIds, status: 'approved' });
            showToast(`${res.data?.data?.updated || pendingIds.length} entrada(s) aprobadas para ${workerRow.worker.first_name}.`, 'success');
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
                                                <div 
                                                    className="ts-cell" 
                                                    style={{height: '100%', padding: '14px', cursor: 'pointer'}} 
                                                    onClick={() => { 
                                                        if (dayEntries.length === 0) {
                                                            setDrawerState({ open: true, mode: 'create', entry: null, worker: row.worker, defaultDate: dateStr }); 
                                                        }
                                                    }}
                                                >
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
                                                        <div className="te-empty-day" title="Añadir entrada">—</div>
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
