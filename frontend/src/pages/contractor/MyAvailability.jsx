/**
 * MyAvailability.jsx
 * /contractor/availability
 * El contractor ve y edita su disponibilidad semanal.
 * Tabs: Lista (editable) | Calendario (vista visual de horas)
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import { SingleWeekCalendar } from '../../components/WeekCalendar';
import './MyAvailability.css';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Toggle switch visual
const Toggle = ({ on, onChange }) => (
    <label className="mav-toggle" onClick={() => onChange(!on)}>
        <div className={`mav-toggle__track${on ? ' mav-toggle__track--on' : ''}`}>
            <div className="mav-toggle__thumb" />
        </div>
        <span className="mav-toggle__label">{on ? 'Disponible' : 'No disponible'}</span>
    </label>
);

// Un día editable
const DayRow = ({ day, onChange }) => {
    const handleField = (field, value) => onChange({ ...day, [field]: value });

    return (
        <div className={`mav-day${!day.is_available ? ' mav-day--unavailable' : ''}`}>
            <div className="mav-day__header">
                <span className="mav-day__name">{DAY_NAMES[day.day_of_week]}</span>
                <Toggle on={day.is_available} onChange={(v) => handleField('is_available', v)} />
            </div>

            {day.is_available && (
                <>
                    <div className="mav-day__times">
                        <span className="mav-day__times-label">Horario</span>
                        <input
                            type="time"
                            className="mav-time-input"
                            value={day.start_time}
                            onChange={(e) => handleField('start_time', e.target.value)}
                        />
                        <span className="mav-times-sep">—</span>
                        <input
                            type="time"
                            className="mav-time-input"
                            value={day.end_time}
                            onChange={(e) => handleField('end_time', e.target.value)}
                        />
                    </div>
                    <div className="mav-day__note">
                        <textarea
                            className="mav-note-input"
                            rows={1}
                            placeholder="Nota (opcional)…"
                            value={day.note || ''}
                            onChange={(e) => handleField('note', e.target.value)}
                        />
                    </div>
                </>
            )}
        </div>
    );
};

const MyAvailability = () => {
    const [original, setOriginal] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [tab, setTab] = useState('list'); // 'list' | 'calendar'

    const showToast = (ok, msg) => {
        setToast({ ok, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/availability');
            const data = res.data?.data ?? [];
            setOriginal(data);
            setSchedule(data.map(d => ({ ...d })));
        } catch {
            showToast(false, 'Error al cargar disponibilidad');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleChange = (idx, updated) => {
        setSchedule(prev => prev.map((d, i) => i === idx ? updated : d));
    };

    const handleReset = () => {
        if (original) setSchedule(original.map(d => ({ ...d })));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = schedule.map(({ day_of_week, is_available, start_time, end_time, note }) => ({
                day_of_week,
                is_available,
                start_time,
                end_time,
                note: note || null,
            }));
            const res = await api.put('/availability', { schedule: payload });
            const fresh = res.data?.data ?? [];
            setOriginal(fresh);
            setSchedule(fresh.map(d => ({ ...d })));
            showToast(true, 'Disponibilidad guardada correctamente');
        } catch {
            showToast(false, 'Error al guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="mav-loading">Cargando disponibilidad…</div>;

    return (
        <div className="mav-page">
            <h1 className="mav-page__title">Mi Disponibilidad</h1>
            <p className="mav-page__subtitle">Indica los días y horarios en los que estás disponible para trabajar.</p>

            {/* Tabs */}
            <div className="mav-tabs">
                <button
                    className={`mav-tab${tab === 'list' ? ' mav-tab--active' : ''}`}
                    onClick={() => setTab('list')}
                >
                    Lista
                </button>
                <button
                    className={`mav-tab${tab === 'calendar' ? ' mav-tab--active' : ''}`}
                    onClick={() => setTab('calendar')}
                >
                    Calendario
                </button>
            </div>

            {/* Vista Lista */}
            {tab === 'list' && (
                <>
                    <div className="mav-grid">
                        {schedule.map((day, idx) => (
                            <DayRow
                                key={day.day_of_week}
                                day={day}
                                onChange={(updated) => handleChange(idx, updated)}
                            />
                        ))}
                    </div>

                    <div className="mav-actions">
                        <button className="mav-btn mav-btn--reset" onClick={handleReset} disabled={saving}>
                            Resetear
                        </button>
                        <button className="mav-btn mav-btn--save" onClick={handleSave} disabled={saving}>
                            {saving ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                    </div>
                </>
            )}

            {/* Vista Calendario */}
            {tab === 'calendar' && (
                <div className="mav-calendar-wrap">
                    <p className="mav-calendar-hint">
                        Vista de tu horario semanal. Edita los días desde la pestaña "Lista".
                    </p>
                    <SingleWeekCalendar schedule={schedule} />
                </div>
            )}

            {toast && (
                <div className={`mav-toast mav-toast--${toast.ok ? 'ok' : 'err'}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

export default MyAvailability;
