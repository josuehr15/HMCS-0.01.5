import { useState, useEffect, useCallback } from 'react';
import useApi from '../../hooks/useApi';
import { Clock, MapPin, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import './MyHours.css';

// Get Monday of a given date's week
const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getWeekEnd = (weekStart) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
};

const fmtHours = (h) => {
    const n = parseFloat(h || 0);
    return n.toFixed(1) + 'h';
};

const fmtTime = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const fmtShortDate = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const fmtWeekRange = (start, end) => {
    const s = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${s} – ${e}`;
};

// Group entries by week (Monday-based)
const groupByWeek = (entries) => {
    const weeks = {};
    entries.forEach((entry) => {
        const ws = getWeekStart(entry.clock_in);
        const key = ws.toISOString();
        if (!weeks[key]) {
            weeks[key] = { weekStart: ws, weekEnd: getWeekEnd(ws), entries: [] };
        }
        weeks[key].entries.push(entry);
    });
    // Sort weeks descending
    return Object.values(weeks).sort((a, b) => b.weekStart - a.weekStart);
};

const OT_THRESHOLD = 40;

const WeekCard = ({ week }) => {
    const [expanded, setExpanded] = useState(false);

    const totalHours = week.entries.reduce((s, e) => s + parseFloat(e.total_hours || 0), 0);
    const regularHours = Math.min(totalHours, OT_THRESHOLD);
    const otHours = Math.max(0, totalHours - OT_THRESHOLD);
    const hasOT = otHours > 0;

    const statusBadge = (entry) => {
        if (!entry.clock_out) return <span className="mh-badge mh-badge--open">Abierto</span>;
        if (entry.status === 'approved') return <span className="mh-badge mh-badge--approved">Aprobado</span>;
        if (entry.status === 'rejected') return <span className="mh-badge mh-badge--rejected">Rechazado</span>;
        return <span className="mh-badge mh-badge--pending">Pendiente</span>;
    };

    return (
        <div className={`mh-week ${hasOT ? 'mh-week--ot' : ''}`}>
            <button className="mh-week__header" onClick={() => setExpanded(v => !v)}>
                <div className="mh-week__left">
                    <Calendar size={15} className="mh-week__cal-icon" />
                    <div>
                        <div className="mh-week__range">{fmtWeekRange(week.weekStart, week.weekEnd)}</div>
                        <div className="mh-week__count">{week.entries.length} registro{week.entries.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>
                <div className="mh-week__right">
                    <div className="mh-week__totals">
                        <span className="mh-week__total-label">Total</span>
                        <span className="mh-week__total-val">{fmtHours(totalHours)}</span>
                        {hasOT && (
                            <span className="mh-week__ot-badge">OT {fmtHours(otHours)}</span>
                        )}
                    </div>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            {expanded && (
                <div className="mh-week__entries">
                    {/* Hours summary bar */}
                    <div className="mh-summary">
                        <div className="mh-summary__item">
                            <span className="mh-summary__label">Regular</span>
                            <span className="mh-summary__val">{fmtHours(regularHours)}</span>
                        </div>
                        {hasOT && (
                            <div className="mh-summary__item mh-summary__item--ot">
                                <span className="mh-summary__label">Overtime (1.5×)</span>
                                <span className="mh-summary__val mh-summary__val--ot">{fmtHours(otHours)}</span>
                            </div>
                        )}
                        <div className="mh-summary__item mh-summary__item--total">
                            <span className="mh-summary__label">Total semana</span>
                            <span className="mh-summary__val">{fmtHours(totalHours)}</span>
                        </div>
                    </div>

                    {/* Individual entries */}
                    {week.entries.map((entry) => (
                        <div key={entry.id} className="mh-entry">
                            <div className="mh-entry__date">{fmtShortDate(entry.clock_in)}</div>
                            <div className="mh-entry__times">
                                <Clock size={12} />
                                <span>{fmtTime(entry.clock_in)}</span>
                                <span className="mh-entry__arrow">→</span>
                                <span>{entry.clock_out ? fmtTime(entry.clock_out) : <em>Sin salida</em>}</span>
                            </div>
                            {entry.project && (
                                <div className="mh-entry__project">
                                    <MapPin size={11} />
                                    {entry.project.name}
                                </div>
                            )}
                            <div className="mh-entry__footer">
                                {statusBadge(entry)}
                                <span className="mh-entry__hours">
                                    {entry.total_hours ? fmtHours(entry.total_hours) : '—'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function MyHours() {
    const { get } = useApi();
    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalThisWeek, setTotalThisWeek] = useState(0);
    const [totalThisMonth, setTotalThisMonth] = useState(0);

    const loadEntries = useCallback(async () => {
        try {
            setLoading(true);
            const res = await get('/time-entries/my');
            const entries = res?.data || [];

            if (!Array.isArray(entries) || entries.length === 0) {
                setWeeks([]);
                return;
            }

            // Stats
            const now = new Date();
            const thisWeekStart = getWeekStart(now);
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

            let weekHours = 0;
            let monthHours = 0;
            entries.forEach((e) => {
                if (!e.total_hours) return;
                const d = new Date(e.clock_in);
                if (d >= thisWeekStart) weekHours += parseFloat(e.total_hours);
                if (d >= thisMonthStart) monthHours += parseFloat(e.total_hours);
            });

            setTotalThisWeek(weekHours);
            setTotalThisMonth(monthHours);
            setWeeks(groupByWeek(entries));
        } catch {
            setWeeks([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadEntries(); }, [loadEntries]);

    if (loading) return <div className="mh-loading">Cargando horas...</div>;

    return (
        <div className="mh-page fade-in">
            <div className="mh-header">
                <h2>Mis Horas</h2>
                <p>Historial de registros de tiempo</p>
            </div>

            {/* Stats strip */}
            <div className="mh-stats">
                <div className="mh-stat">
                    <span className="mh-stat__label">Esta semana</span>
                    <span className="mh-stat__val">{fmtHours(totalThisWeek)}</span>
                </div>
                <div className="mh-stat__divider" />
                <div className="mh-stat">
                    <span className="mh-stat__label">Este mes</span>
                    <span className="mh-stat__val">{fmtHours(totalThisMonth)}</span>
                </div>
            </div>

            {weeks.length === 0 ? (
                <div className="mh-empty">
                    <Clock size={44} />
                    <p>No hay registros de tiempo aún.</p>
                </div>
            ) : (
                <div className="mh-weeks">
                    {weeks.map((week) => (
                        <WeekCard key={week.weekStart.toISOString()} week={week} />
                    ))}
                </div>
            )}
        </div>
    );
}
