import { useState, useEffect, useCallback } from 'react';
import {
    Search, Plus, Edit2, X, ChevronDown,
    MapPin, Users, Clock, LayoutGrid, List,
    Pause, Play, Trash2, CheckCircle, Shield,
    EyeOff, FolderOpen, Calendar, Navigation,
    Coffee, BarChart3, Building2, UserPlus,
    AlertTriangle, ChevronRight
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import DocumentUploader from '../../components/DocumentUploader';
import { useAuth } from '../../context/AuthContext';
import './Projects.css';

// ─── Constants ─────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
    client_id: '', name: '', address: '',
    latitude: '', longitude: '',
    gps_radius_meters: '500',
    lunch_rule: 'paid',
    lunch_duration_minutes: '60',
    work_hours_per_day: '9.00',
    paid_hours_per_day: '10.00',
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

function StatusBadge({ status }) {
    const MAP = {
        active: { label: 'Activo', cls: 'proj-badge--active' },
        on_hold: { label: 'En Pausa', cls: 'proj-badge--hold' },
        completed: { label: 'Completado', cls: 'proj-badge--done' },
    };
    const s = MAP[status] || { label: status, cls: '' };
    return <span className={`proj-badge ${s.cls}`}>{s.label}</span>;
}

// ─── GPS Parser helper — extract coords from Google Maps URL ───────────────────
function parseGoogleMapsUrl(url) {
    // Handles: maps.google.com/?q=LAT,LNG  and maps.google.com/maps?ll=LAT,LNG
    // and standard share URL: https://maps.app.goo.gl/... (can't resolve without server)
    const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const destMatch = url.match(/[?&]destination=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const match = atMatch || qMatch || llMatch || destMatch;
    if (match) return { lat: match[1], lng: match[2] };
    return null;
}

// ─── Project Card ───────────────────────────────────────────────────────────────
function ProjectCard({ project, onEdit, onToggle, onCardClick }) {
    const assignments = project.assignments || [];
    const totalHrs = (project.timeEntries || []).reduce((s, t) => s + parseFloat(t.total_hours || 0), 0);
    const isActive = project.status === 'active';

    return (
        <div
            className={`proj-card ${!isActive ? 'proj-card--inactive' : ''}`}
            onClick={() => onCardClick(project)}
        >
            {/* Top */}
            <div className="proj-card__top">
                <div className="proj-card__icon">
                    <MapPin size={18} />
                </div>
                <div className="proj-card__identity">
                    <p className="proj-card__name">{project.name}</p>
                    <p className="proj-card__client">{project.client?.company_name || '—'}</p>
                </div>
                <div className="proj-card__actions" onClick={e => e.stopPropagation()}>
                    <button
                        className="pc-icon-btn pc-icon-btn--edit"
                        title="Editar"
                        onClick={() => onEdit(project)}
                    ><Edit2 size={13} /></button>
                    <button
                        className={`pc-icon-btn ${isActive ? 'pc-icon-btn--pause' : 'pc-icon-btn--play'}`}
                        title={isActive ? 'Pausar' : 'Reactivar'}
                        onClick={() => onToggle(project)}
                    >{isActive ? <Pause size={13} /> : <Play size={13} />}</button>
                </div>
            </div>

            {/* Address */}
            <div className="proj-card__address">
                <MapPin size={11} className="proj-card__row-icon" />
                <span>{project.address}</span>
            </div>

            {/* Status + quick stats */}
            <div className="proj-card__middle">
                <StatusBadge status={project.status} />
                <div className="proj-card__stats">
                    <span title="Workers asignados"><Users size={11} /> {assignments.length}</span>
                    {totalHrs > 0 && <span title="Horas totales"><Clock size={11} /> {totalHrs.toFixed(0)}h</span>}
                </div>
            </div>

            {/* Dates */}
            <div className="proj-card__dates">
                <Calendar size={11} />
                <span>{fmtDate(project.start_date)}</span>
                {project.end_date && <><ChevronRight size={10} /><span>{fmtDate(project.end_date)}</span></>}
            </div>

            {/* GPS + rules footer */}
            <div className="proj-card__footer">
                <div className="proj-card__gps">
                    <Navigation size={11} />
                    <span>{parseFloat(project.latitude).toFixed(4)}, {parseFloat(project.longitude).toFixed(4)}</span>
                    <span className="proj-card__radius">R:{project.gps_radius_meters}m</span>
                </div>
                <div className="proj-card__lunch">
                    <Coffee size={11} />
                    <span>{project.lunch_rule === 'paid' ? 'Almuerzo pagado' : 'Almuerzo no pagado'}</span>
                    <span>·</span>
                    <span>{parseFloat(project.work_hours_per_day || 9).toFixed(0)}h/{parseFloat(project.paid_hours_per_day || 10).toFixed(0)}h</span>
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

    return (
        <div className="workers-modal-overlay" style={{ zIndex: 1300 }} onClick={onClose}>
            <div className="workers-modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
                <div className="workers-modal__header">
                    <h2>Asignar Trabajador</h2>
                    <button className="workers-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="workers-modal__body">
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
                <div className="workers-modal__footer">
                    <button className="workers-btn-outline" onClick={onClose}>Cancelar</button>
                    <button className="workers-btn-primary" onClick={handleAssign} disabled={saving}>
                        <UserPlus size={15} /> {saving ? 'Asignando...' : 'Asignar'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Project Drawer ─────────────────────────────────────────────────────────────
function ProjectDrawer({ project, api, showToast, onClose, onEdit, onDeleted, onToggle, token }) {
    const { put, del, get, patch } = api;
    const [assignments, setAssignments] = useState(project.assignments || []);
    const [showAssign, setShowAssign] = useState(false);
    const [activeWorkers, setActiveWorkers] = useState([]);
    const [deleteStep, setDeleteStep] = useState(0);
    const [linkedData, setLinkedData] = useState(null);
    const [confirmId, setConfirmId] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    useEffect(() => {
        const handler = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Load active workers for the assign modal
    const loadWorkers = useCallback(async () => {
        try {
            const res = await get('/workers');
            setActiveWorkers(res.data || res);
        } catch { /* no-op */ }
    }, [get]);

    useEffect(() => { loadWorkers(); }, [loadWorkers]);

    if (!project) return null;
    const isActive = project.status === 'active';
    const mapsUrl = `https://maps.google.com/maps?q=${project.latitude},${project.longitude}&z=15&output=embed`;
    const totalHrs = (project.timeEntries || []).reduce((s, t) => s + parseFloat(t.total_hours || 0), 0);

    // Complete an assignment
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

    return (
        <>
            <div className="drawer-overlay" onClick={onClose} />
            <aside className="project-drawer" role="dialog" aria-label="Detalle del proyecto">
                <button className="drawer-close" onClick={onClose} title="Cerrar"><X size={20} /></button>

                {/* Hero */}
                <div className="drawer-hero">
                    <div className="proj-drawer-icon"><MapPin size={22} /></div>
                    <div className="drawer-hero__info">
                        <h2 className="drawer-hero__name">{project.name}</h2>
                        <span className="drawer-hero__sub">{project.client?.company_name}</span>
                        <div className="drawer-hero__badges">
                            <StatusBadge status={project.status} />
                            {totalHrs > 0 && <span className="proj-hrs-badge">{totalHrs.toFixed(0)}h totales</span>}
                        </div>
                    </div>
                </div>

                <div className="drawer-body">
                    {/* Info */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><FolderOpen size={13} /> Información</p>
                        <div className="drawer-field"><MapPin size={13} /><span className="drawer-field__label">Dirección:</span><span>{project.address}</span></div>
                        <div className="drawer-field"><Calendar size={13} /><span className="drawer-field__label">Inicio:</span><span>{fmtDate(project.start_date)}</span></div>
                        <div className="drawer-field"><Calendar size={13} /><span className="drawer-field__label">Fin:</span><span>{fmtDate(project.end_date)}</span></div>
                        {project.notes && <div className="drawer-field" style={{ alignItems: 'flex-start' }}><span className="drawer-field__label">Notas:</span><span style={{ color: '#6B7280' }}>{project.notes}</span></div>}
                    </div>

                    {/* GPS */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><Navigation size={13} /> Configuración GPS</p>
                        <div className="drawer-field">
                            <span className="drawer-field__label">Coordenadas:</span>
                            <span>{parseFloat(project.latitude).toFixed(6)}, {parseFloat(project.longitude).toFixed(6)}</span>
                            <a
                                href={`https://maps.google.com/?q=${project.latitude},${project.longitude}`}
                                target="_blank" rel="noopener noreferrer"
                                className="proj-map-link"
                                onClick={e => e.stopPropagation()}
                            >↗</a>
                        </div>
                        <div className="drawer-field">
                            <span className="drawer-field__label">Radio GPS:</span>
                            <span>{project.gps_radius_meters} metros</span>
                        </div>
                        {/* Embedded map */}
                        <div className="proj-map-container">
                            <iframe
                                title="project-map"
                                src={mapsUrl}
                                width="100%"
                                height="200"
                                style={{ border: 0, borderRadius: 8 }}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                    </div>

                    {/* Lunch rules */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><Coffee size={13} /> Reglas de Jornada</p>
                        <div className="drawer-field"><span className="drawer-field__label">Almuerzo:</span><span>{project.lunch_rule === 'paid' ? `Pagado (${project.lunch_duration_minutes} min)` : `No pagado (${project.lunch_duration_minutes} min)`}</span></div>
                        <div className="drawer-field"><span className="drawer-field__label">Horas trabajo/día:</span><span>{parseFloat(project.work_hours_per_day).toFixed(2)} h</span></div>
                        <div className="drawer-field"><span className="drawer-field__label">Horas pagadas/día:</span><span>{parseFloat(project.paid_hours_per_day).toFixed(2)} h</span></div>
                    </div>

                    {/* Assignments */}
                    <div className="drawer-section">
                        <div className="proj-section-header">
                            <p className="drawer-section__title" style={{ margin: 0 }}><Users size={13} /> Workers Asignados ({assignments.filter(a => a.status === 'active').length})</p>
                            <button className="proj-assign-btn" onClick={() => setShowAssign(true)}>
                                <UserPlus size={13} /> Asignar
                            </button>
                        </div>
                        {assignments.length === 0 ? (
                            <p className="drawer-empty-note">Sin workers asignados</p>
                        ) : (
                            <div className="proj-assignments-list">
                                {assignments.map(a => (
                                    <div key={a.id} className={`proj-assignment-row ${a.status !== 'active' ? 'proj-assignment-row--done' : ''}`}>
                                        <div className="workers-avatar-sm">{workerInitials(a.worker)}</div>
                                        <div className="proj-assignment-info">
                                            <span className="proj-assignment-name">
                                                {a.worker?.first_name} {a.worker?.last_name}
                                            </span>
                                            <span className="proj-assignment-meta">
                                                {a.worker?.trade?.name_es || a.worker?.trade?.name || '—'} · Desde {fmtDate(a.start_date)}
                                            </span>
                                        </div>
                                        <div className="proj-assignment-right">
                                            <span className={`proj-asgn-badge proj-asgn-badge--${a.status}`}>
                                                {a.status === 'active' ? 'Activo' : a.status === 'completed' ? 'Finalizado' : 'Cancelado'}
                                            </span>
                                            {a.status === 'active' && (
                                                <button
                                                    className="proj-end-btn"
                                                    onClick={() => handleCompleteAssignment(a)}
                                                    title="Finalizar asignación"
                                                >
                                                    <CheckCircle size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Documents */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><FolderOpen size={13} /> Documentos</p>
                        <DocumentUploader ownerType="company" ownerId={project.id} token={token} />
                    </div>

                    {/* Actions */}
                    <div className="drawer-section drawer-section--actions">
                        <p className="drawer-section__title">Acciones</p>
                        <button className="drawer-action-btn" onClick={() => onEdit(project)}>
                            <Edit2 size={14} /> Editar Proyecto
                        </button>
                        <button className="drawer-action-btn" onClick={() => onToggle(project)}>
                            {isActive ? <Pause size={14} /> : <Play size={14} />}
                            {isActive ? 'Pausar Proyecto' : 'Reactivar Proyecto'}
                        </button>
                        <button className="drawer-action-btn drawer-action-btn--danger" onClick={startDelete}>
                            <Trash2 size={14} /> Eliminar Proyecto
                        </button>
                    </div>
                </div>

                {/* Assign Modal */}
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

                {/* Delete Step 1 */}
                {deleteStep === 1 && linkedData && (() => {
                    const canHard = linkedData.can_hard_delete ?? (linkedData.total === 0);
                    return (
                        <div className="workers-modal-overlay" style={{ zIndex: 1200 }} onClick={() => setDeleteStep(0)}>
                            <div className="workers-confirm-modal" onClick={e => e.stopPropagation()}>
                                <div className="workers-confirm-modal__icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                                    {canHard ? <Trash2 size={28} /> : <EyeOff size={28} />}
                                </div>
                                {canHard ? (
                                    <>
                                        <h3>Eliminar Proyecto Permanentemente</h3>
                                        <p>Este proyecto <strong>no tiene datos vinculados</strong>.</p>
                                        <div className="delete-linked-data" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                            <p className="delete-linked-data__title" style={{ color: '#065F46' }}>✓ Sin datos vinculados</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h3>Ocultar Proyecto Permanentemente</h3>
                                        <p>Este proyecto tiene <strong>datos vinculados</strong>.</p>
                                        <div className="delete-linked-data">
                                            <ul>
                                                {linkedData.assignments > 0 && <li>• {linkedData.assignments} asignación(es)</li>}
                                                {linkedData.time_entries > 0 && <li>• {linkedData.time_entries} entrada(s) de tiempo</li>}
                                            </ul>
                                            <p className="delete-linked-data__warning">Los datos históricos se conservan.</p>
                                        </div>
                                    </>
                                )}
                                <div className="workers-confirm-modal__actions">
                                    <button className="workers-btn-outline" onClick={() => setDeleteStep(0)}>Cancelar</button>
                                    <button className="workers-btn-danger" onClick={() => setDeleteStep(2)}>Sí, continuar →</button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Delete Step 2 */}
                {deleteStep === 2 && (() => {
                    const canHard = linkedData?.can_hard_delete ?? (linkedData?.total === 0);
                    return (
                        <div className="workers-modal-overlay" style={{ zIndex: 1200 }} onClick={() => { setDeleteStep(0); setConfirmId(''); }}>
                            <div className="workers-confirm-modal" onClick={e => e.stopPropagation()}>
                                <div className="workers-confirm-modal__icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                                    <Shield size={28} />
                                </div>
                                <h3>Confirmación Final</h3>
                                <p>Escribe el ID del proyecto para confirmar:</p>
                                <div className="delete-code-confirm">
                                    <code className="delete-code-target">{project.id}</code>
                                    <input
                                        className="delete-code-input wf-input"
                                        value={confirmId}
                                        onChange={e => setConfirmId(e.target.value)}
                                        placeholder="Escribe el ID aquí"
                                        autoFocus
                                        type="number"
                                    />
                                </div>
                                <div className="workers-confirm-modal__actions">
                                    <button className="workers-btn-outline" onClick={() => { setDeleteStep(0); setConfirmId(''); }}>Cancelar</button>
                                    <button
                                        className="workers-btn-danger"
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
                        </div>
                    );
                })()}
            </aside>
        </>
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

    // Stats
    const [stats, setStats] = useState({ total: 0, active: 0, onHold: 0, workersAssigned: 0 });

    const changeView = m => { setViewMode(m); localStorage.setItem('projects_view', m); };

    // ── Fetch ──────────────────────────────────────────────────────
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

    // ── Client-side search filter ──────────────────────────────────
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

    // ── Toast ──────────────────────────────────────────────────────
    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3800);
    };

    // ── CRUD ───────────────────────────────────────────────────────
    const openCreate = () => {
        setFormData(EMPTY_FORM); setMapsInput(''); setMapsError('');
        setFormError(''); setEditingId(null); setModalMode('create'); setModalOpen(true);
    };
    const openEdit = p => {
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
            start_date: p.start_date || '',
            end_date: p.end_date || '',
            status: p.status || 'active',
            notes: p.notes || '',
        });
        setMapsInput(''); setMapsError('');
        setFormError(''); setEditingId(p.id); setModalMode('edit'); setModalOpen(true);
    };

    // Parse Google Maps URL
    const parseMapsUrl = () => {
        if (!mapsInput.trim()) return;
        const coords = parseGoogleMapsUrl(mapsInput);
        if (coords) {
            setFormData(p => ({ ...p, latitude: coords.lat, longitude: coords.lng }));
            setMapsError('');
        } else {
            setMapsError('No se pudieron extraer coordenadas. Ingresa manualmente o usa una URL con @lat,lng.');
        }
    };

    const handleSave = async () => {
        const { client_id, name, address, latitude, longitude } = formData;
        if (!client_id || !name || !address) return setFormError('Cliente, nombre y dirección son requeridos.');
        if (!latitude || !longitude) return setFormError('Coordenadas GPS requeridas. Usa el extracto de URL o ingresa manualmente.');
        setSubmitting(true); setFormError('');
        try {
            const payload = {
                ...formData,
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

    const STAT_CARDS = [
        { label: 'Total Proyectos', value: stats.total, icon: <FolderOpen size={18} />, color: '#2A6C95' },
        { label: 'Activos', value: stats.active, icon: <CheckCircle size={18} />, color: '#10B981' },
        { label: 'En Pausa', value: stats.onHold, icon: <Pause size={18} />, color: '#F59E0B' },
        { label: 'Workers Asignados', value: stats.workersAssigned, icon: <Users size={18} />, color: '#8B5CF6' },
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

            {/* Header */}
            <div className="projects-header">
                <div>
                    <h1 className="projects-title">Gestión de Proyectos</h1>
                    <p className="projects-subtitle">Administra proyectos, GPS y asignaciones de workers</p>
                </div>
                <button className="workers-btn-primary" onClick={openCreate}>
                    <Plus size={16} /> Nuevo Proyecto
                </button>
            </div>

            {/* Stat cards */}
            <div className="projects-stats-grid">
                {STAT_CARDS.map((s, i) => (
                    <div key={i} className="projects-stat-card">
                        <div className="projects-stat-card__icon" style={{ background: `${s.color}15`, color: s.color }}>
                            {s.icon}
                        </div>
                        <div>
                            <p className="projects-stat-card__value">{s.value}</p>
                            <p className="projects-stat-card__label">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters toolbar */}
            <div className="workers-toolbar">
                <div className="workers-search-box">
                    <Search size={15} className="workers-search-icon" />
                    <input
                        className="workers-search-input"
                        placeholder="Buscar por nombre, dirección..."
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
                <span className="workers-count">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
                <div className="workers-view-toggle">
                    <button className={`workers-view-btn ${viewMode === 'cards' ? 'workers-view-btn--active' : ''}`} onClick={() => changeView('cards')}><LayoutGrid size={15} /></button>
                    <button className={`workers-view-btn ${viewMode === 'table' ? 'workers-view-btn--active' : ''}`} onClick={() => changeView('table')}><List size={15} /></button>
                </div>
            </div>

            {/* Content */}
            {filtered.length === 0 ? (
                <div className="workers-empty">
                    <MapPin size={48} />
                    <p>No se encontraron proyectos</p>
                    <button className="workers-btn-primary" onClick={openCreate}><Plus size={16} /> Crear el primero</button>
                </div>
            ) : viewMode === 'cards' ? (
                <div className="projects-cards-grid">
                    {filtered.map(p => (
                        <ProjectCard key={p.id} project={p} onEdit={openEdit} onToggle={handleToggle} onCardClick={setDrawerProject} />
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
                                            <button className="pc-icon-btn pc-icon-btn--edit" onClick={() => openEdit(p)}><Edit2 size={13} /></button>
                                            <button className={`pc-icon-btn ${p.status === 'active' ? 'pc-icon-btn--pause' : 'pc-icon-btn--play'}`} onClick={() => handleToggle(p)}>
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

            {/* Drawer */}
            {drawerProject && (
                <ProjectDrawer
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

            {/* Modal */}
            {modalOpen && (
                <div className="workers-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="workers-modal workers-modal--wide" onClick={e => e.stopPropagation()}>
                        <div className="workers-modal__header">
                            <h2>{modalMode === 'create' ? 'Nuevo Proyecto' : 'Editar Proyecto'}</h2>
                            <button className="workers-modal__close" onClick={() => setModalOpen(false)}><X size={18} /></button>
                        </div>
                        <div className="workers-modal__body">
                            {formError && <div className="wf-error">{formError}</div>}

                            {/* Basic data */}
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
                                />
                                <button type="button" className="proj-extract-btn" onClick={parseMapsUrl}>
                                    Extraer
                                </button>
                            </div>
                            {mapsError && <p className="proj-maps-error">{mapsError}</p>}
                            <p className="proj-maps-hint">
                                💡 Abre Google Maps, busca la dirección, haz click derecho → "¿Qué hay aquí?" y copia el enlace que aparece. Pégalo arriba para auto-extraer coordenadas.
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

                            {/* Preview map if coords exist */}
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

                            {/* Lunch rules */}
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

                            {/* Dates + Status */}
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
                        <div className="workers-modal__footer">
                            <button className="workers-btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
                            <button className="workers-btn-primary" onClick={handleSave} disabled={submitting}>
                                {submitting ? 'Guardando...' : (modalMode === 'create' ? 'Crear Proyecto' : 'Guardar Cambios')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
