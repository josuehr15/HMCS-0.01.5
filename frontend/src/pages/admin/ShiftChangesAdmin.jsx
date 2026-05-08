import { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeftRight, Check, X, Clock, RefreshCw,
    AlertCircle, ChevronDown, User,
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import './ShiftChangesAdmin.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
};
const fmtTime = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};
const fmtEntry = (entry) => {
    if (!entry) return '—';
    const proj = entry.project?.name ? ` · ${entry.project.name}` : '';
    return `${fmtTime(entry.clock_in)} → ${fmtTime(entry.clock_out)}${proj} · ${parseFloat(entry.total_hours || 0).toFixed(1)}h`;
};
const workerName = (w) => w ? `${w.first_name} ${w.last_name}` : '—';

const STATUS_META = {
    pending_target:  { label: 'Pendiente worker',    color: '#D97706', bg: 'rgba(245,158,11,0.1)'  },
    accepted_target: { label: 'Pendiente admin',     color: '#7C3AED', bg: 'rgba(124,58,237,0.1)'  },
    rejected_target: { label: 'Rechazado por worker',color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
    approved_admin:  { label: 'Aprobado',            color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
    rejected_admin:  { label: 'Rechazado por admin', color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
    cancelled:       { label: 'Cancelado',           color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
};

function StatusBadge({ status }) {
    const s = STATUS_META[status] || { label: status, color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' };
    return <span className="sca-badge" style={{ color: s.color, background: s.bg }}>{s.label}</span>;
}

// ─── Modal de revisión ────────────────────────────────────────────────────────
function ReviewModal({ sc, onClose, onReviewed }) {
    const { put } = useApi();
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const review = async (approve) => {
        setSaving(true); setError('');
        try {
            const res = await put(`/shift-changes/${sc.id}/review`, { approve, note });
            onReviewed(res.data || res);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al revisar solicitud.');
            setSaving(false);
        }
    };

    return (
        <div className="sca-overlay" onClick={onClose}>
            <div className="sca-modal" onClick={e => e.stopPropagation()}>
                <div className="sca-modal__header">
                    <h3>Revisar cambio de turno</h3>
                    <button className="sca-modal__close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="sca-modal__body">
                    {error && <div className="sca-error"><AlertCircle size={13} />{error}</div>}

                    {/* Resumen del cambio */}
                    <div className="sca-modal__info">
                        <div className="sca-modal__info-row">
                            <span className="sca-modal__info-label">Solicitante</span>
                            <span>{workerName(sc.requester)}</span>
                        </div>
                        <div className="sca-modal__info-row">
                            <span className="sca-modal__info-label">Target</span>
                            <span>{workerName(sc.target)}</span>
                        </div>
                        <div className="sca-modal__info-row">
                            <span className="sca-modal__info-label">Fecha</span>
                            <span>{fmtDate(sc.shift_date)}</span>
                        </div>
                        {sc.requesterEntry && (
                            <div className="sca-modal__info-row">
                                <span className="sca-modal__info-label">Turno solicitante</span>
                                <span className="sca-mono">{fmtEntry(sc.requesterEntry)}</span>
                            </div>
                        )}
                        {sc.targetEntry && (
                            <div className="sca-modal__info-row">
                                <span className="sca-modal__info-label">Turno target</span>
                                <span className="sca-mono">{fmtEntry(sc.targetEntry)}</span>
                            </div>
                        )}
                        {sc.reason && (
                            <div className="sca-modal__info-row">
                                <span className="sca-modal__info-label">Motivo</span>
                                <em>{sc.reason}</em>
                            </div>
                        )}
                        {sc.target_note && (
                            <div className="sca-modal__info-row">
                                <span className="sca-modal__info-label">Nota del worker</span>
                                <em>{sc.target_note}</em>
                            </div>
                        )}
                    </div>

                    <label className="sca-label">
                        Nota del admin (opcional)
                        <textarea
                            className="sca-textarea"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Agrega una nota interna..."
                            rows={2}
                        />
                    </label>
                </div>

                <div className="sca-modal__footer">
                    <button className="sca-btn sca-btn--danger" onClick={() => review(false)} disabled={saving}>
                        <X size={14} /> Rechazar
                    </button>
                    <button className="sca-btn sca-btn--success" onClick={() => review(true)} disabled={saving}>
                        <Check size={14} /> Aprobar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Card de un cambio ────────────────────────────────────────────────────────
function ChangeCard({ sc, onReview }) {
    const canReview = sc.status === 'accepted_target';

    return (
        <div className={`sca-card ${canReview ? 'sca-card--pending' : ''}`}>
            <div className="sca-card__header">
                <div className="sca-card__title">
                    <User size={14} />
                    <span>{workerName(sc.requester)}</span>
                    <ArrowLeftRight size={12} className="sca-card__arrow" />
                    <span>{workerName(sc.target)}</span>
                </div>
                <StatusBadge status={sc.status} />
            </div>

            <div className="sca-card__body">
                <div className="sca-card__row">
                    <Clock size={12} />
                    <span>Fecha: <strong>{fmtDate(sc.shift_date)}</strong></span>
                </div>
                {sc.requesterEntry && (
                    <div className="sca-card__row">
                        <span className="sca-card__row-label">Turno solicitante:</span>
                        <span className="sca-mono">{fmtEntry(sc.requesterEntry)}</span>
                    </div>
                )}
                {sc.targetEntry && (
                    <div className="sca-card__row">
                        <span className="sca-card__row-label">Turno target:</span>
                        <span className="sca-mono">{fmtEntry(sc.targetEntry)}</span>
                    </div>
                )}
                {sc.reason && (
                    <div className="sca-card__row sca-card__row--muted">
                        <em>Motivo: "{sc.reason}"</em>
                    </div>
                )}
                {sc.target_note && (
                    <div className="sca-card__row sca-card__row--note">
                        Nota del worker: <em>{sc.target_note}</em>
                    </div>
                )}
                {sc.admin_note && (
                    <div className="sca-card__row sca-card__row--note">
                        Nota del admin: <em>{sc.admin_note}</em>
                    </div>
                )}
                {sc.reviewer && (
                    <div className="sca-card__row sca-card__row--muted">
                        Revisado por: {sc.reviewer.email}
                        {sc.reviewed_at && ` · ${new Date(sc.reviewed_at).toLocaleDateString('en-US')}`}
                    </div>
                )}
            </div>

            {canReview && (
                <div className="sca-card__actions">
                    <button className="sca-btn sca-btn--primary sca-btn--sm" onClick={() => onReview(sc)}>
                        <Check size={13} /> Revisar y decidir
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const FILTERS = [
    { val: 'all',      label: 'Todos' },
    { val: 'pending',  label: 'Pendientes' },
    { val: 'approved', label: 'Aprobados' },
    { val: 'rejected', label: 'Rechazados' },
];

export default function ShiftChangesAdmin() {
    const { get } = useApi();
    const [changes, setChanges]     = useState([]);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [filter, setFilter]       = useState('all');
    const [reviewTarget, setReviewTarget] = useState(null);

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await get('/shift-changes');
            setChanges(Array.isArray(res?.data) ? res.data : res || []);
        } catch {
            setError('Error al cargar cambios de turno.');
        } finally {
            setLoading(false);
        }
    }, [get]);

    useEffect(() => { load(); }, [load]);

    const handleReviewed = (updated) =>
        setChanges(prev => prev.map(c => c.id === updated.id ? updated : c));

    const filtered = changes.filter(c => {
        if (filter === 'pending')  return ['pending_target', 'accepted_target'].includes(c.status);
        if (filter === 'approved') return c.status === 'approved_admin';
        if (filter === 'rejected') return ['rejected_target', 'rejected_admin', 'cancelled'].includes(c.status);
        return true;
    });

    const pendingCount = changes.filter(c => c.status === 'accepted_target').length;

    const totalCount    = changes.length;
    const approvedCount = changes.filter(c => c.status === 'approved_admin').length;
    const rejectedCount = changes.filter(c => ['rejected_target','rejected_admin','cancelled'].includes(c.status)).length;

    return (
        <div className="sca-page fade-in">
            {/* Header */}
            <div className="sca-header">
                <div>
                    <h1 className="sca-header__title">
                        <ArrowLeftRight size={20} />
                        Cambios de Turno
                        {pendingCount > 0 && (
                            <span className="sca-header__badge">{pendingCount} por revisar</span>
                        )}
                    </h1>
                    <p className="sca-header__sub">Aprueba o rechaza las solicitudes de cambio entre workers</p>
                </div>
                <button className="sca-btn sca-btn--ghost sca-btn--sm" onClick={load} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'sca-spin' : ''} /> Actualizar
                </button>
            </div>

            {/* Stats strip */}
            <div className="sca-stats">
                <div className="sca-stat" style={{ '--sca-accent': '#2A6C95' }}>
                    <div className="sca-stat__icon" style={{ background: 'rgba(42,108,149,0.12)', color: '#2A6C95' }}>
                        <ArrowLeftRight size={18} />
                    </div>
                    <div className="sca-stat__body">
                        <div className="sca-stat__value">{totalCount}</div>
                        <div className="sca-stat__label">Total solicitudes</div>
                    </div>
                </div>
                <div className="sca-stat" style={{ '--sca-accent': '#7C3AED' }}>
                    <div className="sca-stat__icon" style={{ background: 'rgba(124,58,237,0.12)', color: '#7C3AED' }}>
                        <Clock size={18} />
                    </div>
                    <div className="sca-stat__body">
                        <div className="sca-stat__value">{pendingCount}</div>
                        <div className="sca-stat__label">Pendientes de revisión</div>
                    </div>
                </div>
                <div className="sca-stat" style={{ '--sca-accent': '#10B981' }}>
                    <div className="sca-stat__icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                        <Check size={18} />
                    </div>
                    <div className="sca-stat__body">
                        <div className="sca-stat__value">{approvedCount}</div>
                        <div className="sca-stat__label">Aprobados</div>
                    </div>
                </div>
                <div className="sca-stat" style={{ '--sca-accent': '#EF4444' }}>
                    <div className="sca-stat__icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
                        <X size={18} />
                    </div>
                    <div className="sca-stat__body">
                        <div className="sca-stat__value">{rejectedCount}</div>
                        <div className="sca-stat__label">Rechazados / Cancelados</div>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="sca-filters">
                {FILTERS.map(f => (
                    <button
                        key={f.val}
                        className={`sca-filter-btn ${filter === f.val ? 'sca-filter-btn--active' : ''}`}
                        onClick={() => setFilter(f.val)}
                    >
                        {f.label}
                        {f.val === 'pending' && pendingCount > 0 && (
                            <span className="sca-filter-count">{pendingCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {error && <div className="sca-error"><AlertCircle size={14} />{error}</div>}

            {loading ? (
                <div className="sca-loading">
                    <RefreshCw size={22} className="sca-spin" /> Cargando...
                </div>
            ) : filtered.length === 0 ? (
                <div className="sca-empty">
                    <ArrowLeftRight size={42} />
                    <p>{filter === 'pending' ? 'No hay solicitudes pendientes de revisión' : 'No hay solicitudes'}</p>
                </div>
            ) : (
                <div className="sca-list">
                    {filtered.map(sc => (
                        <ChangeCard
                            key={sc.id}
                            sc={sc}
                            onReview={setReviewTarget}
                        />
                    ))}
                </div>
            )}

            {reviewTarget && (
                <ReviewModal
                    sc={reviewTarget}
                    onClose={() => setReviewTarget(null)}
                    onReviewed={handleReviewed}
                />
            )}
        </div>
    );
}
