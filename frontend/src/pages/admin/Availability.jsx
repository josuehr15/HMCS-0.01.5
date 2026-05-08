/**
 * Availability.jsx  (Admin)
 * /admin/availability
 * Muestra la disponibilidad semanal de todos los workers activos.
 * El admin puede editar la disponibilidad de cualquier worker mediante un modal.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { MultiWeekCalendar } from '../../components/WeekCalendar';
import './Availability.css';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ─── Toggle (mini) ──────────────────────────────────────────────────────
const Toggle = ({ on, onChange }) => (
    <label className="av-toggle" onClick={() => onChange(!on)}>
        <div className={`av-toggle__track${on ? ' av-toggle__track--on' : ''}`}>
            <div className="av-toggle__thumb" />
        </div>
    </label>
);

// ─── Modal para editar disponibilidad de un worker ──────────────────────
const EditModal = ({ worker, onClose, onSaved }) => {
    const [schedule, setSchedule] = useState(worker.schedule.map(d => ({ ...d })));
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState(null);

    const handleField = (idx, field, value) => {
        setSchedule(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
    };

    const handleSave = async () => {
        setSaving(true);
        setErr(null);
        try {
            const payload = schedule.map(({ day_of_week, is_available, start_time, end_time, note }) => ({
                day_of_week,
                is_available,
                start_time,
                end_time,
                note: note || null,
            }));
            const res = await api.put(`/availability/${worker.worker_id}`, { schedule: payload });
            onSaved(worker.worker_id, res.data?.data ?? []);
            onClose();
        } catch {
            setErr('Error al guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="av-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="av-modal">
                <div className="av-modal__header">
                    <h2 className="av-modal__title">
                        Disponibilidad — {worker.first_name} {worker.last_name}
                    </h2>
                    <button className="av-modal__close" onClick={onClose}>✕</button>
                </div>

                <div className="av-modal__body">
                    {schedule.map((day, idx) => (
                        <div
                            key={day.day_of_week}
                            className={`av-modal__day${!day.is_available ? ' av-modal__day--unavailable' : ''}`}
                        >
                            <div className="av-modal__day-header">
                                <span className="av-modal__day-name">{DAY_NAMES_FULL[day.day_of_week]}</span>
                                <Toggle
                                    on={day.is_available}
                                    onChange={(v) => handleField(idx, 'is_available', v)}
                                />
                            </div>

                            {day.is_available && (
                                <>
                                    <div className="av-modal__times">
                                        <span className="av-modal__times-lbl">Horario</span>
                                        <input
                                            type="time"
                                            className="av-modal__time-input"
                                            value={day.start_time}
                                            onChange={(e) => handleField(idx, 'start_time', e.target.value)}
                                        />
                                        <span className="av-modal__sep">—</span>
                                        <input
                                            type="time"
                                            className="av-modal__time-input"
                                            value={day.end_time}
                                            onChange={(e) => handleField(idx, 'end_time', e.target.value)}
                                        />
                                    </div>
                                    <div className="av-modal__note">
                                        <textarea
                                            className="av-modal__note-input"
                                            rows={1}
                                            placeholder="Nota (opcional)…"
                                            value={day.note || ''}
                                            onChange={(e) => handleField(idx, 'note', e.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                    {err && <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: 0 }}>{err}</p>}
                </div>

                <div className="av-modal__footer">
                    <button className="av-modal__btn av-modal__btn--cancel" onClick={onClose} disabled={saving}>
                        Cancelar
                    </button>
                    <button className="av-modal__btn av-modal__btn--save" onClick={handleSave} disabled={saving}>
                        {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Card de un worker ──────────────────────────────────────────────────
const WorkerCard = ({ worker, onEdit }) => {
    const availDays = worker.schedule.filter(d => d.is_available).length;
    const statusLabel = availDays === 0 ? 'No disponible' : availDays < 5 ? 'Limitado' : 'Disponible';
    const statusClass = availDays === 0 ? 'av-status--unavailable' : availDays < 5 ? 'av-status--limited' : 'av-status--available';
    const initials = `${worker.first_name[0]}${worker.last_name[0]}`.toUpperCase();

    return (
        <div className="av-card">
            <div className="av-card__head">
                <div className="av-card__info">
                    <div className="av-card__avatar">{initials}</div>
                    <div>
                        <div className="av-card__name">{worker.first_name} {worker.last_name}</div>
                        <div className="av-card__code">{worker.worker_code}</div>
                    </div>
                </div>
                <span className={`av-status ${statusClass}`}>{statusLabel}</span>
            </div>

            <div className="av-card__schedule">
                {worker.schedule.map(day => (
                    <div
                        key={day.day_of_week}
                        className={`av-day-row${!day.is_available ? ' av-day-row--unavailable' : ''}`}
                    >
                        <div className={`av-day-dot ${day.is_available ? 'av-day-dot--on' : 'av-day-dot--off'}`} />
                        <span className="av-day-name">{DAY_NAMES[day.day_of_week]}</span>
                        {day.is_available
                            ? <span className="av-day-hours">{day.start_time} – {day.end_time}</span>
                            : <span className="av-day-hours" style={{ color: 'var(--text-muted)' }}>No disponible</span>
                        }
                        {day.is_available && day.note && (
                            <span className="av-day-note" title={day.note}>{day.note}</span>
                        )}
                    </div>
                ))}

                <button
                    style={{
                        marginTop: '0.5rem',
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        color: 'var(--primary-color, #2563eb)',
                        cursor: 'pointer',
                        alignSelf: 'flex-start',
                    }}
                    onClick={() => onEdit(worker)}
                >
                    Editar horario
                </button>
            </div>
        </div>
    );
};

// ─── Página principal ───────────────────────────────────────────────────
const Availability = () => {
    const [workers, setWorkers] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); // all | available | limited | unavailable
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [toast, setToast] = useState(null);
    const [viewTab, setViewTab] = useState('cards'); // 'cards' | 'calendar'

    const showToast = (ok, msg) => {
        setToast({ ok, msg });
        setTimeout(() => setToast(null), 3000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/availability');
            setWorkers(res.data?.data ?? []);
        } catch {
            showToast(false, 'Error al cargar disponibilidad');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Filtrar workers
    useEffect(() => {
        let list = [...workers];

        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(w =>
                `${w.first_name} ${w.last_name}`.toLowerCase().includes(q) ||
                w.worker_code?.toLowerCase().includes(q)
            );
        }

        if (filterStatus !== 'all') {
            list = list.filter(w => {
                const avail = w.schedule.filter(d => d.is_available).length;
                if (filterStatus === 'available') return avail >= 5;
                if (filterStatus === 'limited') return avail > 0 && avail < 5;
                if (filterStatus === 'unavailable') return avail === 0;
                return true;
            });
        }

        setFiltered(list);
    }, [workers, search, filterStatus]);

    const handleSaved = (workerId, freshSchedule) => {
        setWorkers(prev => prev.map(w =>
            w.worker_id === workerId ? { ...w, schedule: freshSchedule } : w
        ));
        showToast(true, 'Disponibilidad actualizada');
    };

    const counts = {
        available: workers.filter(w => w.schedule.filter(d => d.is_available).length >= 5).length,
        limited: workers.filter(w => { const n = w.schedule.filter(d => d.is_available).length; return n > 0 && n < 5; }).length,
        unavailable: workers.filter(w => w.schedule.filter(d => d.is_available).length === 0).length,
    };

    return (
        <div className="av-page">
            <div className="av-header">
                <div>
                    <h1 className="av-header__title">Disponibilidad de Workers</h1>
                    <p className="av-header__subtitle">{workers.length} workers activos en el sistema</p>
                </div>
                {/* View tabs */}
                <div className="av-view-tabs">
                    <button
                        className={`av-view-tab${viewTab === 'cards' ? ' av-view-tab--active' : ''}`}
                        onClick={() => setViewTab('cards')}
                    >
                        Tarjetas
                    </button>
                    <button
                        className={`av-view-tab${viewTab === 'calendar' ? ' av-view-tab--active' : ''}`}
                        onClick={() => setViewTab('calendar')}
                    >
                        Calendario
                    </button>
                </div>
            </div>

            {/* Stat strip */}
            <div className="av-stats">
                <div className="av-stat" style={{ '--av-accent': '#10B981' }}>
                    <div className="av-stat__icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>✓</div>
                    <div>
                        <div className="av-stat__value">{counts.available}</div>
                        <div className="av-stat__label">Disponibles (≥5 días)</div>
                    </div>
                </div>
                <div className="av-stat" style={{ '--av-accent': '#D97706' }}>
                    <div className="av-stat__icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706' }}>◑</div>
                    <div>
                        <div className="av-stat__value">{counts.limited}</div>
                        <div className="av-stat__label">Disponibilidad limitada</div>
                    </div>
                </div>
                <div className="av-stat" style={{ '--av-accent': '#EF4444' }}>
                    <div className="av-stat__icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>✕</div>
                    <div>
                        <div className="av-stat__value">{counts.unavailable}</div>
                        <div className="av-stat__label">No disponibles</div>
                    </div>
                </div>
            </div>

            <div className="av-toolbar">
                <input
                    type="text"
                    className="av-search"
                    placeholder="Buscar por nombre o código…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {[
                    { key: 'all', label: 'Todos' },
                    { key: 'available', label: `Disponibles (${counts.available})` },
                    { key: 'limited', label: `Limitados (${counts.limited})` },
                    { key: 'unavailable', label: `No disponibles (${counts.unavailable})` },
                ].map(f => (
                    <button
                        key={f.key}
                        className={`av-filter-btn${filterStatus === f.key ? ' av-filter-btn--active' : ''}`}
                        onClick={() => setFilterStatus(f.key)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Vista Tarjetas */}
            {viewTab === 'cards' && (
                <div className="av-grid">
                    {loading && <div className="av-loading">Cargando disponibilidad…</div>}
                    {!loading && filtered.length === 0 && (
                        <div className="av-empty">No se encontraron workers con esos filtros.</div>
                    )}
                    {!loading && filtered.map(worker => (
                        <WorkerCard
                            key={worker.worker_id}
                            worker={worker}
                            onEdit={setEditing}
                        />
                    ))}
                </div>
            )}

            {/* Vista Calendario */}
            {viewTab === 'calendar' && (
                <div className="av-calendar-wrap">
                    {loading && <div className="av-loading">Cargando disponibilidad…</div>}
                    {!loading && filtered.length === 0 && (
                        <div className="av-empty">No se encontraron workers con esos filtros.</div>
                    )}
                    {!loading && filtered.length > 0 && (
                        <MultiWeekCalendar workers={filtered} />
                    )}
                </div>
            )}

            {editing && (
                <EditModal
                    worker={editing}
                    onClose={() => setEditing(null)}
                    onSaved={handleSaved}
                />
            )}

            {toast && (
                <div className={`av-toast av-toast--${toast.ok ? 'ok' : 'err'}`}>{toast.msg}</div>
            )}
        </div>
    );
};

export default Availability;
