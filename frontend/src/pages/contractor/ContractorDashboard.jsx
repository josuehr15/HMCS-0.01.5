import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useApi from '../../hooks/useApi';
import {
    Clock, CheckCircle2, MapPin, TrendingUp,
    FileText, User, DollarSign, AlertCircle,
    ChevronRight, Briefcase,
} from 'lucide-react';
import './ContractorDashboard.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const fmtHours = (h) => `${parseFloat(h || 0).toFixed(1)}h`;

const fmtTime = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const fmtDate = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const OT_THRESHOLD = 40;

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent }) {
    return (
        <div className="cd-kpi" style={accent ? { borderTopColor: accent } : {}}>
            <p className="cd-kpi__label">{label}</p>
            <p className="cd-kpi__value" style={accent ? { color: accent } : {}}>{value}</p>
            {sub && <p className="cd-kpi__sub">{sub}</p>}
        </div>
    );
}

// ─── Clock Status Card ────────────────────────────────────────────────────────
function ClockStatusCard({ openEntry, navigate }) {
    const isIn = !!openEntry;
    const elapsed = isIn ? (() => {
        const diff = Date.now() - new Date(openEntry.clock_in).getTime();
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `${h}h ${m}m`;
    })() : null;

    return (
        <div className={`cd-clock-card ${isIn ? 'cd-clock-card--in' : 'cd-clock-card--out'}`}>
            <div className="cd-clock-card__icon">
                {isIn
                    ? <CheckCircle2 size={28} />
                    : <Clock size={28} />}
            </div>
            <div className="cd-clock-card__body">
                <div className="cd-clock-card__status">
                    {isIn ? 'Clock In activo' : 'Sin clock in'}
                </div>
                {isIn ? (
                    <div className="cd-clock-card__detail">
                        Desde {fmtTime(openEntry.clock_in)} · {fmtDate(openEntry.clock_in)}
                        {elapsed && <span className="cd-clock-card__elapsed"> · {elapsed} transcurridos</span>}
                        {openEntry.project && (
                            <div className="cd-clock-card__project">
                                <MapPin size={11} /> {openEntry.project.name}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="cd-clock-card__detail">No hay una entrada activa hoy</div>
                )}
            </div>
            <button
                className="cd-clock-card__btn"
                onClick={() => navigate('/contractor/clock')}
            >
                {isIn ? 'Clock Out' : 'Clock In'}
                <ChevronRight size={16} />
            </button>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ContractorDashboard() {
    const { user } = useAuth();
    const { get } = useApi();
    const navigate = useNavigate();

    const [entries, setEntries] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const [entriesRes, assignRes] = await Promise.all([
                get('/time-entries/my'),
                get('/assignments/my'),
            ]);
            setEntries(Array.isArray(entriesRes?.data) ? entriesRes.data : []);
            const asgns = Array.isArray(assignRes?.data) ? assignRes.data : [];
            setAssignments(asgns.filter(a => a.status === 'active'));
        } catch {
            setError('No se pudo cargar el dashboard.');
        } finally {
            setLoading(false);
        }
    }, [get]);

    useEffect(() => { load(); }, [load]);

    // ── Compute KPIs ──────────────────────────────────────────────────────────
    const now = new Date();
    const thisWeekStart  = getWeekStart(now);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let weekHours = 0, monthHours = 0, totalHours = 0;
    const weekSet = new Set();

    entries.forEach(e => {
        const h = parseFloat(e.total_hours || 0);
        if (!h) return;
        const d = new Date(e.clock_in);
        totalHours += h;
        if (d >= thisWeekStart)  weekHours  += h;
        if (d >= thisMonthStart) monthHours += h;
        weekSet.add(getWeekStart(d).toISOString());
    });

    const weekOT     = Math.max(0, weekHours - OT_THRESHOLD);
    const weekReg    = Math.min(weekHours, OT_THRESHOLD);
    const openEntry  = entries.find(e => !e.clock_out) || null;

    // Last 5 completed entries for recent activity
    const recentEntries = entries
        .filter(e => e.clock_out)
        .slice(0, 5);

    const firstName = user?.email?.split('@')[0]?.split('.')[0] || 'Contractor';
    const greetName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

    if (loading) return (
        <div className="cd-loading">
            <Clock size={32} className="cd-loading__spin" />
            <p>Cargando dashboard...</p>
        </div>
    );

    return (
        <div className="cd-page fade-in">

            {/* ── Greeting ── */}
            <div className="cd-greeting">
                <h2 className="cd-greeting__name">Hola, {greetName} 👋</h2>
                <p className="cd-greeting__date">
                    {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {error && (
                <div className="cd-error">
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            {/* ── Clock Status ── */}
            <ClockStatusCard openEntry={openEntry} navigate={navigate} />

            {/* ── KPIs ── */}
            <div className="cd-kpi-grid">
                <KpiCard
                    label="Esta semana"
                    value={fmtHours(weekHours)}
                    sub={weekOT > 0 ? `OT: ${fmtHours(weekOT)}` : `Reg: ${fmtHours(weekReg)}`}
                    accent="#2A6C95"
                />
                <KpiCard
                    label="Este mes"
                    value={fmtHours(monthHours)}
                    sub={`~${Math.round(monthHours / 8)} días`}
                />
                <KpiCard
                    label="Total histórico"
                    value={fmtHours(totalHours)}
                    sub={`${weekSet.size} semanas`}
                />
                <KpiCard
                    label="Proyectos activos"
                    value={String(assignments.length)}
                    sub={assignments.length > 0 ? 'Ver asignaciones' : 'Sin asignaciones'}
                    accent={assignments.length > 0 ? '#08543D' : undefined}
                />
            </div>

            {/* ── Active Assignments ── */}
            {assignments.length > 0 && (
                <section className="cd-section">
                    <h3 className="cd-section__title">
                        <Briefcase size={15} /> Proyectos asignados
                    </h3>
                    <div className="cd-assignments">
                        {assignments.map(a => (
                            <div key={a.id} className="cd-assignment">
                                <div className="cd-assignment__dot" />
                                <div className="cd-assignment__info">
                                    <div className="cd-assignment__name">
                                        {a.project?.name || `Proyecto #${a.project_id}`}
                                    </div>
                                    <div className="cd-assignment__meta">
                                        {a.project?.address && (
                                            <span><MapPin size={10} /> {a.project.address}</span>
                                        )}
                                        {a.start_date && (
                                            <span>Desde {fmtDate(a.start_date)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Recent Activity ── */}
            {recentEntries.length > 0 && (
                <section className="cd-section">
                    <h3 className="cd-section__title">
                        <TrendingUp size={15} /> Actividad reciente
                    </h3>
                    <div className="cd-recent">
                        {recentEntries.map(e => (
                            <div key={e.id} className="cd-recent__item">
                                <div className="cd-recent__date">{fmtDate(e.clock_in)}</div>
                                <div className="cd-recent__times">
                                    {fmtTime(e.clock_in)} → {fmtTime(e.clock_out)}
                                </div>
                                <div className="cd-recent__right">
                                    {e.project && (
                                        <span className="cd-recent__project">{e.project.name}</span>
                                    )}
                                    <span className="cd-recent__hours">{fmtHours(e.total_hours)}</span>
                                    <span className={`cd-recent__badge cd-recent__badge--${e.status || 'pending'}`}>
                                        {e.status === 'approved' ? 'Aprobado' : e.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button className="cd-see-all" onClick={() => navigate('/contractor/hours')}>
                        Ver historial completo <ChevronRight size={14} />
                    </button>
                </section>
            )}

            {/* ── Quick Actions ── */}
            <section className="cd-section">
                <h3 className="cd-section__title">Accesos rápidos</h3>
                <div className="cd-quick-actions">
                    <button className="cd-quick-btn" onClick={() => navigate('/contractor/clock')}>
                        <Clock size={20} />
                        <span>Reloj</span>
                    </button>
                    <button className="cd-quick-btn" onClick={() => navigate('/contractor/hours')}>
                        <FileText size={20} />
                        <span>Mis Horas</span>
                    </button>
                    <button className="cd-quick-btn" onClick={() => navigate('/contractor/payments')}>
                        <DollarSign size={20} />
                        <span>Mis Pagos</span>
                    </button>
                    <button className="cd-quick-btn" onClick={() => navigate('/contractor/profile')}>
                        <User size={20} />
                        <span>Mi Perfil</span>
                    </button>
                </div>
            </section>

        </div>
    );
}
