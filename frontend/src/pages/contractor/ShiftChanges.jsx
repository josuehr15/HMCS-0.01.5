import { useState, useEffect, useCallback } from 'react';
import useApi from '../../hooks/useApi';
import {
    ArrowLeftRight, Plus, X, Check, Clock,
    ChevronDown, AlertCircle, RefreshCw,
} from 'lucide-react';
import './ShiftChanges.css';

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
    return `${fmtTime(entry.clock_in)} → ${fmtTime(entry.clock_out)} · ${entry.project?.name || ''} · ${parseFloat(entry.total_hours || 0).toFixed(1)}h`;
};

const STATUS_LABELS = {
    pending_target:  { label: 'Pendiente respuesta', color: '#D97706', bg: 'rgba(245,158,11,0.1)' },
    accepted_target: { label: 'Esperando admin',     color: '#2563EB', bg: 'rgba(37,99,235,0.1)'  },
    rejected_target: { label: 'Rechazado por worker',color: '#EF4444', bg: 'rgba(239,68,68,0.1)'  },
    approved_admin:  { label: 'Aprobado',            color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    rejected_admin:  { label: 'Rechazado por admin', color: '#EF4444', bg: 'rgba(239,68,68,0.1)'  },
    cancelled:       { label: 'Cancelado',           color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)'},
};

function StatusBadge({ status }) {
    const s = STATUS_LABELS[status] || { label: status, color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' };
    return (
        <span className="sc-badge" style={{ color: s.color, background: s.bg }}>
            {s.label}
        </span>
    );
}

// ─── Modal: Nueva solicitud ───────────────────────────────────────────────────
function NewRequestModal({ onClose, onCreated, myEntries, workers }) {
    const { post } = useApi();
    const [form, setForm] = useState({
        target_worker_id: '',
        requester_entry_id: '',
        shift_date: '',
        reason: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // Auto-fill shift_date from selected entry
    const handleEntryChange = (entryId) => {
        set('requester_entry_id', entryId);
        if (entryId) {
            const entry = myEntries.find(e => String(e.id) === entryId);
            if (entry?.clock_in) {
                set('shift_date', entry.clock_in.split('T')[0]);
            }
        }
    };

    const handleSubmit = async () => {
        if (!form.target_worker_id || !form.requester_entry_id || !form.shift_date) {
            setError('Selecciona worker, turno y fecha.');
            return;
        }
        setSaving(true); setError('');
        try {
            const res = await post('/shift-changes', {
                target_worker_id: parseInt(form.target_worker_id),
                requester_entry_id: parseInt(form.requester_entry_id),
                shift_date: form.shift_date,
                reason: form.reason || undefined,
            });
            onCreated(res.data || res);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al crear solicitud.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="sc-modal-overlay" onClick={onClose}>
            <div className="sc-modal" onClick={e => e.stopPropagation()}>
                <div className="sc-modal__header">
                    <h3>Nueva solicitud de cambio</h3>
                    <button className="sc-modal__close" onClick={onClose}><X size={18} /></button>
                </div>

                <div className="sc-modal__body">
                    {error && <div className="sc-error"><AlertCircle size={13} /> {error}</div>}

                    <label className="sc-label">
                        Mi turno a cambiar
                        <div className="sc-select-wrap">
                            <select
                                className="sc-select"
                                value={form.requester_entry_id}
                                onChange={e => handleEntryChange(e.target.value)}
                            >
                                <option value="">Seleccionar turno...</option>
                                {myEntries.filter(e => e.clock_out).map(e => (
                                    <option key={e.id} value={e.id}>
                                        {fmtDate(e.clock_in?.split('T')[0])} — {fmtTime(e.clock_in)} → {fmtTime(e.clock_out)} · {parseFloat(e.total_hours || 0).toFixed(1)}h
                                        {e.project ? ` · ${e.project.name}` : ''}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={13} className="sc-select-arrow" />
                        </div>
                    </label>

                    <label className="sc-label">
                        Worker con quien cambiar
                        <div className="sc-select-wrap">
                            <select
                                className="sc-select"
                                value={form.target_worker_id}
                                onChange={e => set('target_worker_id', e.target.value)}
                            >
                                <option value="">Seleccionar worker...</option>
                                {workers.map(w => (
                                    <option key={w.id} value={w.id}>
                                        {w.first_name} {w.last_name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={13} className="sc-select-arrow" />
                        </div>
                    </label>

                    <label className="sc-label">
                        Fecha del turno
                        <input
                            type="date"
                            className="sc-input"
                            value={form.shift_date}
                            onChange={e => set('shift_date', e.target.value)}
                        />
                    </label>

                    <label className="sc-label">
                        Motivo (opcional)
                        <textarea
                            className="sc-textarea"
                            value={form.reason}
                            onChange={e => set('reason', e.target.value)}
                            placeholder="Explica el motivo del cambio..."
                            rows={3}
                        />
                    </label>
                </div>

                <div className="sc-modal__footer">
                    <button className="sc-btn sc-btn--ghost" onClick={onClose} disabled={saving}>
                        Cancelar
                    </button>
                    <button className="sc-btn sc-btn--primary" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Enviando...' : 'Enviar solicitud'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Modal: Responder (como target) ──────────────────────────────────────────
function RespondModal({ sc, onClose, onUpdated }) {
    const { put } = useApi();
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const respond = async (accept) => {
        setSaving(true); setError('');
        try {
            const res = await put(`/shift-changes/${sc.id}/respond`, { accept, note });
            onUpdated(res.data || res);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al responder.');
            setSaving(false);
        }
    };

    return (
        <div className="sc-modal-overlay" onClick={onClose}>
            <div className="sc-modal" onClick={e => e.stopPropagation()}>
                <div className="sc-modal__header">
                    <h3>Responder solicitud</h3>
                    <button className="sc-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="sc-modal__body">
                    {error && <div className="sc-error"><AlertCircle size={13} /> {error}</div>}
                    <div className="sc-modal__info">
                        <p><strong>{sc.requester?.first_name} {sc.requester?.last_name}</strong> quiere cambiar su turno del <strong>{fmtDate(sc.shift_date)}</strong></p>
                        {sc.requesterEntry && <p className="sc-modal__entry">Turno: {fmtEntry(sc.requesterEntry)}</p>}
                        {sc.reason && <p className="sc-modal__reason">Motivo: <em>{sc.reason}</em></p>}
                    </div>
                    <label className="sc-label">
                        Nota (opcional)
                        <textarea
                            className="sc-textarea"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Agrega una nota..."
                            rows={2}
                        />
                    </label>
                </div>
                <div className="sc-modal__footer">
                    <button className="sc-btn sc-btn--danger" onClick={() => respond(false)} disabled={saving}>
                        <X size={14} /> Rechazar
                    </button>
                    <button className="sc-btn sc-btn--success" onClick={() => respond(true)} disabled={saving}>
                        <Check size={14} /> Aceptar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Shift Change Card ────────────────────────────────────────────────────────
function ShiftCard({ sc, myWorkerId, onRespond, onCancel }) {
    const isRequester = sc.requester_worker_id === myWorkerId;
    const isTarget    = sc.target_worker_id === myWorkerId;
    const canRespond  = isTarget && sc.status === 'pending_target';
    const canCancel   = isRequester && sc.status === 'pending_target';

    return (
        <div className="sc-card">
            <div className="sc-card__header">
                <div className="sc-card__title">
                    <ArrowLeftRight size={14} />
                    <span>
                        {isRequester
                            ? `Solicitaste a ${sc.target?.first_name} ${sc.target?.last_name}`
                            : `${sc.requester?.first_name} ${sc.requester?.last_name} te solicita`}
                    </span>
                </div>
                <StatusBadge status={sc.status} />
            </div>

            <div className="sc-card__body">
                <div className="sc-card__row">
                    <Clock size={12} />
                    <span>Fecha: <strong>{fmtDate(sc.shift_date)}</strong></span>
                </div>
                {sc.requesterEntry && (
                    <div className="sc-card__row">
                        <span className="sc-card__row-label">Turno:</span>
                        <span>{fmtEntry(sc.requesterEntry)}</span>
                    </div>
                )}
                {sc.reason && (
                    <div className="sc-card__row sc-card__row--reason">
                        <em>"{sc.reason}"</em>
                    </div>
                )}
                {sc.target_note && (
                    <div className="sc-card__row sc-card__row--note">
                        Nota del worker: <em>{sc.target_note}</em>
                    </div>
                )}
                {sc.admin_note && (
                    <div className="sc-card__row sc-card__row--note">
                        Nota del admin: <em>{sc.admin_note}</em>
                    </div>
                )}
            </div>

            {(canRespond || canCancel) && (
                <div className="sc-card__actions">
                    {canRespond && (
                        <button className="sc-btn sc-btn--primary sc-btn--sm" onClick={() => onRespond(sc)}>
                            Responder
                        </button>
                    )}
                    {canCancel && (
                        <button className="sc-btn sc-btn--ghost sc-btn--sm" onClick={() => onCancel(sc.id)}>
                            Cancelar solicitud
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ShiftChanges() {
    const { get, del } = useApi();
    const [changes, setChanges] = useState([]);
    const [myEntries, setMyEntries] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [myWorkerId, setMyWorkerId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [respondTarget, setRespondTarget] = useState(null);
    const [filter, setFilter] = useState('all'); // all | pending | done

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [changesRes, entriesRes, workersRes, profileRes] = await Promise.all([
                get('/shift-changes'),
                get('/time-entries/my'),
                get('/workers/assigned'),
                get('/workers/me'),
            ]);
            setChanges(Array.isArray(changesRes?.data) ? changesRes.data : changesRes || []);
            setMyEntries(Array.isArray(entriesRes?.data) ? entriesRes.data : []);
            const ws = Array.isArray(workersRes?.data) ? workersRes.data : workersRes || [];
            const me = profileRes?.data || profileRes;
            setMyWorkerId(me?.id || null);
            // Exclude self from target worker list
            setWorkers(ws.filter(w => w.id !== me?.id && w.status === 'active'));
        } catch {
            setError('Error al cargar cambios de turno.');
        } finally {
            setLoading(false);
        }
    }, [get]);

    useEffect(() => { load(); }, [load]);

    const handleCreated = (sc) => setChanges(prev => [sc, ...prev]);
    const handleUpdated = (sc) => setChanges(prev => prev.map(c => c.id === sc.id ? sc : c));

    const handleCancel = async (id) => {
        if (!window.confirm('¿Cancelar esta solicitud?')) return;
        try {
            await del(`/shift-changes/${id}`);
            setChanges(prev => prev.map(c => c.id === id ? { ...c, status: 'cancelled' } : c));
        } catch {
            alert('Error al cancelar.');
        }
    };

    const filtered = changes.filter(c => {
        if (filter === 'pending') return ['pending_target', 'accepted_target'].includes(c.status);
        if (filter === 'done')    return ['approved_admin', 'rejected_target', 'rejected_admin', 'cancelled'].includes(c.status);
        return true;
    });

    return (
        <div className="sc-page fade-in">
            <div className="sc-header">
                <div>
                    <h2>Cambios de Turno</h2>
                    <p>Gestiona tus solicitudes de cambio</p>
                </div>
                <button className="sc-btn sc-btn--primary" onClick={() => setShowNew(true)}>
                    <Plus size={15} /> Nueva solicitud
                </button>
            </div>

            {/* Filter tabs */}
            <div className="sc-filters">
                {[['all','Todas'], ['pending','Pendientes'], ['done','Cerradas']].map(([val, label]) => (
                    <button
                        key={val}
                        className={`sc-filter-btn ${filter === val ? 'sc-filter-btn--active' : ''}`}
                        onClick={() => setFilter(val)}
                    >
                        {label}
                    </button>
                ))}
                <button className="sc-refresh-btn" onClick={load} title="Actualizar">
                    <RefreshCw size={14} className={loading ? 'sc-spin' : ''} />
                </button>
            </div>

            {error && <div className="sc-error"><AlertCircle size={14} /> {error}</div>}

            {loading ? (
                <div className="sc-loading"><RefreshCw size={22} className="sc-spin" /> Cargando...</div>
            ) : filtered.length === 0 ? (
                <div className="sc-empty">
                    <ArrowLeftRight size={40} />
                    <p>{filter === 'pending' ? 'No hay solicitudes pendientes' : 'No hay solicitudes'}</p>
                    <button className="sc-btn sc-btn--primary" onClick={() => setShowNew(true)}>
                        <Plus size={14} /> Crear solicitud
                    </button>
                </div>
            ) : (
                <div className="sc-list">
                    {filtered.map(sc => (
                        <ShiftCard
                            key={sc.id}
                            sc={sc}
                            myWorkerId={myWorkerId}
                            onRespond={setRespondTarget}
                            onCancel={handleCancel}
                        />
                    ))}
                </div>
            )}

            {showNew && (
                <NewRequestModal
                    onClose={() => setShowNew(false)}
                    onCreated={handleCreated}
                    myEntries={myEntries}
                    workers={workers}
                />
            )}

            {respondTarget && (
                <RespondModal
                    sc={respondTarget}
                    onClose={() => setRespondTarget(null)}
                    onUpdated={handleUpdated}
                />
            )}
        </div>
    );
}
