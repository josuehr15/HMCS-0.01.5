/**
 * WeekCalendar.jsx
 * Componente reutilizable — vista de calendario semanal de disponibilidad.
 *
 * Props (modo single — un worker):
 *   schedule: [ { day_of_week, is_available, start_time, end_time, note } ]
 *
 * Props (modo multi — varios workers):
 *   workers: [ { worker_id, first_name, last_name, schedule: [...] } ]
 *
 * Si se pasan `workers`, renderiza la variante multi.
 * Si se pasa `schedule`, renderiza la variante single (hourly grid).
 */
import './WeekCalendar.css';

const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ─── Helpers ─────────────────────────────────────────────────────────────
const timeToMinutes = (t) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
};

const fmt = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
};

// Horas a mostrar en el eje (6am-9pm, cada hora)
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6..21

// ─── Single view (contractor) ─────────────────────────────────────────────
export const SingleWeekCalendar = ({ schedule }) => {
    // Para cada hora y cada día, ¿está dentro del rango de trabajo?
    const isActive = (dayIdx, hour) => {
        const day = schedule[dayIdx];
        if (!day || !day.is_available) return false;
        const start = timeToMinutes(day.start_time);
        const end   = timeToMinutes(day.end_time);
        const hMin  = hour * 60;
        return hMin >= start && hMin < end;
    };

    const isFirstActive = (dayIdx, hour) => {
        const day = schedule[dayIdx];
        if (!day || !day.is_available) return false;
        const start = timeToMinutes(day.start_time);
        return hour * 60 === start;
    };

    return (
        <div className="wc wc--single">
            {/* Header */}
            <div className="wc__head">
                <div className="wc__head-cell" /> {/* time column */}
                {DAY_SHORT.map(d => (
                    <div key={d} className="wc__head-cell">{d}</div>
                ))}
            </div>

            {/* Rows — one per hour */}
            <div className="wc__body">
                {HOURS.map(hour => (
                    <div key={hour} className="wc__row">
                        <div className="wc__time-label">
                            {fmt(`${hour}:00`)}
                        </div>
                        {schedule.map((day, dayIdx) => {
                            const active = isActive(dayIdx, hour);
                            const first  = isFirstActive(dayIdx, hour);
                            let cls = 'wc__cell';
                            if (!day.is_available) cls += ' wc__cell--off';
                            else if (active)       cls += ' wc__cell--active';
                            if (first)             cls += ' wc__cell--first-active';

                            return (
                                <div
                                    key={dayIdx}
                                    className={cls}
                                    data-label={first ? `${fmt(day.start_time)}–${fmt(day.end_time)}` : undefined}
                                    title={day.is_available
                                        ? `${DAY_SHORT[dayIdx]}: ${day.start_time}–${day.end_time}${day.note ? ` · ${day.note}` : ''}`
                                        : `${DAY_SHORT[dayIdx]}: No disponible`}
                                />
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="wc__legend">
                <div className="wc__legend-item">
                    <div className="wc__legend-swatch" style={{ background: 'color-mix(in srgb, var(--primary-color, #2563eb) 15%, transparent)', border: '1px solid var(--border-color)' }} />
                    Horario disponible
                </div>
                <div className="wc__legend-item">
                    <div className="wc__legend-swatch" style={{ backgroundImage: 'repeating-linear-gradient(-45deg,transparent,transparent 4px,rgba(0,0,0,0.08) 4px,rgba(0,0,0,0.08) 5px)' }} />
                    No disponible
                </div>
            </div>
        </div>
    );
};

// ─── Multi view (admin) ────────────────────────────────────────────────────
export const MultiWeekCalendar = ({ workers }) => {
    if (!workers || workers.length === 0) return null;

    // Color por disponibilidad general del worker
    const workerDotColor = (schedule) => {
        const n = schedule.filter(d => d.is_available).length;
        if (n === 0) return '#ef4444';
        if (n < 5)   return '#f59e0b';
        return '#10b981';
    };

    return (
        <div className="wc wc--multi">
            {/* Header */}
            <div className="wc__head">
                <div className="wc__head-cell" style={{ textAlign: 'left', paddingLeft: '0.5rem' }}>Worker</div>
                {DAY_SHORT.map(d => (
                    <div key={d} className="wc__head-cell">{d}</div>
                ))}
            </div>

            {/* One row per worker */}
            <div className="wc__body">
                {workers.map((worker) => (
                    <div key={worker.worker_id} className="wc__row">
                        {/* Worker name label */}
                        <div className="wc__worker-label">
                            <div
                                className="wc__worker-dot"
                                style={{ background: workerDotColor(worker.schedule) }}
                            />
                            <span title={`${worker.first_name} ${worker.last_name}`}>
                                {worker.first_name} {worker.last_name[0]}.
                            </span>
                        </div>

                        {/* 7 day cells */}
                        {worker.schedule.map((day) => (
                            <div
                                key={day.day_of_week}
                                className={`wc__day-cell ${day.is_available ? 'wc__day-cell--available' : 'wc__day-cell--unavailable'}`}
                                title={day.is_available
                                    ? `${DAY_SHORT[day.day_of_week]}: ${day.start_time}–${day.end_time}${day.note ? ` · ${day.note}` : ''}`
                                    : `${DAY_SHORT[day.day_of_week]}: No disponible`}
                            >
                                {day.is_available ? (
                                    <>
                                        <div className="wc__day-hours">
                                            {fmt(day.start_time)}
                                        </div>
                                        <div className="wc__day-hours" style={{ opacity: 0.65 }}>
                                            {fmt(day.end_time)}
                                        </div>
                                        {day.note && (
                                            <div className="wc__day-note">{day.note}</div>
                                        )}
                                    </>
                                ) : (
                                    <div className="wc__day-off-label">—</div>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="wc__legend">
                <div className="wc__legend-item">
                    <div className="wc__legend-swatch" style={{ background: 'color-mix(in srgb, #10b981 12%, transparent)', border: '1px solid #10b981' }} />
                    Disponible
                </div>
                <div className="wc__legend-item">
                    <div className="wc__legend-swatch" style={{ background: 'color-mix(in srgb, var(--border-color) 30%, transparent)', border: '1px solid var(--border-color)' }} />
                    No disponible
                </div>
                <div className="wc__legend-item">
                    <div className="wc__legend-swatch" style={{ background: '#10b981', borderRadius: '50%', width: 10, height: 10 }} />
                    ≥5 días
                </div>
                <div className="wc__legend-item">
                    <div className="wc__legend-swatch" style={{ background: '#f59e0b', borderRadius: '50%', width: 10, height: 10 }} />
                    &lt;5 días
                </div>
                <div className="wc__legend-item">
                    <div className="wc__legend-swatch" style={{ background: '#ef4444', borderRadius: '50%', width: 10, height: 10 }} />
                    Sin días
                </div>
            </div>
        </div>
    );
};
