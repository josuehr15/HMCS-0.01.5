import { useState, useEffect, useCallback } from 'react';
import {
    BarChart2, Star, TrendingUp, Clock, Briefcase, Search,
    ChevronRight, X, RefreshCw, CheckCircle2, AlertCircle,
    Award, Users, ArrowLeft, Filter,
} from 'lucide-react';
import api from '../../utils/api';
import './Performance.css';

// ─── Star Rating Component ──────────────────────────────────────────────────
const StarRating = ({ value, max = 5, size = 16, onChange }) => {
    const [hover, setHover] = useState(0);
    return (
        <div className="perf-stars" style={{ '--star-size': `${size}px` }}>
            {Array.from({ length: max }, (_, i) => i + 1).map(star => (
                <button
                    key={star}
                    type="button"
                    className={`perf-star ${star <= (hover || value) ? 'perf-star--on' : ''}`}
                    onClick={() => onChange && onChange(star)}
                    onMouseEnter={() => onChange && setHover(star)}
                    onMouseLeave={() => onChange && setHover(0)}
                    style={{ cursor: onChange ? 'pointer' : 'default' }}
                >
                    ★
                </button>
            ))}
        </div>
    );
};

// ─── KPI Card ───────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, color }) => (
    <div className="perf-kpi" style={{ '--perf-kpi-color': color }}>
        <div className="perf-kpi__icon" style={{ background: `${color}18`, color }}>
            <Icon size={20} />
        </div>
        <div>
            <div className="perf-kpi__value">{value}</div>
            <div className="perf-kpi__label">{label}</div>
            {sub && <div className="perf-kpi__sub">{sub}</div>}
        </div>
    </div>
);

// ─── Worker Row (list) ──────────────────────────────────────────────────────
const WorkerRow = ({ w, onSelect }) => {
    const rating = w.avg_rating ? parseFloat(w.avg_rating) : null;
    const rateColor = !rating ? '#94a3b8' : rating >= 4 ? '#10B981' : rating >= 3 ? '#F59E0B' : '#EF4444';

    return (
        <tr className="perf-row" onClick={() => onSelect(w)}>
            <td>
                <div className="perf-worker-cell">
                    <div className="perf-avatar">{w.first_name.charAt(0)}</div>
                    <div>
                        <div className="perf-worker-name">{w.first_name} {w.last_name}</div>
                        <div className="perf-worker-code">{w.worker_code}</div>
                    </div>
                </div>
            </td>
            <td>{w.trade || '—'}</td>
            <td>
                <span className={`perf-avail perf-avail--${w.availability}`}>
                    {w.availability === 'available' ? 'Disponible'
                        : w.availability === 'assigned' ? 'Asignado' : 'No disponible'}
                </span>
            </td>
            <td className="perf-num">{w.total_hours.toFixed(1)} h</td>
            <td className="perf-num">{w.approval_rate !== null ? `${w.approval_rate}%` : '—'}</td>
            <td className="perf-num">{w.projects_worked}</td>
            <td className="perf-num">{w.assignments_completed}</td>
            <td>
                {rating ? (
                    <div className="perf-rating-cell">
                        <span style={{ color: rateColor, fontWeight: 700 }}>{rating.toFixed(1)}</span>
                        <Star size={13} fill={rateColor} stroke={rateColor} />
                        <span className="perf-rating-cnt">({w.rating_count})</span>
                    </div>
                ) : <span className="perf-muted">Sin rating</span>}
            </td>
            <td><ChevronRight size={15} style={{ color: 'var(--text-muted)' }} /></td>
        </tr>
    );
};

// ─── Rating Modal ────────────────────────────────────────────────────────────
const RatingModal = ({ worker, projects, onClose, onSaved }) => {
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [projectId, setProjectId] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        if (!rating) { setError('Selecciona un rating (1-5 estrellas).'); return; }
        try {
            setSaving(true);
            await api.post('/ratings', {
                worker_id: worker.id,
                project_id: projectId || null,
                rating,
                comment,
            });
            onSaved();
            onClose();
        } catch {
            setError('Error al guardar el rating.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="perf-modal-overlay" onClick={onClose}>
            <div className="perf-modal" onClick={e => e.stopPropagation()}>
                <div className="perf-modal__header">
                    <h3>Calificar — {worker.first_name} {worker.last_name}</h3>
                    <button className="perf-modal__close" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="perf-modal__body">
                    <div className="perf-modal__field">
                        <label>Calificación *</label>
                        <StarRating value={rating} onChange={setRating} size={28} />
                    </div>
                    <div className="perf-modal__field">
                        <label>Proyecto (opcional)</label>
                        <select
                            className="perf-select"
                            value={projectId}
                            onChange={e => setProjectId(e.target.value)}
                        >
                            <option value="">Sin proyecto específico</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="perf-modal__field">
                        <label>Comentario (opcional)</label>
                        <textarea
                            className="perf-textarea"
                            rows={3}
                            placeholder="Describe el desempeño del trabajador..."
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                        />
                    </div>
                    {error && <p className="perf-modal__error">{error}</p>}
                </div>
                <div className="perf-modal__footer">
                    <button className="perf-btn perf-btn--ghost" onClick={onClose}>Cancelar</button>
                    <button className="perf-btn perf-btn--primary" onClick={handleSave} disabled={saving}>
                        {saving ? <RefreshCw size={13} className="perf-spinning" /> : <Star size={13} />}
                        Guardar Rating
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Detail View ─────────────────────────────────────────────────────────────
const DetailView = ({ workerId, projects, onBack }) => {
    const [data, setData]               = useState(null);
    const [loading, setLoading]         = useState(true);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [deletingId, setDeletingId]   = useState(null);
    const [toast, setToast]             = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/performance/workers/${workerId}`);
            setData(res.data.data);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [workerId]);

    useEffect(() => { load(); }, [load]);

    const deleteRating = async (id) => {
        try {
            setDeletingId(id);
            await api.delete(`/ratings/${id}`);
            showToast('Rating eliminado.');
            load();
        } catch {
            showToast('Error al eliminar.', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) return (
        <div className="perf-loading">
            <RefreshCw size={24} className="perf-spinning" />
            <p>Cargando detalle...</p>
        </div>
    );
    if (!data) return <div className="perf-error"><AlertCircle size={24} /><p>No se pudo cargar el detalle.</p></div>;

    const { worker, metrics, weekly_hours, project_hours, recent_assignments, ratings } = data;
    const maxWeekHours = Math.max(...weekly_hours.map(w => w.hours), 1);
    const maxProjHours = Math.max(...project_hours.map(p => p.hours), 1);

    return (
        <div className="perf-detail">
            {toast && (
                <div className={`perf-toast ${toast.type === 'error' ? 'perf-toast--error' : ''}`}>
                    {toast.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="perf-detail__header">
                <button className="perf-btn perf-btn--ghost perf-btn--sm" onClick={onBack}>
                    <ArrowLeft size={14} /> Volver
                </button>
                <div className="perf-detail__title">
                    <div className="perf-avatar perf-avatar--lg">{worker.first_name.charAt(0)}</div>
                    <div>
                        <h2>{worker.first_name} {worker.last_name}</h2>
                        <p>{worker.worker_code} · {worker.trade || '—'}</p>
                    </div>
                </div>
                <button
                    className="perf-btn perf-btn--primary perf-btn--sm"
                    onClick={() => setShowRatingModal(true)}
                >
                    <Star size={13} /> Calificar
                </button>
            </div>

            {/* Metrics KPIs */}
            <div className="perf-detail__kpis">
                <KpiCard label="Total horas" value={`${metrics.total_hours}h`} icon={Clock} color="#2A6C95" />
                <KpiCard label="Tasa aprobación" value={metrics.approval_rate !== null ? `${metrics.approval_rate}%` : '—'} icon={CheckCircle2} color="#10B981" />
                <KpiCard label="Rating promedio" value={metrics.avg_rating ? `${metrics.avg_rating}★` : '—'} sub={`${metrics.rating_count} calificaciones`} icon={Star} color="#F59E0B" />
                <KpiCard label="Asignaciones" value={`${metrics.assignments_active} activas`} sub={`${metrics.assignments_completed} completadas`} icon={Briefcase} color="#8B5CF6" />
            </div>

            <div className="perf-detail__grid">
                {/* Weekly hours chart */}
                <div className="perf-card">
                    <h4 className="perf-card__title">Horas por semana</h4>
                    {weekly_hours.length === 0 ? (
                        <p className="perf-muted">Sin datos</p>
                    ) : (
                        <div className="perf-bar-chart">
                            {weekly_hours.map(w => (
                                <div key={w.week} className="perf-bar-col">
                                    <div className="perf-bar-track">
                                        <div
                                            className="perf-bar-fill"
                                            style={{ height: `${(w.hours / maxWeekHours) * 100}%` }}
                                            title={`${w.hours}h`}
                                        />
                                    </div>
                                    <div className="perf-bar-label">{w.hours}h</div>
                                    <div className="perf-bar-week">{w.week.slice(5)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Hours by project */}
                <div className="perf-card">
                    <h4 className="perf-card__title">Horas por proyecto</h4>
                    {project_hours.length === 0 ? (
                        <p className="perf-muted">Sin datos</p>
                    ) : (
                        <div className="perf-proj-list">
                            {project_hours.slice(0, 6).map(p => (
                                <div key={p.name} className="perf-proj-row">
                                    <div className="perf-proj-name" title={p.name}>{p.name}</div>
                                    <div className="perf-proj-bar-wrap">
                                        <div
                                            className="perf-proj-bar"
                                            style={{ width: `${(p.hours / maxProjHours) * 100}%` }}
                                        />
                                    </div>
                                    <div className="perf-proj-hours">{p.hours}h</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent assignments */}
                <div className="perf-card">
                    <h4 className="perf-card__title">Asignaciones recientes</h4>
                    {recent_assignments.length === 0 ? (
                        <p className="perf-muted">Sin asignaciones</p>
                    ) : (
                        <div className="perf-asn-list">
                            {recent_assignments.map(a => (
                                <div key={a.id} className="perf-asn-row">
                                    <div>
                                        <div className="perf-asn-project">{a.project}</div>
                                        <div className="perf-asn-dates">
                                            {a.start_date} → {a.end_date || 'En curso'}
                                        </div>
                                    </div>
                                    <span className={`perf-badge perf-badge--${a.status}`}>
                                        {a.status === 'active' ? 'Activo' : a.status === 'completed' ? 'Completado' : 'Cancelado'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Ratings */}
                <div className="perf-card">
                    <div className="perf-card__title-row">
                        <h4 className="perf-card__title">Calificaciones</h4>
                        <button
                            className="perf-btn perf-btn--ghost perf-btn--sm"
                            onClick={() => setShowRatingModal(true)}
                        >
                            <Star size={12} /> Agregar
                        </button>
                    </div>
                    {ratings.length === 0 ? (
                        <p className="perf-muted">Sin calificaciones aún.</p>
                    ) : (
                        <div className="perf-ratings-list">
                            {ratings.map(r => (
                                <div key={r.id} className="perf-rating-item">
                                    <div className="perf-rating-item__top">
                                        <StarRating value={parseFloat(r.rating)} size={14} />
                                        <span className="perf-rating-item__by">{r.rated_by}</span>
                                        <button
                                            className="perf-rating-item__del"
                                            onClick={() => deleteRating(r.id)}
                                            disabled={deletingId === r.id}
                                            title="Eliminar rating"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                    {r.comment && <p className="perf-rating-item__comment">{r.comment}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showRatingModal && (
                <RatingModal
                    worker={worker}
                    projects={projects}
                    onClose={() => setShowRatingModal(false)}
                    onSaved={() => { load(); }}
                />
            )}
        </div>
    );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
const Performance = () => {
    const [workers, setWorkers]           = useState([]);
    const [projects, setProjects]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [search, setSearch]             = useState('');
    const [filterAvail, setFilterAvail]   = useState('');
    const [selectedId, setSelectedId]     = useState(null);
    const [toast, setToast]               = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [pRes, prjRes] = await Promise.all([
                api.get('/performance/workers'),
                api.get('/projects'),
            ]);
            setWorkers(pRes.data?.data || []);
            setProjects(prjRes.data?.data || prjRes.data || []);
        } catch {
            showToast('Error cargando rendimiento.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (selectedId) {
        return (
            <DetailView
                workerId={selectedId}
                projects={projects}
                onBack={() => { setSelectedId(null); load(); }}
            />
        );
    }

    const filtered = workers.filter(w => {
        const q = search.toLowerCase();
        const name = `${w.first_name} ${w.last_name}`.toLowerCase();
        const matchSearch = !q || name.includes(q) || w.worker_code.toLowerCase().includes(q) || (w.trade || '').toLowerCase().includes(q);
        const matchAvail = !filterAvail || w.availability === filterAvail;
        return matchSearch && matchAvail;
    });

    // Aggregate KPIs
    const totalHours   = workers.reduce((s, w) => s + w.total_hours, 0);
    const avgApproval  = workers.filter(w => w.approval_rate !== null);
    const avgRate      = avgApproval.length > 0
        ? Math.round(avgApproval.reduce((s, w) => s + w.approval_rate, 0) / avgApproval.length)
        : null;
    const ratedWorkers = workers.filter(w => w.avg_rating);
    const avgRating    = ratedWorkers.length > 0
        ? (ratedWorkers.reduce((s, w) => s + parseFloat(w.avg_rating), 0) / ratedWorkers.length).toFixed(1)
        : null;

    return (
        <div className="perf-page">
            {toast && (
                <div className={`perf-toast ${toast.type === 'error' ? 'perf-toast--error' : ''}`}>
                    {toast.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="perf-header">
                <div>
                    <h1 className="perf-title">Rendimiento de Trabajadores</h1>
                    <p className="perf-subtitle">Horas, aprobaciones, proyectos y calificaciones</p>
                </div>
                <button className="perf-btn perf-btn--ghost" onClick={load} title="Actualizar">
                    <RefreshCw size={15} />
                </button>
            </div>

            {/* KPIs */}
            <div className="perf-kpis">
                <KpiCard label="Workers" value={workers.length} icon={Users} color="#2A6C95" />
                <KpiCard label="Total horas" value={`${totalHours.toFixed(0)}h`} icon={Clock} color="#10B981" />
                <KpiCard label="Tasa aprobación" value={avgRate !== null ? `${avgRate}%` : '—'} icon={TrendingUp} color="#F59E0B" />
                <KpiCard label="Rating promedio" value={avgRating ? `${avgRating}★` : '—'} icon={Award} color="#8B5CF6" />
            </div>

            {/* Toolbar */}
            <div className="perf-toolbar">
                <div className="perf-search-wrap">
                    <Search size={14} className="perf-search-icon" />
                    <input
                        className="perf-search"
                        placeholder="Buscar por nombre, código o trade..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && <button className="perf-search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
                </div>
                <select
                    className="perf-select perf-select--sm"
                    value={filterAvail}
                    onChange={e => setFilterAvail(e.target.value)}
                >
                    <option value="">Todos</option>
                    <option value="available">Disponible</option>
                    <option value="assigned">Asignado</option>
                    <option value="unavailable">No disponible</option>
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <div className="perf-loading"><RefreshCw size={24} className="perf-spinning" /><p>Calculando...</p></div>
            ) : filtered.length === 0 ? (
                <div className="perf-empty"><BarChart2 size={36} /><p>Sin resultados</p></div>
            ) : (
                <div className="perf-table-wrap">
                    <table className="perf-table">
                        <thead>
                            <tr>
                                <th>Worker</th>
                                <th>Trade</th>
                                <th>Estado</th>
                                <th>Horas</th>
                                <th>Aprobación</th>
                                <th>Proyectos</th>
                                <th>Asign. complet.</th>
                                <th>Rating</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(w => (
                                <WorkerRow key={w.id} w={w} onSelect={w => setSelectedId(w.id)} />
                            ))}
                        </tbody>
                    </table>
                    <div className="perf-table-footer">
                        {filtered.length} de {workers.length} workers
                    </div>
                </div>
            )}
        </div>
    );
};

export default Performance;
