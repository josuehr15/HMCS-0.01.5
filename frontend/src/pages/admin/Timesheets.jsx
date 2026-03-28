import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Plus, X, CheckCircle,
    Flag, XCircle, Clock, AlertCircle, Edit2, Trash2,
    Users, BarChart2, Activity, ChevronDown, Navigation,
    Shield, User, Building2, Calendar
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import './Timesheets.css';

// ─── Constants & helpers ────────────────────────────────────────────────────────
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
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
// ISO-week Monday start
function getWeekStart(d) {
    const dt = new Date(d);
    const day = dt.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    dt.setDate(dt.getDate() + diff);
    dt.setHours(0, 0, 0, 0);
    return dt;
}
function toYMD(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Build calendar weeks for a month
function buildCalendarWeeks(year, month) {
    // month is 0-indexed
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Start from the Monday before or on the 1st
    const start = getWeekStart(firstDay);
    const weeks = [];

    let cursor = new Date(start);
    while (cursor <= lastDay || cursor.getMonth() === month) {
        const week = [];
        for (let d = 0; d < 7; d++) {
            week.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
        if (cursor > lastDay && cursor.getDay() === 1) break; // Mon past last day
    }
    return weeks;
}

// Calculate overtime for a worker in a given week (Mon–Sun)
function calcWeekStats(entries) {
    // entries filtered to one worker, one week
    const totalRaw = entries.reduce((s, e) => s + parseFloat(e.total_hours || 0), 0);
    const regular = Math.min(totalRaw, 40);
    const overtime = Math.max(0, totalRaw - 40);
    return { total: parseFloat(totalRaw.toFixed(2)), regular: parseFloat(regular.toFixed(2)), overtime: parseFloat(overtime.toFixed(2)) };
}

// ─── Status badge component ─────────────────────────────────────────────────────
function EntryStatusBadge({ entry, compact = false }) {
    if (!entry.clock_out) {
        return <span className={`ts-badge ts-badge--live ${compact ? 'ts-badge--sm' : ''}`}>
            <span className="ts-pulse" />En vivo
        </span>;
    }
    const map = {
        pending: { cls: 'ts-badge--pending', icon: '⏳', label: 'Pendiente' },
        approved: { cls: 'ts-badge--approved', icon: '✅', label: 'Aprobada' },
        flagged: { cls: 'ts-badge--flagged', icon: '🚩', label: 'Flagged' },
        rejected: { cls: 'ts-badge--rejected', icon: '❌', label: 'Rechazada' },
    };
    const m = map[entry.status] || { cls: '', icon: '?', label: entry.status };
    return <span className={`ts-badge ${m.cls} ${compact ? 'ts-badge--sm' : ''}`}>
        {m.icon} {!compact && m.label}
    </span>;
}

// ─── Calendar Cell Entry ────────────────────────────────────────────────────────
function CellEntry({ entry, selected, onSelect, onClick }) {
    return (
        <div
            className={`ts-cell-entry ${selected ? 'ts-cell-entry--sel' : ''} ${entry.is_manual_entry ? 'ts-cell-entry--manual' : ''} ${!entry.clock_out ? 'ts-cell-entry--live' : ''}`}
            onClick={(e) => { e.stopPropagation(); onClick(entry); }}
        >
            <div className="ts-cell-entry__top">
                <label className="ts-cell-entry__check" onClick={e => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={e => { e.stopPropagation(); onSelect(entry.id, e.target.checked); }}
                    />
                </label>
                <span className="ts-cell-entry__initials">{workerInitials(entry.worker)}</span>
                <EntryStatusBadge entry={entry} compact />
            </div>
            <p className="ts-cell-entry__time">
                {fmt12(entry.clock_in)} – {entry.clock_out ? fmt12(entry.clock_out) : '…'}
            </p>
            <p className="ts-cell-entry__hrs">
                {entry.total_hours ? `${parseFloat(entry.total_hours).toFixed(1)}h` : '—'}
                {entry.is_manual_entry && <span className="ts-manual-dot" title="Entrada manual">M</span>}
            </p>
            <p className="ts-cell-entry__proj">{entry.project?.name || '—'}</p>
        </div>
    );
}

// ─── Week Summary sidebar ───────────────────────────────────────────────────────
function WeekSummary({ weekDays, entries, onApproveWeek }) {
    const weekStart = toYMD(weekDays[1]); // Monday
    const weekEnd = toYMD(weekDays[0].getDay() === 0 ? weekDays[0] : weekDays[6]); // Sunday

    const weekEntries = entries.filter(e => {
        const d = toYMD(e.clock_in);
        return d >= weekStart && d <= weekEnd;
    });

    // Group by worker
    const byWorker = {};
    weekEntries.forEach(e => {
        const key = e.worker_id;
        if (!byWorker[key]) byWorker[key] = { worker: e.worker, entries: [] };
        byWorker[key].entries.push(e);
    });

    const workerRows = Object.values(byWorker);
    const pendingCount = weekEntries.filter(e => e.status === 'pending').length;
    const totalHrs = weekEntries.reduce((s, e) => s + parseFloat(e.total_hours || 0), 0);

    return (
        <div className="ts-week-summary">
            <p className="ts-week-summary__title">Resumen Semana</p>
            {workerRows.length === 0 ? (
                <p className="ts-week-summary__empty">Sin entradas</p>
            ) : workerRows.map(({ worker, entries: we }) => {
                const stats = calcWeekStats(we);
                return (
                    <div key={worker?.id || 'unk'} className="ts-week-row">
                        <span className="ts-week-row__initials">{workerInitials(worker)}</span>
                        <span className="ts-week-row__hrs">{stats.total}h</span>
                        {stats.overtime > 0 && <span className="ts-week-row__ot">{stats.overtime}h OT</span>}
                    </div>
                );
            })}
            <div className="ts-week-summary__total">
                <span>{totalHrs.toFixed(1)}h total</span>
                {pendingCount > 0 && <span className="ts-week-summary__pending">· {pendingCount} pend.</span>}
            </div>
            {pendingCount > 0 && (
                <button className="ts-approve-week-btn" onClick={() => onApproveWeek(weekEntries.filter(e => e.status === 'pending').map(e => e.id))}>
                    <CheckCircle size={11} /> Aprobar semana
                </button>
            )}
        </div>
    );
}

// ─── Entry Drawer ───────────────────────────────────────────────────────────────
function EntryDrawer({ entry, api, showToast, onClose, onUpdated, onDeleted, onEdit }) {
    const { patch, del } = api;
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const h = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    if (!entry) return null;

    const project = entry.project || {};
    const worker = entry.worker || {};

    // GPS distance calc
    const gpsOk = (lat, lng) => {
        if (!lat || !lng || !project.latitude) return null;
        const R = 6371000;
        const φ1 = parseFloat(project.latitude) * Math.PI / 180;
        const φ2 = parseFloat(lat) * Math.PI / 180;
        const Δφ = (parseFloat(lat) - parseFloat(project.latitude)) * Math.PI / 180;
        const Δλ = (parseFloat(lng) - parseFloat(project.longitude)) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        const ok = dist <= parseInt(project.gps_radius_meters || 500);
        return { dist, ok };
    };

    const inResult = entry.clock_in_latitude ? gpsOk(entry.clock_in_latitude, entry.clock_in_longitude) : null;
    const outResult = entry.clock_out_latitude ? gpsOk(entry.clock_out_latitude, entry.clock_out_longitude) : null;

    const mapsUrl = project.latitude
        ? `https://maps.google.com/maps?q=${project.latitude},${project.longitude}&z=15&output=embed`
        : null;

    const doStatus = async (status) => {
        setLoading(true);
        try {
            const res = await patch(`/time-entries/${entry.id}/status`, { status });
            const upd = res.data?.data || res.data || res;
            onUpdated(upd);
            showToast(`Entrada ${status === 'approved' ? 'aprobada' : status === 'rejected' ? 'rechazada' : 'flaggeada'}.`);
        } catch { showToast('Error al cambiar estado.', 'error'); }
        finally { setLoading(false); }
    };

    const doDelete = async () => {
        if (!window.confirm('¿Eliminar esta entrada de horas?')) return;
        try {
            await del(`/time-entries/${entry.id}`);
            onDeleted(entry.id);
            onClose();
            showToast('Entrada eliminada.');
        } catch { showToast('Error al eliminar.', 'error'); }
    };

    return (
        <>
            <div className="drawer-overlay" onClick={onClose} />
            <aside className="ts-drawer" role="dialog">
                <button className="drawer-close" onClick={onClose}><X size={20} /></button>

                {/* Hero */}
                <div className="drawer-hero">
                    <div className="ts-drawer-avatar">{workerInitials(worker)}</div>
                    <div className="drawer-hero__info">
                        <h2 className="drawer-hero__name">{worker.first_name} {worker.last_name}</h2>
                        <span className="drawer-hero__sub">{worker.worker_code} · {worker.trade?.name_es || '—'}</span>
                        <div className="drawer-hero__badges">
                            <EntryStatusBadge entry={entry} />
                            {entry.is_manual_entry && <span className="ts-badge ts-badge--manual">✋ Manual</span>}
                        </div>
                    </div>
                </div>

                <div className="drawer-body">
                    {/* Proyecto */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><Building2 size={13} /> Proyecto</p>
                        <div className="drawer-field"><span className="drawer-field__label">Proyecto:</span><span>{project.name || '—'}</span></div>
                        <div className="drawer-field"><span className="drawer-field__label">Dirección:</span><span>{project.address || '—'}</span></div>
                    </div>

                    {/* Horario */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><Clock size={13} /> Horario</p>
                        <div className="drawer-field"><Calendar size={13} /><span className="drawer-field__label">Entrada:</span><span>{fmt12(entry.clock_in)} · {fmtDate(entry.clock_in)}</span></div>
                        <div className="drawer-field"><Calendar size={13} /><span className="drawer-field__label">Salida:</span><span>{entry.clock_out ? `${fmt12(entry.clock_out)} · ${fmtDate(entry.clock_out)}` : '⏳ En progreso'}</span></div>
                        <div className="ts-hours-badge">
                            <Clock size={14} />
                            <span>{entry.total_hours ? `${parseFloat(entry.total_hours).toFixed(2)} horas` : 'Abierto'}</span>
                        </div>
                    </div>

                    {/* GPS */}
                    {!entry.is_manual_entry && (
                        <div className="drawer-section">
                            <p className="drawer-section__title"><Navigation size={13} /> GPS</p>
                            {inResult && (
                                <div className={`ts-gps-row ${inResult.ok ? 'ts-gps-row--ok' : 'ts-gps-row--warn'}`}>
                                    <span>Entrada: {parseFloat(entry.clock_in_latitude).toFixed(4)}, {parseFloat(entry.clock_in_longitude).toFixed(4)}</span>
                                    <span className="ts-gps-dist">{inResult.dist}m {inResult.ok ? '✅' : '⚠️'}</span>
                                </div>
                            )}
                            {outResult && (
                                <div className={`ts-gps-row ${outResult.ok ? 'ts-gps-row--ok' : 'ts-gps-row--warn'}`}>
                                    <span>Salida: {parseFloat(entry.clock_out_latitude).toFixed(4)}, {parseFloat(entry.clock_out_longitude).toFixed(4)}</span>
                                    <span className="ts-gps-dist">{outResult.dist}m {outResult.ok ? '✅' : '⚠️'}</span>
                                </div>
                            )}
                            {mapsUrl && (
                                <div className="proj-map-container" style={{ marginTop: 8 }}>
                                    <iframe title="entry-map" src={mapsUrl} width="100%" height="160" style={{ border: 0, borderRadius: 8 }} loading="lazy" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Manual entry info */}
                    {entry.is_manual_entry && (
                        <div className="drawer-section">
                            <p className="drawer-section__title"><Shield size={13} /> Entrada Manual</p>
                            <div className="ts-manual-box">
                                <p className="ts-manual-box__label">Razón:</p>
                                <p className="ts-manual-box__text">{entry.manual_entry_reason || '—'}</p>
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {entry.notes && (
                        <div className="drawer-section">
                            <p className="drawer-section__title">Notas</p>
                            <p style={{ fontSize: 12, color: '#6B7280' }}>{entry.notes}</p>
                        </div>
                    )}

                    {/* Status actions */}
                    {entry.clock_out && (
                        <div className="drawer-section">
                            <p className="drawer-section__title">Cambiar Estado</p>
                            <div className="ts-status-actions">
                                <button className="ts-action-btn ts-action-btn--approve" onClick={() => doStatus('approved')} disabled={loading || entry.status === 'approved'}>
                                    <CheckCircle size={14} /> Aprobar
                                </button>
                                <button className="ts-action-btn ts-action-btn--flag" onClick={() => doStatus('flagged')} disabled={loading || entry.status === 'flagged'}>
                                    <Flag size={14} /> Flaggear
                                </button>
                                <button className="ts-action-btn ts-action-btn--reject" onClick={() => doStatus('rejected')} disabled={loading || entry.status === 'rejected'}>
                                    <XCircle size={14} /> Rechazar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="drawer-section drawer-section--actions">
                        <p className="drawer-section__title">Acciones</p>
                        <button className="drawer-action-btn" onClick={() => onEdit(entry)}>
                            <Edit2 size={14} /> Editar Entrada
                        </button>
                        <button className="drawer-action-btn drawer-action-btn--danger" onClick={doDelete}>
                            <Trash2 size={14} /> Eliminar Entrada
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}

// ─── Entry Modal (create/edit) ──────────────────────────────────────────────────
function EntryModal({ mode, entry, workers, projects, api, showToast, onSaved, onClose, currentUser }) {
    const { post, put } = api;
    const [form, setForm] = useState({
        worker_id: entry?.worker_id || '',
        project_id: entry?.project_id || '',
        date: entry?.clock_in ? toYMD(entry.clock_in) : toYMD(new Date()),
        time_in: entry?.clock_in ? new Date(entry.clock_in).toTimeString().slice(0, 5) : '08:00',
        time_out: entry?.clock_out ? new Date(entry.clock_out).toTimeString().slice(0, 5) : '17:00',
        manual_entry_reason: entry?.manual_entry_reason || '',
        notes: entry?.notes || '',
    });
    const [calcHrs, setCalcHrs] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Auto-calc hours
    useEffect(() => {
        if (form.time_in && form.time_out && form.date) {
            try {
                const ci = new Date(`${form.date}T${form.time_in}`);
                const co = new Date(`${form.date}T${form.time_out}`);
                if (co > ci) setCalcHrs(((co - ci) / 3600000).toFixed(2));
                else setCalcHrs('');
            } catch { setCalcHrs(''); }
        }
    }, [form.date, form.time_in, form.time_out]);

    const handleSave = async () => {
        if (!form.worker_id || !form.project_id || !form.date || !form.time_in || !form.time_out) {
            return setError('Worker, proyecto, fecha y horas son requeridos.');
        }
        setSaving(true); setError('');
        try {
            const clock_in = `${form.date}T${form.time_in}:00`;
            const clock_out = `${form.date}T${form.time_out}:00`;
            let res;
            if (mode === 'create') {
                res = await post('/time-entries', {
                    worker_id: parseInt(form.worker_id),
                    project_id: parseInt(form.project_id),
                    clock_in, clock_out,
                    manual_entry_reason: form.manual_entry_reason.trim(),
                    notes: form.notes || null,
                });
            } else {
                res = await put(`/time-entries/${entry.id}`, {
                    clock_in, clock_out,
                    manual_entry_reason: form.manual_entry_reason.trim(),
                    notes: form.notes || null,
                });
            }
            const saved = res.data?.data || res.data || res;
            onSaved(saved, mode);
            showToast(mode === 'create' ? 'Entrada manual creada.' : 'Entrada actualizada.');
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al guardar.');
        } finally { setSaving(false); }
    };

    // Filter projects where worker has assignment (simplified — show all active)
    const filteredProjects = projects;

    return (
        <div className="workers-modal-overlay" onClick={onClose}>
            <div className="workers-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                <div className="workers-modal__header">
                    <h2>{mode === 'create' ? '➕ Entrada Manual' : '✏️ Editar Entrada'}</h2>
                    <button className="workers-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="workers-modal__body">
                    {error && <div className="wf-error">{error}</div>}
                    <div className="ts-manual-warning">
                        <AlertCircle size={14} />
                        Esta entrada se marcará como <strong>manual</strong>.
                    </div>

                    <div className="wf-grid-2">
                        <div className="wf-field">
                            <label className="wf-label">Worker *</label>
                            <div className="workers-select-wrapper">
                                <select
                                    className="wf-select"
                                    value={form.worker_id}
                                    onChange={e => setForm(p => ({ ...p, worker_id: e.target.value }))}
                                    disabled={mode === 'edit'}
                                >
                                    <option value="">Selecciona worker...</option>
                                    {workers.map(w => (
                                        <option key={w.id} value={w.id}>{w.first_name} {w.last_name} ({w.worker_code})</option>
                                    ))}
                                </select>
                                <ChevronDown size={13} className="workers-select__arrow" />
                            </div>
                        </div>
                        <div className="wf-field">
                            <label className="wf-label">Proyecto *</label>
                            <div className="workers-select-wrapper">
                                <select
                                    className="wf-select"
                                    value={form.project_id}
                                    onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}
                                    disabled={mode === 'edit'}
                                >
                                    <option value="">Selecciona proyecto...</option>
                                    {filteredProjects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={13} className="workers-select__arrow" />
                            </div>
                        </div>
                    </div>

                    <div className="wf-field">
                        <label className="wf-label">Fecha *</label>
                        <input className="wf-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                    </div>

                    <div className="wf-grid-2">
                        <div className="wf-field">
                            <label className="wf-label">Hora entrada *</label>
                            <input className="wf-input" type="time" value={form.time_in} onChange={e => setForm(p => ({ ...p, time_in: e.target.value }))} />
                        </div>
                        <div className="wf-field">
                            <label className="wf-label">Hora salida *</label>
                            <input className="wf-input" type="time" value={form.time_out} onChange={e => setForm(p => ({ ...p, time_out: e.target.value }))} />
                        </div>
                    </div>

                    {calcHrs && (
                        <div className="ts-calc-hrs">
                            <Clock size={13} /> Total calculado: <strong>{calcHrs} horas</strong>
                        </div>
                    )}

                    <div className="wf-field">
                        <label className="wf-label">Razón del ajuste</label>
                        <textarea
                            className="wf-input wf-textarea"
                            rows={3}
                            placeholder="Ej: El trabajador olvió hacer clock in, se corrige manualmente... (opcional)"
                            value={form.manual_entry_reason}
                            onChange={e => setForm(p => ({ ...p, manual_entry_reason: e.target.value }))}
                        />
                    </div>

                    <div className="wf-field">
                        <label className="wf-label">Notas (opcional)</label>
                        <textarea className="wf-input wf-textarea" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas adicionales..." />
                    </div>
                </div>
                <div className="workers-modal__footer">
                    <button className="workers-btn-outline" onClick={onClose}>Cancelar</button>
                    <button className="workers-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Guardando...' : (mode === 'create' ? 'Crear Entrada' : 'Guardar Cambios')}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page Component ────────────────────────────────────────────────────────
export default function Timesheets() {
    const { user } = useAuth();
    const api = useApi();
    const { get, patch } = api;

    // Month navigation
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

    // Data
    const [entries, setEntries] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [stats, setStats] = useState({ totalHours: 0, pending: 0, approved: 0, liveNow: 0 });
    const [loading, setLoading] = useState(false);

    // UI state
    const [filterWorker, setFilterWorker] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [selected, setSelected] = useState(new Set()); // selected entry IDs
    const [drawerEntry, setDrawerEntry] = useState(null);
    const [modalMode, setModalMode] = useState(null); // 'create' | 'edit'
    const [editEntry, setEditEntry] = useState(null);
    const [toastMsg, setToastMsg] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);

    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3800);
    };

    // Build calendar weeks
    const calendarWeeks = useMemo(() => buildCalendarWeeks(viewYear, viewMonth), [viewYear, viewMonth]);

    // Month nav
    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    // Fetch data
    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
            const res = await get(`/time-entries/summary?month=${monthStr}`);
            const data = res.data?.data || res.data || res;
            setEntries(data.entries || []);
            setStats(data.stats || { totalHours: 0, pending: 0, approved: 0, liveNow: 0 });
        } catch { showToast('Error al cargar horas', 'error'); }
        finally { setLoading(false); }
    }, [get, viewYear, viewMonth]);

    const fetchWorkers = useCallback(async () => {
        try { const r = await get('/workers'); setWorkers(r.data || r); } catch { }
    }, [get]);

    const fetchProjects = useCallback(async () => {
        try { const r = await get('/projects'); setProjects(r.data || r); } catch { }
    }, [get]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);
    useEffect(() => { fetchWorkers(); fetchProjects(); }, [fetchWorkers, fetchProjects]);

    // Filtered entries
    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            if (filterWorker && String(e.worker_id) !== String(filterWorker)) return false;
            if (filterProject && String(e.project_id) !== String(filterProject)) return false;
            if (filterStatus && filterStatus !== 'all') {
                if (filterStatus === 'live' && e.clock_out) return false;
                if (filterStatus !== 'live' && e.status !== filterStatus) return false;
            }
            return true;
        });
    }, [entries, filterWorker, filterProject, filterStatus]);

    // Map entries by day
    const entriesByDay = useMemo(() => {
        const map = {};
        filteredEntries.forEach(e => {
            const key = toYMD(e.clock_in);
            if (!map[key]) map[key] = [];
            map[key].push(e);
        });
        return map;
    }, [filteredEntries]);

    // Selection helpers
    const toggleSelect = (id, val) => {
        setSelected(prev => {
            const next = new Set(prev);
            val ? next.add(id) : next.delete(id);
            return next;
        });
    };
    const selectAll = () => setSelected(new Set(filteredEntries.map(e => e.id)));
    const clearSel = () => setSelected(new Set());

    // Bulk approve/reject
    const doBulk = async (status) => {
        const ids = [...selected];
        if (ids.length === 0) return;
        setBulkLoading(true);
        try {
            await patch('/time-entries/bulk-status', { ids, status });
            setEntries(prev => prev.map(e => ids.includes(e.id) ? { ...e, status, approved_by_user_id: user?.id } : e));
            showToast(`${ids.length} entrada${ids.length > 1 ? 's' : ''} ${status === 'approved' ? 'aprobada(s)' : 'rechazada(s)'}.`);
            clearSel();
            fetchEntries();
        } catch { showToast('Error en acción en lote.', 'error'); }
        finally { setBulkLoading(false); }
    };

    const doApproveWeek = async (ids) => {
        if (ids.length === 0) return;
        if (!window.confirm(`¿Aprobar ${ids.length} entrada(s) pendientes de esta semana?`)) return;
        try {
            await patch('/time-entries/bulk-status', { ids, status: 'approved' });
            setEntries(prev => prev.map(e => ids.includes(e.id) ? { ...e, status: 'approved' } : e));
            showToast(`${ids.length} entradas aprobadas.`);
            fetchEntries();
        } catch { showToast('Error al aprobar semana.', 'error'); }
    };

    // Entry update handlers
    const handleEntryUpdated = (upd) => {
        setEntries(prev => prev.map(e => e.id === upd.id ? upd : e));
        if (drawerEntry?.id === upd.id) setDrawerEntry(upd);
    };
    const handleEntryDeleted = (id) => {
        setEntries(prev => prev.filter(e => e.id !== id));
        fetchEntries();  // refresh stats
    };
    const handleEntrySaved = (saved, mode) => {
        if (mode === 'create') {
            setEntries(prev => [...prev, saved]);
        } else {
            handleEntryUpdated(saved);
        }
        fetchEntries();
    };

    const STAT_CARDS = [
        { label: 'Total Horas (mes)', value: `${stats.totalHours.toFixed(0)}h`, icon: <BarChart2 size={18} />, color: '#2A6C95' },
        { label: 'Pendientes', value: stats.pending, icon: <AlertCircle size={18} />, color: '#F59E0B' },
        { label: 'Aprobadas', value: stats.approved, icon: <CheckCircle size={18} />, color: '#10B981' },
        { label: 'En vivo ahora', value: stats.liveNow, icon: <Activity size={18} />, color: '#EF4444' },
    ];

    return (
        <div className="ts-page fade-in">
            {/* Toast */}
            {toastMsg && (
                <div className={`workers-toast workers-toast--${toastMsg.type}`}>
                    {toastMsg.type === 'success' ? <CheckCircle size={15} /> : <X size={15} />}
                    {toastMsg.msg}
                </div>
            )}

            {/* Header */}
            <div className="ts-header">
                <div>
                    <h1 className="ts-title">Gestión de Horas</h1>
                    <p className="ts-subtitle">Revisa y aprueba las horas de tus trabajadores</p>
                </div>
                <button className="workers-btn-primary" onClick={() => { setEditEntry(null); setModalMode('create'); }}>
                    <Plus size={16} /> Entrada Manual
                </button>
            </div>

            {/* Stat cards */}
            <div className="ts-stats-grid">
                {STAT_CARDS.map((s, i) => (
                    <div key={i} className="ts-stat-card">
                        <div className="ts-stat-card__icon" style={{ background: `${s.color}15`, color: s.color }}>
                            {s.icon}
                        </div>
                        <div>
                            <p className="ts-stat-card__value">{s.value}</p>
                            <p className="ts-stat-card__label">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Month navigation */}
            <div className="ts-month-nav">
                <button className="ts-month-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
                <h2 className="ts-month-title">{MONTHS_ES[viewMonth]} {viewYear}</h2>
                <button className="ts-month-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
            </div>

            {/* Filters */}
            <div className="workers-toolbar" style={{ marginBottom: 12 }}>
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterWorker} onChange={e => setFilterWorker(e.target.value)}>
                        <option value="">Todos los Workers</option>
                        {workers.map(w => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                        <option value="">Todos los Proyectos</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="all">Todos los Status</option>
                        <option value="pending">Pendientes</option>
                        <option value="approved">Aprobadas</option>
                        <option value="flagged">Flaggeadas</option>
                        <option value="rejected">Rechazadas</option>
                        <option value="live">En vivo</option>
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>

                {/* Bulk actions */}
                {selected.size > 0 ? (
                    <div className="ts-bulk-actions">
                        <span className="ts-bulk-count">{selected.size} seleccionada{selected.size > 1 ? 's' : ''}</span>
                        <button className="ts-bulk-btn ts-bulk-btn--approve" onClick={() => doBulk('approved')} disabled={bulkLoading}>
                            <CheckCircle size={13} /> Aprobar
                        </button>
                        <button className="ts-bulk-btn ts-bulk-btn--reject" onClick={() => doBulk('rejected')} disabled={bulkLoading}>
                            <XCircle size={13} /> Rechazar
                        </button>
                        <button className="ts-bulk-btn ts-bulk-btn--clear" onClick={clearSel}>
                            <X size={13} /> Deseleccionar
                        </button>
                    </div>
                ) : (
                    <button className="ts-select-all-btn" onClick={selectAll}>
                        Seleccionar todo ({filteredEntries.length})
                    </button>
                )}
            </div>

            {/* Calendar */}
            {loading ? (
                <div className="workers-empty"><Clock size={40} /><p>Cargando horas...</p></div>
            ) : (
                <div className="ts-calendar">
                    {/* Day headers */}
                    <div className="ts-cal-header">
                        <div className="ts-cal-week-label"></div>
                        {DAYS_SHORT.map(d => <div key={d} className="ts-cal-day-header">{d}</div>)}
                        <div className="ts-cal-week-summary-header">Semana</div>
                    </div>

                    {calendarWeeks.map((week, wi) => (
                        <div key={wi} className="ts-cal-row">
                            {/* Week label */}
                            <div className="ts-cal-week-label">
                                <span>S{wi + 1}</span>
                            </div>

                            {/* Day cells */}
                            {week.map((day, di) => {
                                const key = toYMD(day);
                                const dayEntries = entriesByDay[key] || [];
                                const isToday = key === toYMD(today);
                                const isOtherMonth = day.getMonth() !== viewMonth;

                                return (
                                    <div key={di} className={`ts-cal-cell ${isOtherMonth ? 'ts-cal-cell--other' : ''} ${isToday ? 'ts-cal-cell--today' : ''}`}>
                                        <div className="ts-cal-cell__date">{day.getDate()}</div>
                                        <div className="ts-cal-cell__entries">
                                            {dayEntries.map(e => (
                                                <CellEntry
                                                    key={e.id}
                                                    entry={e}
                                                    selected={selected.has(e.id)}
                                                    onSelect={toggleSelect}
                                                    onClick={setDrawerEntry}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Week summary */}
                            <WeekSummary
                                weekDays={week}
                                entries={filteredEntries}
                                onApproveWeek={doApproveWeek}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Entry Drawer */}
            {drawerEntry && (
                <EntryDrawer
                    entry={drawerEntry}
                    api={api}
                    showToast={showToast}
                    onClose={() => setDrawerEntry(null)}
                    onUpdated={handleEntryUpdated}
                    onDeleted={handleEntryDeleted}
                    onEdit={e => { setEditEntry(e); setModalMode('edit'); setDrawerEntry(null); }}
                />
            )}

            {/* Entry Modal */}
            {modalMode && (
                <EntryModal
                    mode={modalMode}
                    entry={editEntry}
                    workers={workers}
                    projects={projects}
                    api={api}
                    showToast={showToast}
                    onSaved={handleEntrySaved}
                    onClose={() => { setModalMode(null); setEditEntry(null); }}
                    currentUser={user}
                />
            )}
        </div>
    );
}
