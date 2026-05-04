import { useState, useEffect } from 'react';
import { Users, CheckCircle, Clock, MapPin, AlertCircle } from 'lucide-react';
import useApi from '../../hooks/useApi';
import './ClientWorkers.css';

const ClientWorkers = () => {
    const { get, loading, error } = useApi();
    const [workers, setWorkers] = useState([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        let cancelled = false;
        get('/client/workers').then(res => {
            if (!cancelled && res?.success) setWorkers(res.data);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return (
        <div className="client-loading">
            <div className="client-spinner" />
            <span>Loading workers...</span>
        </div>
    );

    if (error) return (
        <div className="client-error">
            <AlertCircle size={20} />
            <span>{error}</span>
        </div>
    );

    const filtered = workers.filter(w => {
        const q = search.toLowerCase();
        const name = `${w.first_name} ${w.last_name}`.toLowerCase();
        return name.includes(q) || (w.trade || '').toLowerCase().includes(q);
    });

    const onSiteCount = workers.filter(w => w.clockedInToday).length;

    return (
        <div className="cworkers">
            <div className="cworkers__header">
                <div>
                    <h1 className="cworkers__title">Workers</h1>
                    <p className="cworkers__subtitle">
                        {workers.length} assigned &nbsp;·&nbsp;
                        <span className="cworkers__on-site">{onSiteCount} on-site today</span>
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="cworkers__search-wrap">
                <input
                    className="cworkers__search"
                    type="text"
                    placeholder="Search by name or trade..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {filtered.length === 0 ? (
                <div className="cworkers__empty">
                    <Users size={40} />
                    <p>{search ? 'No workers match your search.' : 'No workers assigned to your active projects.'}</p>
                </div>
            ) : (
                <div className="cworkers__grid">
                    {filtered.map(w => (
                        <div key={w.id} className={`cworker-card ${w.clockedInToday ? 'cworker-card--active' : ''}`}>
                            {/* Status indicator */}
                            <div className="cworker-card__status-dot"
                                style={{ background: w.clockedInToday ? '#10B981' : '#CBD5E1' }}
                                title={w.clockedInToday ? 'On-site today' : 'Not clocked in'}
                            />

                            {/* Avatar */}
                            <div className="cworker-card__avatar">
                                {w.first_name?.[0]}{w.last_name?.[0]}
                            </div>

                            {/* Info */}
                            <div className="cworker-card__name">
                                {w.first_name} {w.last_name}
                            </div>
                            <div className="cworker-card__trade">{w.trade || '—'}</div>

                            {/* Hours today */}
                            <div className="cworker-card__today">
                                {w.clockedInToday ? (
                                    <span className="cworker-card__clocked-in">
                                        <CheckCircle size={13} />
                                        {w.todayHours > 0
                                            ? `${parseFloat(w.todayHours).toFixed(1)}h today`
                                            : 'Clocked in'
                                        }
                                    </span>
                                ) : (
                                    <span className="cworker-card__not-in">
                                        <Clock size={13} />
                                        Not on-site
                                    </span>
                                )}
                            </div>

                            {/* Projects */}
                            <div className="cworker-card__projects">
                                {(w.projects || []).map(p => (
                                    <span key={p.id} className="cworker-card__project-tag">
                                        <MapPin size={10} />{p.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClientWorkers;
