import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
    Search, Plus, Edit2, X, ChevronDown,
    MapPin, Users, Clock, LayoutGrid, List,
    Pause, Play, Trash2, CheckCircle, Shield,
    EyeOff, FolderOpen, Calendar, Navigation,
    Coffee, BarChart3, Building2, UserPlus,
    AlertTriangle, ChevronRight, Info, FileText
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import DocumentUploader from '../../components/DocumentUploader';
import { useAuth } from '../../context/AuthContext';
import './Projects.css';

// ─── Constants ─────────────────────────────────────────────────────────────────
function fromTime24(timeStr) {
    if (!timeStr) return { hour: '', minute: '', period: '' };
    const [hhStr, mmStr] = timeStr.split(':');
    let h = parseInt(hhStr, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    if (h > 12) h -= 12;
    return { hour: String(h), minute: mmStr || '00', period };
}

function toTime24(hour, minute, period) {
    if (!hour || !minute || !period) return null;
    let h = parseInt(hour, 10);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    const hh = String(h).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return `${hh}:${mm}:00`;
}

const EMPTY_FORM = {
    client_id: '', name: '', address: '',
    latitude: '', longitude: '',
    gps_radius_meters: '500',
    lunch_rule: 'paid',
    lunch_duration_minutes: '60',
    work_hours_per_day: '9.00',
    paid_hours_per_day: '10.00',
    shiftStartHour: '', shiftStartMinute: '', shiftStartPeriod: '',
    shiftEndHour: '', shiftEndMinute: '', shiftEndPeriod: '',
    start_date: '', end_date: '',
    status: 'active', notes: '',
};

const EMPTY_ASSIGN = { worker_id: '', start_date: '', end_date: '' };

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
    if (!d) return 'En curso';
    return new Date(d + 'T00:00:00').toLocaleDateString('es-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function workerInitials(w) {
    if (!w) return '?';
    return `${w.first_name?.[0] || ''}${w.last_name?.[0] || ''}`.toUpperCase();
}

// Status badge
function StatusBadge({ status }) {
    const MAP = {
        active:    { label: 'Activo',     cls: 'pj-badge--active' },
        on_hold:   { label: 'En Pausa',   cls: 'pj-badge--paused' },
        completed: { label: 'Completado', cls: 'pj-badge--completed' },
    };
    const s = MAP[status] || { label: status, cls: '' };
    return <span className={`pj-badge ${s.cls}`}>{s.label}</span>;
}

// ─── GPS Parser helper ─────────────────────────────────────────────────────────
function parseGoogleMapsUrl(url) {
    const atMatch  = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const qMatch   = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const llMatch  = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const destMatch = url.match(/[?&]destination=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const match = atMatch || qMatch || llMatch || destMatch;
    if (match) return { lat: match[1], lng: match[2] };
    return null;
}

// ─── Map Embed (iframe reutilizable, sin librería extra) ───────────────────────
function MapEmbed({ lat, lng, height = 160, zoom = 14, radius = 0 }) {
    if (!lat || !lng) {
        return (
            <div className="pj-map-placeholder" style={{ height }}>
                <MapPin size={20} />
                <span>Sin coordenadas</span>
            </div>
        );
    }
    const src = `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&output=embed`;
    return (
        <iframe
            title={`map-${lat}-${lng}`}
            src={src}
            width="100%"
            height={height}
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
        />
    );
}

// ─── Project Card ───────────────────────────────────────────────────────────────
function ProjectCard({ project, onEdit, onToggle, onCardClick }) {
    const assignments = project.assignments || [];
    const activeAssignments = assignments.filter(a => a.status === 'active');
    const isActive = project.status === 'active';
    const isOnHold = project.status === 'on_hold';

    const statusLabel = { active: 'Activo', on_hold: 'En Pausa', completed: 'Completado' }[project.status] || project.status;
    const statusClass = { active: 'pj-card__status-badge--active', on_hold: 'pj-card__status-badge--paused', completed: 'pj-card__status-badge--completed' }[project.status] || '';

    return (
        <div
            className={`pj-card ${!isActive ? 'pj-card--inactive' : ''}`}
            onClick={() => onCardClick(project)}
        >
            {/* ── Mapa interactivo superior ── */}
            <div className="pj-card__map">
                <MapEmbed lat={project.latitude} lng={project.longitude} height={160} zoom={14} />
                <span className={`pj-card__status-badge ${statusClass}`}>{statusLabel}</span>
            </div>

            {/* ── Cuerpo ── */}
            <div className="pj-card__body">
                <div className="pj-card__head">
                    <div>
                        <p className="pj-card__name">{project.name}</p>
                        <p className="pj-card__client">{project.client?.company_name || '—'}</p>
                    </div>
                    <div className="pj-card__actions" onClick={e => e.stopPropagation()}>
                        <button
                            className="pj-card__action-btn"
                            title="Editar"
                            onClick={() => onEdit(project)}
                        >
                            <Edit2 size={13} />
                        </button>
                        <button
                            className={`pj-card__action-btn ${!isActive ? '' : 'pj-card__action-btn--pause'}`}
                            title={isActive ? 'Pausar' : 'Reactivar'}
                            onClick={() => onToggle(project)}
                        >
                            {isActive ? <Pause size={13} /> : <Play size={13} />}
                        </button>
                    </div>
                </div>

                {/* Info rows */}
                <div className="pj-card__info">
                    <div className="pj-card__info-row">
                        <MapPin size={11} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {project.address}
                        </span>
                    </div>
                    <div className="pj-card__info-row">
                        <Calendar size={11} />
                        <span>{fmtDate(project.start_date)}</span>
                        {project.end_date && <><ChevronRight size={10} /><span>{fmtDate(project.end_date)}</span></>}
                    </div>
                </div>

                {/* Footer */}
                <div className="pj-card__footer">
                    <span className="pj-card__gps-chip">
                        <Navigation size={10} /> {project.gps_radius_meters}m
                    </span>
                    <span className="pj-card__workers">
                        <Users size={11} /> {activeAssignments.length} worker{activeAssignments.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Assign Worker Modal ────────────────────────────────────────────────────────
function AssignModal({ project, workers, api, showToast, onAssigned, onClose }) {
    const { post } = api;
    const [form, setForm] = useState(EMPTY_ASSIGN);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleAssign = async () => {
        if (!form.worker_id || !form.start_date) return setError('Worker y fecha de inicio requeridos.');
        setSaving(true); setError('');
        try {
            const res = await post('/assignments', {
                worker_id: parseInt(form.worker_id),
                project_id: project.id,
                start_date: form.start_date,
                end_date: form.end_date || null,
            });
            const data = res.data?.data || res.data || res;
            onAssigned(data);
            showToast(`Worker asignado al proyecto exitosamente.`);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al asignar worker.');
        } finally {
            setSaving(false);
        }
    };

    return ReactDOM.createPortal(
        <div className="pj-overlay" style={{ zIndex: 700 }} onClick={onClose}>
            <div className="pj-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                <div className="pj-modal__header">
                    <div className="hmcs-modal-identity">
                        <div className="hmcs-modal-identity__avatar-wrap">
                            <div className="hmcs-modal-identity__avatar">
                                <UserPlus size={24} />
                            </div>
                        </div>
                        <div className="hmcs-modal-identity__text">
                            <h2 className="hmcs-modal-identity__name">Asignar Trabajador</h2>
                            <div className="hmcs-modal-identity__meta">
                                <span>{project?.name || 'Proyecto'}</span>
                            </div>
                        </div>
                    </div>
                    <button className="pj-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="pj-modal__body">
                    {error && <div className="wf-error">{error}</div>}

                    <div className="wf-field">
                        <label className="wf-label">Worker *</label>
                        <div className="workers-select-wrapper">
                            <select
                                className="wf-select"
                                value={form.worker_id}
                                onChange={e => setForm(p => ({ ...p, worker_id: e.target.value }))}
                            >
                                <option value="">Selecciona un worker...</option>
                                {workers.map(w => (
                                    <option key={w.id} value={w.id}>
                                        {w.first_name} {w.last_name} — {w.trade?.name_es || w.trade?.name || 'Sin oficio'} ({w.worker_code})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={13} className="workers-select__arrow" />
                        </div>
                    </div>

                    <div className="wf-grid-2">
                        <div className="wf-field">
                            <label className="wf-label">Fecha inicio *</label>
                            <input
                                className="wf-input"
                                type="date"
                                value={form.start_date}
                                onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                            />
                        </div>
                        <div className="wf-field">
                            <label className="wf-label">Fecha fin (opcional)</label>
                            <input
                                className="wf-input"
                                type="date"
                                value={form.end_date}
                                onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>
                <div className="pj-modal__footer">
                    <button className="pj-btn-cancel" onClick={onClose}>Cancelar</button>
                    <button className="pj-btn-primary" onClick={handleAssign} disabled={saving}>
                        <UserPlus size={15} /> {saving ? 'Asignando...' : 'Asignar'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Project Detail Panel (65% mini-página) ─────────────────────────────────────
function ProjectDetailPanel({ project, api, showToast, onClose, onEdit, onDeleted, onToggle, token }) {
    const { put, del, get } = api;
    const [assignments, setAssignments] = useState(project.assignments || []);
    const [showAssign, setShowAssign] = useState(false);
    const [activeWorkers, setActiveWorkers] = useState([]);
    const [deleteStep, setDeleteStep] = useState(0);
    const [linkedData, setLinkedData] = useState(null);
    const [confirmId, setConfirmId] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    // ESC key
    useEffect(() => {
        const handler = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Load workers for assign modal
    const loadWorkers = useCallback(async () => {
        try {
            const res = await get('/workers');
            setActiveWorkers(res.data || res);
        } catch { /* no-op */ }
    }, [get]);
    useEffect(() => { loadWorkers(); }, [loadWorkers]);

    if (!project) return null;
    const isActive = project.status === 'active';
    const totalHrs = (project.timeEntries || []).reduce((s, t) => s + parseFloat(t.total_hours || 0), 0);

    // Complete assignment
    const handleCompleteAssignment = async (asgn) => {
        try {
            const today = new Date().toISOString().split('T')[0];
            await put(`/assignments/${asgn.id}`, { status: 'completed', end_date: today });
            setAssignments(prev => prev.map(a => a.id === asgn.id ? { ...a, status: 'completed', end_date: today } : a));
            showToast(`${asgn.worker?.first_name} finalizado en este proyecto.`);
        } catch { showToast('Error al finalizar asignación', 'error'); }
    };

    // Delete flow
    const startDelete = async () => {
        try {
            const res = await get(`/projects/${project.id}/linked-data`);
            const data = res.data?.data || res.data || res;
            setLinkedData(data);
        } catch {
            setLinkedData({ assignments: 0, time_entries: 0, total: 0, can_hard_delete: true });
        }
        setDeleteStep(1);
    };

    const confirmDelete = async () => {
        if (String(confirmId).trim() !== String(project.id)) return;
        setDeleteLoading(true);
        try {
            const res = await del(`/projects/${project.id}/force?confirmed_id=${project.id}`);
            const data = res.data?.data || res.data || res;
            if (data?.action === 'deleted') {
                showToast(`"${project.name}" eliminado permanentemente.`, 'success');
            } else {
                showToast(`"${project.name}" ocultado. Datos históricos conservados.`, 'success');
            }
            onDeleted(project.id);
            onClose();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al eliminar', 'error');
        } finally {
            setDeleteLoading(false);
            setDeleteStep(0);
            setConfirmId('');
        }
    };

    const statusMap = {
        active:    'Activo',
        on_hold:   'En Pausa',
        completed: 'Completado',
    };

    return ReactDOM.createPortal(
        <>
            {/* Overlay */}
            <div className="pj-detail-overlay" onClick={onClose} />

            {/* Panel */}
            <div className="pj-detail-panel">

                {/* ── HEADER ── */}
                <div className="pj-detail__header">
                    <div className="pj-detail__header-left">
                        <div className="pj-detail__icon">
                            <MapPin size={22} />
                        </div>
                        <div>
                            <h2 className="pj-detail__name">{project.name}</h2>
                            <p className="pj-detail__client">{project.client?.company_name || '—'}</p>
                        </div>
                    </div>
                    <div className="pj-detail__header-right">
                        <StatusBadge status={project.status} />
                        {totalHrs > 0 && (
                            <span className="pj-detail__hrs-badge">{totalHrs.toFixed(0)}h</span>
                        )}
                        <button className="pj-detail__close" onClick={onClose}><X size={16} /></button>
                    </div>
                </div>

                {/* ── QUICK ACTIONS ── */}
                <div className="pj-detail__quick-actions">
                    <button
                        className="pj-detail__qa-btn pj-detail__qa-btn--primary"
                        onClick={() => { onEdit(project); onClose(); }}
                    >
                        <Edit2 size={14} /> Editar
                    </button>
                    <button
                        className="pj-detail__qa-btn"
                        onClick={() => onToggle(project)}
                    >
                        {isActive ? <Pause size={14} /> : <Play size={14} />}
                        {isActive ? 'Pausar' : 'Reanudar'}
                    </button>
                    <button
                        className="pj-detail__qa-btn pj-detail__qa-btn--danger"
                        onClick={startDelete}
                    >
                        <Trash2 size={14} /> Eliminar
                    </button>
                </div>

                {/* ── CONTENT: 2 columnas ── */}
                <div className="pj-detail__content">

                    {/* COLUMNA IZQUIERDA */}
                    <div className="pj-detail__left">

                        {/* Información general */}
                        <div className="pj-detail__section">
                            <h3 className="pj-detail__section-title">
                                <Info size={13} /> INFORMACIÓN
                            </h3>
                            <div className="pj-detail__rows">
                                <div className="pj-detail__row">
                                    <span className="pj-detail__row-label">Dirección</span>
                                    <span className="pj-detail__row-value">{project.address}</span>
                                </div>
                                <div className="pj-detail__row">
                                    <span className="pj-detail__row-label">Inicio</span>
                                    <span className="pj-detail__row-value">{fmtDate(project.start_date)}</span>
                                </div>
                                <div className="pj-detail__row">
                                    <span className="pj-detail__row-label">Fin</span>
                                    <span className="pj-detail__row-value">{fmtDate(project.end_date)}</span>
                                </div>
                                {project.notes && (
                                    <div className="pj-detail__row">
                                        <span className="pj-detail__row-label">Notas</span>
                                        <span className="pj-detail__row-value" style={{ color: 'var(--text-muted)' }}>
                                            {project.notes}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* GPS */}
                        <div className="pj-detail__section">
                            <h3 className="pj-detail__section-title">
                                <Navigation size={13} /> CONFIGURACIÓN GPS
                            </h3>
                            <div className="pj-detail__gps-info">
                                <div className="pj-detail__gps-coords">
                                    {parseFloat(project.latitude).toFixed(6)}, {parseFloat(project.longitude).toFixed(6)}
                                    <a
                                        href={`https://maps.google.com/?q=${project.latitude},${project.longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="pj-detail__map-link"
                                        onClick={e => e.stopPropagation()}
                                    >↗</a>
                                </div>
                                <div className="pj-detail__gps-radius">
                                    Radio: {project.gps_radius_meters}m
                                </div>
                            </div>
                        </div>

                        {/* Reglas de jornada */}
                        <div className="pj-detail__section">
                            <h3 className="pj-detail__section-title">
                                <Coffee size={13} /> REGLAS DE JORNADA
                            </h3>
                            <div className="pj-detail__rules">
                                <div className="pj-detail__rule-chip">
                                    Almuerzo: {project.lunch_rule === 'paid' ? 'Pagado' : 'No pagado'} ({project.lunch_duration_minutes} min)
                                </div>
                                <div className="pj-detail__rule-chip">
                                    {parseFloat(project.work_hours_per_day).toFixed(1)}h trabajo / día
                                </div>
                                <div className="pj-detail__rule-chip">
                                    {parseFloat(project.paid_hours_per_day).toFixed(1)}h pagadas / día
                                </div>
                                {(project.shift_start_time || project.shift_end_time) && (
                                    <div className="pj-detail__rule-chip" style={{ background: '#E0E7FF', color: '#3730A3' }}>
                                        Horario: {project.shift_start_time ? project.shift_start_time.substring(0, 5) : '—'} a {project.shift_end_time ? project.shift_end_time.substring(0, 5) : '—'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Workers asignados */}
                        <div className="pj-detail__section">
                            <div className="pj-detail__section-header">
                                <h3 className="pj-detail__section-title" style={{ margin: 0 }}>
                                    <Users size={13} /> WORKERS ASIGNADOS ({assignments.filter(a => a.status === 'active').length})
                                </h3>
                                <button
                                    className="pj-detail__assign-btn"
                                    onClick={() => setShowAssign(true)}
                                >
                                    + Asignar
                                </button>
                            </div>
                            <div className="pj-detail__workers-list">
                                {assignments.length === 0 ? (
                                    <p className="pj-detail__empty">Sin workers asignados</p>
                                ) : (
                                    assignments.map(a => (
                                        <div key={a.id} className={`pj-detail__worker-row ${a.status !== 'active' ? 'pj-detail__worker-row--done' : ''}`}>
                                            <div className="pj-detail__worker-avatar">
                                                {workerInitials(a.worker)}
                                            </div>
                                            <div className="pj-detail__worker-info">
                                                <div className="pj-detail__worker-name">
                                                    {a.worker?.first_name} {a.worker?.last_name}
                                                </div>
                                                <div className="pj-detail__worker-meta">
                                                    {a.worker?.trade?.name_es || a.worker?.trade?.name || '—'} · Desde {fmtDate(a.start_date)}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span className={`pj-detail__worker-status pj-detail__worker-status--${a.status}`}>
                                                    {a.status === 'active' ? 'Activo' : a.status === 'completed' ? 'Finalizado' : 'Cancelado'}
                                                </span>
                                                {a.status === 'active' && (
                                                    <button
                                                        className="pj-detail__end-btn"
                                                        onClick={() => handleCompleteAssignment(a)}
                                                        title="Finalizar asignación"
                                                    >
                                                        <CheckCircle size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>


                    </div>

                    {/* COLUMNA DERECHA — Mapa grande */}
                    <div className="pj-detail__right">
                        <div className="pj-detail__map-container">
                            <MapEmbed
                                lat={project.latitude}
                                lng={project.longitude}
                                height="100%"
                                zoom={15}
                            />
                            <div className="pj-detail__map-label">
                                Radio GPS: {project.gps_radius_meters}m
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* ── Assign Modal (via portal independiente) ── */}
            {showAssign && (
                <AssignModal
                    project={project}
                    workers={activeWorkers}
                    api={api}
                    showToast={showToast}
                    onAssigned={newAsgn => setAssignments(prev => [newAsgn, ...prev])}
                    onClose={() => setShowAssign(false)}
                />
            )}

            {/* ── Delete Step 1 ── */}
            {deleteStep === 1 && linkedData && (() => {
                const canHard = linkedData.can_hard_delete ?? (linkedData.total === 0);
                return ReactDOM.createPortal(
                    <div className="pj-overlay" style={{ zIndex: 702 }} onClick={() => setDeleteStep(0)}>
                        <div className="pj-confirm-modal" onClick={e => e.stopPropagation()}>
                            <div className="pj-confirm-modal__icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                                {canHard ? <Trash2 size={28} /> : <EyeOff size={28} />}
                            </div>
                            {canHard ? (
                                <>
                                    <h3>Eliminar Proyecto Permanentemente</h3>
                                    <p>Este proyecto <strong>no tiene datos vinculados</strong>.</p>
                                    <div className="pj-linked-data" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                        <p style={{ color: '#065F46', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={14} /> Sin datos vinculados</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <h3>Ocultar Proyecto Permanentemente</h3>
                                    <p>Este proyecto tiene <strong>datos vinculados</strong>.</p>
                                    <div className="pj-linked-data">
                                        <ul>
                                            {linkedData.assignments > 0 && <li>• {linkedData.assignments} asignación(es)</li>}
                                            {linkedData.time_entries > 0 && <li>• {linkedData.time_entries} entrada(s) de tiempo</li>}
                                        </ul>
                                        <p className="pj-linked-data__warning">Los datos históricos se conservan.</p>
                                    </div>
                                </>
                            )}
                            <div className="pj-confirm-modal__actions">
                                <button className="pj-btn-cancel" onClick={() => setDeleteStep(0)}>Cancelar</button>
                                <button className="pj-btn-danger" onClick={() => setDeleteStep(2)}>Sí, continuar →</button>
                            </div>
                        </div>
                    </div>,
                    document.body
                );
            })()}

            {/* ── Delete Step 2 ── */}
            {deleteStep === 2 && (() => {
                const canHard = linkedData?.can_hard_delete ?? (linkedData?.total === 0);
                return ReactDOM.createPortal(
                    <div className="pj-overlay" style={{ zIndex: 702 }} onClick={() => { setDeleteStep(0); setConfirmId(''); }}>
                        <div className="pj-confirm-modal" onClick={e => e.stopPropagation()}>
                            <div className="pj-confirm-modal__icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                                <Shield size={28} />
                            </div>
                            <h3>Confirmación Final</h3>
                            <p>Escribe el ID del proyecto para confirmar:</p>
                            <div className="pj-confirm-id">
                                <code className="pj-confirm-id__code">{project.id}</code>
                                <input
                                    className="wf-input"
                                    value={confirmId}
                                    onChange={e => setConfirmId(e.target.value)}
                                    placeholder="Escribe el ID aquí"
                                    autoFocus
                                    type="number"
                                />
                            </div>
                            <div className="pj-confirm-modal__actions">
                                <button className="pj-btn-cancel" onClick={() => { setDeleteStep(0); setConfirmId(''); }}>Cancelar</button>
                                <button
                                    className="pj-btn-danger"
                                    onClick={confirmDelete}
                                    disabled={String(confirmId).trim() !== String(project.id) || deleteLoading}
                                >
                                    {canHard
                                        ? <><Trash2 size={15} /> {deleteLoading ? 'Eliminando...' : 'Eliminar Definitivamente'}</>
                                        : <><EyeOff size={15} /> {deleteLoading ? 'Ocultando...' : 'Ocultar Permanentemente'}</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                );
            })()}
        </>,
        document.body
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Projects() {
    const { token } = useAuth();
    const api = useApi();
    const { get, post, put, patch } = api;

    const [projects, setProjects] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [clients, setClients] = useState([]);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('projects_view') || 'cards');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [drawerProject, setDrawerProject] = useState(null);
    const [toastMsg, setToastMsg] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterClient, setFilterClient] = useState('');
    const [filterStatus, setFilterStatus] = useState('active');
    const [mapsInput, setMapsInput] = useState('');
    const [mapsError, setMapsError] = useState('');
    const [parsingMap, setParsingMap] = useState(false);
    const [stats, setStats] = useState({ total: 0, active: 0, onHold: 0, workersAssigned: 0 });

    const changeView = m => { setViewMode(m); localStorage.setItem('projects_view', m); };

    // ── Fetch ───────────────────────────────────────────────────────────────────
    const fetchProjects = useCallback(async () => {
        try {
            let url = '/projects?include_all=true';
            if (filterStatus && filterStatus !== 'all') url += `&status=${filterStatus}`;
            if (filterClient) url += `&client_id=${filterClient}`;
            const res = await get(url);
            setProjects(res.data || res);
        } catch { showToast('Error al cargar proyectos', 'error'); }
    }, [get, filterStatus, filterClient]);

    const fetchClients = useCallback(async () => {
        try {
            const res = await get('/clients?include_inactive=false');
            setClients(res.data || res);
        } catch { /* no-op */ }
    }, [get]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await get('/projects?include_all=true');
            const all = res.data || res;
            const act = all.filter(p => p.status === 'active');
            const hold = all.filter(p => p.status === 'on_hold');
            const totalWorkers = new Set(
                act.flatMap(p => (p.assignments || []).map(a => a.worker_id))
            ).size;
            setStats({ total: all.length, active: act.length, onHold: hold.length, workersAssigned: totalWorkers });
        } catch { /* no-op */ }
    }, [get]);

    useEffect(() => { fetchProjects(); fetchClients(); fetchStats(); }, [fetchProjects, fetchClients, fetchStats]);

    // ── Client-side search filter ───────────────────────────────────────────────
    useEffect(() => {
        let list = [...projects];
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(p =>
                p.name?.toLowerCase().includes(q) ||
                p.address?.toLowerCase().includes(q) ||
                p.client?.company_name?.toLowerCase().includes(q)
            );
        }
        setFiltered(list);
    }, [projects, searchTerm]);

    // ── Toast ───────────────────────────────────────────────────────────────────
    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3800);
    };

    // ── CRUD ────────────────────────────────────────────────────────────────────
    const openCreate = () => {
        setFormData(EMPTY_FORM); setMapsInput(''); setMapsError('');
        setFormError(''); setEditingId(null); setModalMode('create'); setModalOpen(true);
    };
    const openEdit = (p) => {
        
        const startParsed = fromTime24(p.shift_start_time);
        const endParsed = fromTime24(p.shift_end_time);

        setFormData({
            client_id: String(p.client_id || ''),
            name: p.name || '',
            address: p.address || '',
            latitude: String(p.latitude || ''),
            longitude: String(p.longitude || ''),
            gps_radius_meters: String(p.gps_radius_meters || '500'),
            lunch_rule: p.lunch_rule || 'paid',
            lunch_duration_minutes: String(p.lunch_duration_minutes || '60'),
            work_hours_per_day: String(p.work_hours_per_day || '9.00'),
            paid_hours_per_day: String(p.paid_hours_per_day || '10.00'),
            shiftStartHour: startParsed.hour,
            shiftStartMinute: startParsed.minute,
            shiftStartPeriod: startParsed.period,
            shiftEndHour: endParsed.hour,
            shiftEndMinute: endParsed.minute,
            shiftEndPeriod: endParsed.period,
            start_date: p.start_date || '',
            end_date: p.end_date || '',
            status: p.status || 'active',
            notes: p.notes || '',
        });
        setMapsInput(''); setMapsError('');
        setFormError(''); setEditingId(p.id); setModalMode('edit'); setModalOpen(true);
    };

    const parseMapsUrl = async () => {
        if (!mapsInput.trim()) return;
        
        // 1. First try simple local regex for full links
        const coords = parseGoogleMapsUrl(mapsInput);
        if (coords) {
            setFormData(p => ({ ...p, latitude: coords.lat, longitude: coords.lng }));
            setMapsError('');
            return;
        }

        // 2. If it's a short URL (maps.app.goo.gl), resolve via backend
        setParsingMap(true);
        setMapsError('');
        try {
            const res = await get(`/projects/utils/resolve-map-url?url=${encodeURIComponent(mapsInput)}`);
            const data = res.data?.data || res.data;
            if (data.lat && data.lng) {
                setFormData(p => ({ ...p, latitude: data.lat, longitude: data.lng }));
                setMapsError('');
            }
        } catch (err) {
            setMapsError(err.response?.data?.message || 'No se pudieron extraer coordenadas. Ingresa manualmente o usa una URL con @lat,lng.');
        } finally {
            setParsingMap(false);
        }
    };

    const handleSave = async () => {
        const { client_id, name, address, latitude, longitude } = formData;
        if (!client_id || !name || !address) return setFormError('Cliente, nombre y dirección son requeridos.');
        if (!latitude || !longitude) return setFormError('Coordenadas GPS requeridas.');
        setSubmitting(true); setFormError('');
        try {
            const payload = {
                ...formData,
                shift_start_time: toTime24(formData.shiftStartHour, formData.shiftStartMinute, formData.shiftStartPeriod),
                shift_end_time: toTime24(formData.shiftEndHour, formData.shiftEndMinute, formData.shiftEndPeriod),
                latitude: parseFloat(formData.latitude),
                longitude: parseFloat(formData.longitude),
                gps_radius_meters: parseInt(formData.gps_radius_meters || 500),
                lunch_duration_minutes: parseInt(formData.lunch_duration_minutes || 60),
                work_hours_per_day: parseFloat(formData.work_hours_per_day || 9),
                paid_hours_per_day: parseFloat(formData.paid_hours_per_day || 10),
                client_id: parseInt(formData.client_id),
            };
            if (modalMode === 'create') {
                const res = await post('/projects', payload);
                const newP = res.data?.data || res.data || res;
                setProjects(prev => [newP, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
                showToast(`"${newP.name}" creado exitosamente.`);
            } else {
                const res = await put(`/projects/${editingId}`, payload);
                const upd = res.data?.data || res.data || res;
                setProjects(prev => prev.map(p => p.id === editingId ? upd : p));
                if (drawerProject?.id === editingId) setDrawerProject(upd);
                showToast(`"${upd.name}" actualizado.`);
            }
            setModalOpen(false);
            fetchStats();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Error al guardar');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggle = async (p) => {
        try {
            const res = await patch(`/projects/${p.id}/toggle-status`, {});
            const upd = res.data?.data || res.data || res;
            setProjects(prev => prev.map(x => x.id === p.id ? upd : x));
            if (drawerProject?.id === p.id) setDrawerProject(upd);
            showToast(upd.status === 'active' ? 'Proyecto reactivado.' : 'Proyecto pausado.');
            fetchProjects();
        } catch { showToast('Error al cambiar estado', 'error'); }
    };

    const handleDeleted = id => {
        setProjects(prev => prev.filter(p => p.id !== id));
        fetchStats();
    };

    // ── KPI cards data ──────────────────────────────────────────────────────────
    const KPI_CARDS = [
        { label: 'Total',          value: stats.total,           icon: <FolderOpen size={18} />,  color: '#2A6C95' },
        { label: 'Activos',        value: stats.active,          icon: <CheckCircle size={18} />, color: '#10B981' },
        { label: 'En Pausa',       value: stats.onHold,          icon: <Pause size={18} />,       color: '#F59E0B' },
        { label: 'Workers Asig.', value: stats.workersAssigned,  icon: <Users size={18} />,       color: '#8B5CF6' },
    ];

    return (
        <div className="projects-page fade-in">

            {/* Toast */}
            {toastMsg && (
                <div className={`workers-toast workers-toast--${toastMsg.type}`}>
                    {toastMsg.type === 'success' ? <CheckCircle size={15} /> : <X size={15} />}
                    {toastMsg.msg}
                </div>
            )}

            {/* ── Header ── */}
            <div className="pj-header">
                <div>
                    <h1 className="pj-header__title">Gestión de Proyectos</h1>
                    <p className="pj-header__subtitle">Administra proyectos, GPS y asignaciones de workers</p>
                </div>
                <button className="pj-btn-new" onClick={openCreate}>
                    <Plus size={16} /> Nuevo Proyecto
                </button>
            </div>

            {/* ── KPI Cards ── */}
            <div className="pj-kpis">
                {KPI_CARDS.map((k, i) => (
                    <div key={i} className="pj-kpi">
                        <div className="pj-kpi__icon" style={{ background: `${k.color}15`, color: k.color }}>
                            {k.icon}
                        </div>
                        <div className="pj-kpi__body">
                            <p className="pj-kpi__value">{k.value}</p>
                            <p className="pj-kpi__label">{k.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Toolbar ── */}
            <div className="pj-toolbar">
                <div className="pj-search">
                    <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        className="pj-search__input"
                        placeholder="Buscar por nombre, dirección o cliente..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="workers-select-wrapper">
                    <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="workers-select">
                        <option value="">Todos los clientes</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <div className="workers-select-wrapper">
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="workers-select">
                        <option value="active">Activos</option>
                        <option value="on_hold">En Pausa</option>
                        <option value="completed">Completados</option>
                        <option value="all">Todos</option>
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <span className="pj-results">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
                <div className="workers-view-toggle">
                    <button className={`workers-view-btn ${viewMode === 'cards' ? 'workers-view-btn--active' : ''}`} onClick={() => changeView('cards')}><LayoutGrid size={15} /></button>
                    <button className={`workers-view-btn ${viewMode === 'table' ? 'workers-view-btn--active' : ''}`} onClick={() => changeView('table')}><List size={15} /></button>
                </div>
            </div>

            {/* ── Content ── */}
            {filtered.length === 0 ? (
                <div className="workers-empty">
                    <MapPin size={48} />
                    <p>No se encontraron proyectos</p>
                    <button className="pj-btn-new" onClick={openCreate}><Plus size={16} /> Crear el primero</button>
                </div>
            ) : viewMode === 'cards' ? (
                <div className="pj-grid">
                    {filtered.map(p => (
                        <ProjectCard
                            key={p.id}
                            project={p}
                            onEdit={openEdit}
                            onToggle={handleToggle}
                            onCardClick={setDrawerProject}
                        />
                    ))}
                </div>
            ) : (
                <div className="workers-table-wrap">
                    <table className="workers-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Cliente</th>
                                <th>Dirección</th>
                                <th>Estado</th>
                                <th>Workers</th>
                                <th>GPS Radio</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => (
                                <tr key={p.id} className="workers-table__row" onClick={() => setDrawerProject(p)}>
                                    <td><strong>{p.name}</strong></td>
                                    <td>{p.client?.company_name || '—'}</td>
                                    <td style={{ fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.address}</td>
                                    <td><StatusBadge status={p.status} /></td>
                                    <td>{(p.assignments || []).filter(a => a.status === 'active').length}</td>
                                    <td>{p.gps_radius_meters}m</td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <div className="workers-table__actions">
                                            <button className="pj-card__action-btn" onClick={() => openEdit(p)}><Edit2 size={13} /></button>
                                            <button className="pj-card__action-btn" onClick={() => handleToggle(p)}>
                                                {p.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Detail Panel (portal) ── */}
            {drawerProject && (
                <ProjectDetailPanel
                    project={drawerProject}
                    api={api}
                    showToast={showToast}
                    onClose={() => setDrawerProject(null)}
                    onEdit={openEdit}
                    onDeleted={handleDeleted}
                    onToggle={handleToggle}
                    token={token}
                />
            )}

            {/* ── New/Edit Modal (portal) ── */}
            {modalOpen && ReactDOM.createPortal(
                <div className="pj-overlay" onClick={() => setModalOpen(false)}>
                    <div className="pj-modal pj-modal--wide" onClick={e => e.stopPropagation()}>
                        <div className="pj-modal__header">
                            <div className="hmcs-modal-identity">
                                <div className="hmcs-modal-identity__avatar-wrap">
                                    <div className="hmcs-modal-identity__avatar">
                                        {modalMode === 'edit' && formData.name
                                            ? formData.name.slice(0, 2).toUpperCase()
                                            : <FolderOpen size={24} />
                                        }
                                    </div>
                                </div>
                                <div className="hmcs-modal-identity__text">
                                    <h2 className="hmcs-modal-identity__name">
                                        {modalMode === 'create' ? 'Nuevo Proyecto' : formData.name || 'Editar Proyecto'}
                                    </h2>
                                    <div className="hmcs-modal-identity__meta">
                                        <span>Gestión de proyectos</span>
                                    </div>
                                </div>
                            </div>
                            <button className="pj-modal__close" onClick={() => setModalOpen(false)}><X size={18} /></button>
                        </div>
                        <div className="pj-modal__body">
                            {formError && <div className="wf-error">{formError}</div>}

                            {/* Datos básicos */}
                            <div className="wf-section-title"><FolderOpen size={14} /> Datos del Proyecto</div>
                            <div className="wf-grid-2">
                                <div className="wf-field">
                                    <label className="wf-label">Cliente *</label>
                                    <div className="workers-select-wrapper">
                                        <select className="wf-select" value={formData.client_id} onChange={e => setFormData(p => ({ ...p, client_id: e.target.value }))}>
                                            <option value="">Selecciona un cliente...</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                                        </select>
                                        <ChevronDown size={13} className="workers-select__arrow" />
                                    </div>
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Nombre del proyecto *</label>
                                    <input className="wf-input" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Riverside Renovation" />
                                </div>
                            </div>
                            <div className="wf-field">
                                <label className="wf-label">Dirección del proyecto *</label>
                                <input className="wf-input" value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} placeholder="123 Oak Street, Savannah, GA 31401" />
                            </div>

                            {/* GPS */}
                            <div className="wf-section-title"><Navigation size={14} /> Ubicación GPS</div>
                            <div className="proj-maps-extractor">
                                <input
                                    className="wf-input"
                                    value={mapsInput}
                                    onChange={e => setMapsInput(e.target.value)}
                                    placeholder="Pega un enlace de Google Maps o introduce manualmente..."
                                    disabled={parsingMap}
                                />
                                <button type="button" className="proj-extract-btn" onClick={parseMapsUrl} disabled={parsingMap || !mapsInput.trim()}>
                                    {parsingMap ? '...' : 'Extraer'}
                                </button>
                            </div>
                            {mapsError && <p className="proj-maps-error">{mapsError}</p>}
                            <p className="proj-maps-hint" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} /> Abre Google Maps, busca la dirección, haz click derecho → "¿Qué hay aquí?" y copia el enlace. Pégalo arriba para auto-extraer coordenadas.
                            </p>
                            <div className="wf-grid-3">
                                <div className="wf-field">
                                    <label className="wf-label">Latitud *</label>
                                    <input className="wf-input" type="number" step="0.0000001" value={formData.latitude} onChange={e => setFormData(p => ({ ...p, latitude: e.target.value }))} placeholder="32.0809" />
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Longitud *</label>
                                    <input className="wf-input" type="number" step="0.0000001" value={formData.longitude} onChange={e => setFormData(p => ({ ...p, longitude: e.target.value }))} placeholder="-81.0912" />
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Radio GPS (m)</label>
                                    <input className="wf-input" type="number" value={formData.gps_radius_meters} onChange={e => setFormData(p => ({ ...p, gps_radius_meters: e.target.value }))} placeholder="500" />
                                </div>
                            </div>
                            {formData.latitude && formData.longitude && (
                                <div className="proj-preview-map">
                                    <a
                                        href={`https://maps.google.com/?q=${formData.latitude},${formData.longitude}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="proj-preview-link"
                                    >
                                        📍 Verificar en Google Maps — ({parseFloat(formData.latitude).toFixed(4)}, {parseFloat(formData.longitude).toFixed(4)})
                                    </a>
                                </div>
                            )}

                            {/* Reglas de jornada */}
                            <div className="wf-section-title"><Coffee size={14} /> Reglas de Jornada</div>
                            <div className="wf-grid-2">
                                <div className="wf-field">
                                    <label className="wf-label">Regla de almuerzo</label>
                                    <div className="workers-select-wrapper">
                                        <select className="wf-select" value={formData.lunch_rule} onChange={e => setFormData(p => ({ ...p, lunch_rule: e.target.value }))}>
                                            <option value="paid">Pagado</option>
                                            <option value="unpaid">No pagado</option>
                                        </select>
                                        <ChevronDown size={13} className="workers-select__arrow" />
                                    </div>
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Duración almuerzo (min)</label>
                                    <input className="wf-input" type="number" value={formData.lunch_duration_minutes} onChange={e => setFormData(p => ({ ...p, lunch_duration_minutes: e.target.value }))} />
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Horas trabajo/día</label>
                                    <input className="wf-input" type="number" step="0.25" value={formData.work_hours_per_day} onChange={e => setFormData(p => ({ ...p, work_hours_per_day: e.target.value }))} />
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Horas pagadas/día</label>
                                    <input className="wf-input" type="number" step="0.25" value={formData.paid_hours_per_day} onChange={e => setFormData(p => ({ ...p, paid_hours_per_day: e.target.value }))} />
                                </div>
                            </div>
                            <div className="wf-grid-2">
                                <div className="wf-field">
                                    <label className="wf-label">Hora de Entrada <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: 6 }}>(Opcional)</span></label>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <select className="wf-select" style={{ flex: 1, padding: '0 8px' }} value={formData.shiftStartHour} onChange={e => setFormData(p => ({ ...p, shiftStartHour: e.target.value }))}>
                                            <option value="">--</option>
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                        <select className="wf-select" style={{ flex: 1, padding: '0 8px' }} value={formData.shiftStartMinute} onChange={e => setFormData(p => ({ ...p, shiftStartMinute: e.target.value }))}>
                                            <option value="">--</option>
                                            {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <select className="wf-select" style={{ flex: 1, padding: '0 8px' }} value={formData.shiftStartPeriod} onChange={e => setFormData(p => ({ ...p, shiftStartPeriod: e.target.value }))}>
                                            <option value="">--</option>
                                            <option value="AM">AM</option>
                                            <option value="PM">PM</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Hora de Salida <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: 6 }}>(Opcional)</span></label>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <select className="wf-select" style={{ flex: 1, padding: '0 8px' }} value={formData.shiftEndHour} onChange={e => setFormData(p => ({ ...p, shiftEndHour: e.target.value }))}>
                                            <option value="">--</option>
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                        <select className="wf-select" style={{ flex: 1, padding: '0 8px' }} value={formData.shiftEndMinute} onChange={e => setFormData(p => ({ ...p, shiftEndMinute: e.target.value }))}>
                                            <option value="">--</option>
                                            {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <select className="wf-select" style={{ flex: 1, padding: '0 8px' }} value={formData.shiftEndPeriod} onChange={e => setFormData(p => ({ ...p, shiftEndPeriod: e.target.value }))}>
                                            <option value="">--</option>
                                            <option value="AM">AM</option>
                                            <option value="PM">PM</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <p style={{ marginTop: -8, marginBottom: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                                Si se configuran, se sugerirán automáticamente al registrar horas de este proyecto.
                            </p>

                            {/* Fechas y estado */}
                            <div className="wf-section-title"><Calendar size={14} /> Fechas y Estado</div>
                            <div className="wf-grid-3">
                                <div className="wf-field">
                                    <label className="wf-label">Fecha inicio</label>
                                    <input className="wf-input" type="date" value={formData.start_date} onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))} />
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Fecha fin</label>
                                    <input className="wf-input" type="date" value={formData.end_date} onChange={e => setFormData(p => ({ ...p, end_date: e.target.value }))} />
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Estado</label>
                                    <div className="workers-select-wrapper">
                                        <select className="wf-select" value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
                                            <option value="active">Activo</option>
                                            <option value="on_hold">En Pausa</option>
                                            <option value="completed">Completado</option>
                                        </select>
                                        <ChevronDown size={13} className="workers-select__arrow" />
                                    </div>
                                </div>
                            </div>
                            <div className="wf-field">
                                <label className="wf-label">Notas internas</label>
                                <textarea className="wf-input wf-textarea" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Notas opcionales..." />
                            </div>
                        </div>
                        <div className="pj-modal__footer">
                            <button className="pj-btn-cancel" onClick={() => setModalOpen(false)}>Cancelar</button>
                            <button className="pj-btn-primary" onClick={handleSave} disabled={submitting}>
                                {submitting ? 'Guardando...' : (modalMode === 'create' ? 'Crear Proyecto' : 'Guardar Cambios')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
