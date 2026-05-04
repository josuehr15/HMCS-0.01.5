import { useState, useEffect } from 'react';
import { MapPin, Users, Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import useApi from '../../hooks/useApi';
import './ClientProjects.css';

const fmtDate = (d) => {
    if (!d) return '—';
    const [y, m, day] = (d + '').slice(0, 10).split('-');
    return `${m}/${day}/${y}`;
};

const STATUS_CONFIG = {
    active:    { label: 'Active',    color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    completed: { label: 'Completed', color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
    on_hold:   { label: 'On Hold',   color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
};

const ClientProjects = () => {
    const { get, loading, error } = useApi();
    const [projects, setProjects] = useState([]);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        let cancelled = false;
        get('/client/projects').then(res => {
            if (!cancelled && res?.success) {
                setProjects(res.data);
                if (res.data.length > 0) setSelected(res.data[0]);
            }
        }).catch(() => {});
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return (
        <div className="client-loading">
            <div className="client-spinner" />
            <span>Loading projects...</span>
        </div>
    );

    if (error) return (
        <div className="client-error">
            <AlertCircle size={20} />
            <span>{error}</span>
        </div>
    );

    const workerCount = (p) => (p.assignments || []).length;

    const mapSrc = (p) => {
        if (!p?.latitude || !p?.longitude) return null;
        const lat = parseFloat(p.latitude);
        const lng = parseFloat(p.longitude);
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey) return null;
        return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x300&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
    };

    return (
        <div className="cprojects">
            <div className="cprojects__header">
                <h1 className="cprojects__title">Projects</h1>
                <span className="cprojects__count">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
            </div>

            {projects.length === 0 ? (
                <div className="cprojects__empty">
                    <FolderIcon />
                    <p>No projects found.</p>
                </div>
            ) : (
                <div className="cprojects__layout">
                    {/* Project list */}
                    <div className="cprojects__list">
                        {projects.map(p => {
                            const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.active;
                            const isSelected = selected?.id === p.id;
                            return (
                                <div
                                    key={p.id}
                                    className={`cproject-card ${isSelected ? 'cproject-card--selected' : ''}`}
                                    onClick={() => setSelected(p)}
                                >
                                    <div className="cproject-card__top">
                                        <span className="cproject-card__name">{p.name}</span>
                                        <span className="cproject-card__badge"
                                            style={{ background: cfg.bg, color: cfg.color }}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <div className="cproject-card__meta">
                                        <span><MapPin size={11} />{p.address}</span>
                                    </div>
                                    <div className="cproject-card__footer">
                                        <span><Users size={11} />{workerCount(p)} worker{workerCount(p) !== 1 ? 's' : ''}</span>
                                        <span><Clock size={11} />{p.work_hours_per_day}h/day</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Detail panel */}
                    {selected && (
                        <div className="cprojects__detail">
                            {/* Map */}
                            <div className="cprojects__map-wrap">
                                {mapSrc(selected) ? (
                                    <img
                                        className="cprojects__map-img"
                                        src={mapSrc(selected)}
                                        alt={`Map of ${selected.name}`}
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="cprojects__map-placeholder">
                                        <MapPin size={28} />
                                        <span>{selected.address}</span>
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="cprojects__detail-info">
                                <h2 className="cprojects__detail-name">{selected.name}</h2>
                                <p className="cprojects__detail-address"><MapPin size={13} />{selected.address}</p>

                                <div className="cprojects__detail-grid">
                                    <div className="cprojects__detail-item">
                                        <span className="cprojects__detail-label">Status</span>
                                        <span className="cprojects__detail-val">
                                            <span className="cproject-card__badge"
                                                style={{
                                                    background: (STATUS_CONFIG[selected.status] || STATUS_CONFIG.active).bg,
                                                    color: (STATUS_CONFIG[selected.status] || STATUS_CONFIG.active).color,
                                                }}>
                                                {(STATUS_CONFIG[selected.status] || STATUS_CONFIG.active).label}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="cprojects__detail-item">
                                        <span className="cprojects__detail-label">Start Date</span>
                                        <span className="cprojects__detail-val">{fmtDate(selected.start_date)}</span>
                                    </div>
                                    <div className="cprojects__detail-item">
                                        <span className="cprojects__detail-label">End Date</span>
                                        <span className="cprojects__detail-val">{fmtDate(selected.end_date)}</span>
                                    </div>
                                    <div className="cprojects__detail-item">
                                        <span className="cprojects__detail-label">Work Hours / Day</span>
                                        <span className="cprojects__detail-val">{selected.work_hours_per_day}h</span>
                                    </div>
                                    <div className="cprojects__detail-item">
                                        <span className="cprojects__detail-label">Lunch</span>
                                        <span className="cprojects__detail-val" style={{ textTransform: 'capitalize' }}>
                                            {selected.lunch_rule}
                                        </span>
                                    </div>
                                    <div className="cprojects__detail-item">
                                        <span className="cprojects__detail-label">Active Workers</span>
                                        <span className="cprojects__detail-val">{workerCount(selected)}</span>
                                    </div>
                                </div>

                                {/* Workers list */}
                                {(selected.assignments || []).length > 0 && (
                                    <div className="cprojects__workers-section">
                                        <h3 className="cprojects__workers-title">Assigned Workers</h3>
                                        <div className="cprojects__workers-list">
                                            {selected.assignments.map(asgn => (
                                                <div key={asgn.id} className="cprojects__worker-chip">
                                                    <div className="cprojects__worker-avatar">
                                                        {asgn.worker?.first_name?.[0]}{asgn.worker?.last_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <div className="cprojects__worker-name">
                                                            {asgn.worker?.first_name} {asgn.worker?.last_name}
                                                        </div>
                                                        <div className="cprojects__worker-trade">
                                                            {asgn.worker?.trade?.name || '—'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Fallback icon for empty state
const FolderIcon = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
);

export default ClientProjects;
