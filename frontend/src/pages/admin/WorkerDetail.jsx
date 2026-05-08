import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, User, Phone, MapPin, Briefcase, DollarSign,
    Shield, AlertTriangle, FileText, Clock, Key, Play, Pause,
    Edit2, Trash2, Star, RefreshCw, CheckCircle2, AlertCircle,
    X, Copy, ExternalLink, EyeOff, Mail,
    Calendar, FolderKanban, ChevronRight,
    Search, Filter, XCircle, Download, CalendarCheck,
} from 'lucide-react';
import api from '../../utils/api';
import DocumentUploader from '../../components/DocumentUploader';
import './WorkerDetail.css';

// ─── Helpers ────────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('es-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
};

const calcDuration = (start, end) => {
    if (!start) return '—';
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const days = Math.round((e - s) / (1000 * 60 * 60 * 24));
    if (days < 1) return '< 1 día';
    if (days === 1) return '1 día';
    if (days < 30) return `${days} días`;
    const months = Math.floor(days / 30);
    return months === 1 ? '1 mes' : `${months} meses`;
};

// ─── Star Rating ────────────────────────────────────────────────────────────────
const StarRating = ({ value, max = 5, size = 16, onChange }) => {
    const [hover, setHover] = useState(0);
    return (
        <div className="wd-stars" style={{ '--star-size': `${size}px` }}>
            {Array.from({ length: max }, (_, i) => i + 1).map(star => (
                <button
                    key={star}
                    type="button"
                    className={`wd-star ${star <= (hover || value) ? 'wd-star--on' : ''}`}
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

// ─── KPI Card ───────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, color }) => (
    <div className="wd-kpi" style={{ '--wd-kpi-color': color }}>
        <div className="wd-kpi__icon" style={{ background: `${color}18`, color }}>
            <Icon size={20} />
        </div>
        <div>
            <div className="wd-kpi__value">{value}</div>
            <div className="wd-kpi__label">{label}</div>
            {sub && <div className="wd-kpi__sub">{sub}</div>}
        </div>
    </div>
);

// ─── Rating Modal ────────────────────────────────────────────────────────────────
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
        <div className="wd-modal-overlay" onClick={onClose}>
            <div className="wd-modal" onClick={e => e.stopPropagation()}>
                <div className="wd-modal__header">
                    <h3>Calificar — {worker.first_name} {worker.last_name}</h3>
                    <button className="wd-modal__close" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="wd-modal__body">
                    <div className="wd-modal__field">
                        <label>Calificación *</label>
                        <StarRating value={rating} onChange={setRating} size={28} />
                    </div>
                    <div className="wd-modal__field">
                        <label>Proyecto (opcional)</label>
                        <select
                            className="wd-select"
                            value={projectId}
                            onChange={e => setProjectId(e.target.value)}
                        >
                            <option value="">Sin proyecto específico</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="wd-modal__field">
                        <label>Comentario (opcional)</label>
                        <textarea
                            className="wd-textarea"
                            rows={3}
                            placeholder="Describe el desempeño del trabajador..."
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                        />
                    </div>
                    {error && <p className="wd-modal__error">{error}</p>}
                </div>
                <div className="wd-modal__footer">
                    <button className="wd-btn wd-btn--ghost" onClick={onClose}>Cancelar</button>
                    <button className="wd-btn wd-btn--primary" onClick={handleSave} disabled={saving}>
                        {saving ? <RefreshCw size={13} className="wd-spinning" /> : <Star size={13} />}
                        Guardar Rating
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Tab: Info ──────────────────────────────────────────────────────────────────
const TabInfo = ({ worker, trades, onEdit, onToggle, onDeleted, showToast }) => {
    const [activeLocation, setActiveLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const [resetModal, setResetModal] = useState(false);
    const [resetPwd, setResetPwd] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [deleteStep, setDeleteStep] = useState(0);
    const [linkedData, setLinkedData] = useState(null);
    const [confirmCode, setConfirmCode] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (!worker) return;
        setLocationLoading(true);
        api.get(`/time-entries?worker_id=${worker.id}&status=active`)
            .then(res => {
                const entries = res.data?.data || res.data || res;
                if (Array.isArray(entries) && entries.length > 0) {
                    const entry = entries[0];
                    if (entry.project?.latitude && entry.project?.longitude) {
                        setActiveLocation(entry.project);
                    }
                }
            })
            .catch(() => {})
            .finally(() => setLocationLoading(false));
    }, [worker]);

    const handleResetPassword = async () => {
        setResetLoading(true);
        try {
            const res = await api.put(`/workers/${worker.id}/reset-password`, {});
            const data = res.data?.data || res.data;
            setResetPwd(data.temporary_password || '');
            setResetModal(true);
        } catch {
            showToast('Error al resetear contraseña', 'error');
        } finally {
            setResetLoading(false);
        }
    };

    const copyPassword = () => {
        navigator.clipboard.writeText(resetPwd).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const startDelete = async () => {
        try {
            const res = await api.get(`/workers/${worker.id}/linked-data`);
            const data = res.data?.data || res.data || res;
            setLinkedData(data);
        } catch {
            setLinkedData({ assignments: 0, time_entries: 0, invoice_lines: 0, payroll_lines: 0, total: 0, can_hard_delete: true });
        }
        setDeleteStep(1);
    };

    const confirmHardDelete = async () => {
        if (confirmCode !== worker.worker_code) return;
        setDeleteLoading(true);
        try {
            const res = await api.delete(`/workers/${worker.id}/force?confirmed_code=${encodeURIComponent(confirmCode)}`);
            const data = res.data?.data || res.data || res;
            const action = data?.action;
            if (action === 'deleted') showToast(`Perfil de ${worker.first_name} eliminado permanentemente.`, 'success');
            else if (action === 'hidden') showToast(`${worker.first_name} ocultado del sistema.`, 'success');
            else showToast(`Perfil de ${worker.first_name} procesado.`, 'success');
            onDeleted(worker.id);
            navigate('/admin/workers');
        } catch (err) {
            showToast(err.response?.data?.message || err.message || 'Error al eliminar perfil', 'error');
        } finally {
            setDeleteLoading(false);
            setDeleteStep(0);
            setConfirmCode('');
        }
    };

    const tradeName = worker.trade?.name_es || worker.trade?.name || 'Sin oficio';
    const isActive = worker.status === 'active';

    return (
        <div className="wd-tab-info">
            {/* Personal */}
            <div className="wd-section">
                <div className="wd-section__title"><User size={14} /> Información Personal</div>
                <div className="wd-fields">
                    <div className="wd-field"><Mail size={13} /><span className="wd-field__label">Email</span><span>{worker.user?.email || '—'}</span></div>
                    <div className="wd-field"><Phone size={13} /><span className="wd-field__label">Teléfono</span><span>{worker.phone || '—'}</span></div>
                    {worker.address && <div className="wd-field"><MapPin size={13} /><span className="wd-field__label">Dirección</span><span>{worker.address}</span></div>}
                    {worker.preferred_language && <div className="wd-field"><Shield size={13} /><span className="wd-field__label">Idioma</span><span>{worker.preferred_language === 'es' ? 'Español' : 'English'}</span></div>}
                </div>
            </div>

            {/* Work */}
            <div className="wd-section">
                <div className="wd-section__title"><Briefcase size={14} /> Información Laboral</div>
                <div className="wd-fields">
                    <div className="wd-field"><Briefcase size={13} /><span className="wd-field__label">Oficio</span><span>{tradeName}</span></div>
                    <div className="wd-field"><DollarSign size={13} /><span className="wd-field__label">Tarifa</span><span className="wd-rate">${parseFloat(worker.hourly_rate || 0).toFixed(2)}/hr</span></div>
                    <div className="wd-field"><Shield size={13} /><span className="wd-field__label">Código</span><code className="wd-code">{worker.worker_code}</code></div>
                </div>
            </div>

            {/* Emergency */}
            {(worker.emergency_contact_name || worker.emergency_contact_phone) && (
                <div className="wd-section">
                    <div className="wd-section__title"><AlertTriangle size={14} /> Contacto de Emergencia</div>
                    <div className="wd-fields">
                        {worker.emergency_contact_name && <div className="wd-field"><User size={13} /><span className="wd-field__label">Nombre</span><span>{worker.emergency_contact_name}</span></div>}
                        {worker.emergency_contact_phone && <div className="wd-field"><Phone size={13} /><span className="wd-field__label">Teléfono</span><span>{worker.emergency_contact_phone}</span></div>}
                    </div>
                </div>
            )}

            {/* Notes */}
            {worker.notes && (
                <div className="wd-section">
                    <div className="wd-section__title"><FileText size={14} /> Notas</div>
                    <p className="wd-notes">{worker.notes}</p>
                </div>
            )}

            {/* Documents */}
            <div className="wd-section">
                <div className="wd-section__title"><FileText size={14} /> Documentos</div>
                <DocumentUploader ownerType="worker" ownerId={worker.id} />
            </div>

            {/* Active location */}
            <div className="wd-section">
                <div className="wd-section__title"><MapPin size={14} /> Ubicación Actual</div>
                {locationLoading ? (
                    <div className="wd-location-placeholder">
                        <RefreshCw size={16} className="wd-spinning" />
                        <span>Verificando...</span>
                    </div>
                ) : activeLocation ? (
                    <div className="wd-map">
                        <iframe
                            src={`https://maps.google.com/maps?q=${activeLocation.latitude},${activeLocation.longitude}&z=15&output=embed`}
                            width="100%"
                            height="200"
                            style={{ border: 0, borderRadius: 10 }}
                            loading="lazy"
                            title="Ubicación del trabajador"
                        />
                        <p className="wd-map__label">
                            <ExternalLink size={12} /> Proyecto: {activeLocation.name || 'Sin nombre'}
                        </p>
                    </div>
                ) : (
                    <div className="wd-location-placeholder">
                        <Clock size={16} />
                        <span>Sin ubicación activa — no está en horario</span>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="wd-actions">
                <button className="wd-action-btn wd-action-btn--edit" onClick={() => onEdit(worker)}>
                    <Edit2 size={15} /> Editar Perfil
                </button>
                <button className="wd-action-btn wd-action-btn--key" onClick={handleResetPassword} disabled={resetLoading}>
                    <Key size={15} /> {resetLoading ? 'Reseteando...' : 'Resetear Contraseña'}
                </button>
                <button
                    className={`wd-action-btn ${isActive ? 'wd-action-btn--toggle-off' : 'wd-action-btn--toggle-on'}`}
                    onClick={() => onToggle(worker)}
                >
                    {isActive ? <><Pause size={15} /> Desactivar</> : <><Play size={15} /> Reactivar</>}
                </button>
                <button className="wd-action-btn wd-action-btn--delete" onClick={startDelete}>
                    <Trash2 size={15} /> Eliminar Perfil
                </button>
            </div>

            {/* Reset Password Modal */}
            {resetModal && (
                <div className="wd-modal-overlay" style={{ zIndex: 1200 }} onClick={() => setResetModal(false)}>
                    <div className="wd-modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                        <div className="wd-modal__header">
                            <h3>Contraseña Temporal — {worker.first_name}</h3>
                            <button className="wd-modal__close" onClick={() => setResetModal(false)}><X size={16} /></button>
                        </div>
                        <div className="wd-modal__body">
                            <p className="wd-modal__note">Dale esta contraseña temporal a <strong>{worker.first_name}</strong>:</p>
                            <div className="wd-pwd-display">
                                <code className="wd-pwd-code">{resetPwd}</code>
                                <button className="wd-pwd-copy" onClick={copyPassword}>
                                    {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                                    {copied ? 'Copiado' : 'Copiar'}
                                </button>
                            </div>
                            <p className="wd-modal__hint">Al iniciar sesión, el trabajador deberá cambiar su contraseña.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete modal */}
            {deleteStep >= 1 && linkedData && (() => {
                const canHardDelete = linkedData.can_hard_delete ?? (linkedData.total === 0);
                return (
                    <div className="wd-modal-overlay" style={{ zIndex: 1200 }} onClick={() => setDeleteStep(0)}>
                        <div className="wd-confirm-modal" onClick={e => e.stopPropagation()}>
                            <div className="wd-confirm-modal__icon">
                                {canHardDelete ? <Trash2 size={26} /> : <EyeOff size={26} />}
                            </div>
                            {canHardDelete ? (
                                <>
                                    <h3>Eliminar Permanentemente</h3>
                                    <p>Este trabajador no tiene datos vinculados. Puedes eliminarlo de forma permanente.</p>
                                </>
                            ) : (
                                <>
                                    <h3>Ocultar Permanentemente</h3>
                                    <p>Tiene datos vinculados. Se ocultará pero los datos históricos se conservarán.</p>
                                    <div className="wd-linked-data">
                                        {linkedData.assignments > 0 && <span>• {linkedData.assignments} asignación(es)</span>}
                                        {linkedData.time_entries > 0 && <span>• {linkedData.time_entries} registro(s) de horas</span>}
                                        {linkedData.invoice_lines > 0 && <span>• {linkedData.invoice_lines} línea(s) de factura</span>}
                                    </div>
                                </>
                            )}

                            {deleteStep === 1 && (
                                <div className="wd-confirm-modal__actions">
                                    <button className="wd-btn wd-btn--ghost" onClick={() => setDeleteStep(0)}>Cancelar</button>
                                    <button className="wd-btn wd-btn--danger" onClick={() => setDeleteStep(2)}>
                                        {canHardDelete ? 'Continuar' : 'Ocultar Perfil'}
                                    </button>
                                </div>
                            )}

                            {deleteStep === 2 && (
                                <div className="wd-confirm-step2">
                                    <p className="wd-confirm-step2__label">Escribe el código del trabajador para confirmar: <code>{worker.worker_code}</code></p>
                                    <input
                                        className="wd-confirm-input"
                                        value={confirmCode}
                                        onChange={e => setConfirmCode(e.target.value)}
                                        placeholder={worker.worker_code}
                                        autoFocus
                                    />
                                    <div className="wd-confirm-modal__actions">
                                        <button className="wd-btn wd-btn--ghost" onClick={() => { setDeleteStep(0); setConfirmCode(''); }}>Cancelar</button>
                                        <button
                                            className="wd-btn wd-btn--danger"
                                            onClick={confirmHardDelete}
                                            disabled={confirmCode !== worker.worker_code || deleteLoading}
                                        >
                                            {deleteLoading ? <RefreshCw size={13} className="wd-spinning" /> : <Trash2 size={13} />}
                                            Confirmar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

// ─── Tab: Asignaciones ───────────────────────────────────────────────────────────
const STATUS_CFG = {
    active:    { label: 'Activo',     cls: 'wd-badge--active' },
    completed: { label: 'Completado', cls: 'wd-badge--completed' },
    cancelled: { label: 'Cancelado',  cls: 'wd-badge--cancelled' },
};

const TabAsignaciones = ({ workerId }) => {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/assignments?worker_id=${workerId}&limit=200`);
            const raw = res.data?.data || res.data || [];
            setAssignments(Array.isArray(raw) ? raw : []);
        } catch {
            setError('No se pudieron cargar las asignaciones.');
        } finally {
            setLoading(false);
        }
    }, [workerId]);

    useEffect(() => { load(); }, [load]);

    const filtered = assignments.filter(a => {
        const q = search.toLowerCase();
        const matchSearch = !q
            || a.project?.name?.toLowerCase().includes(q)
            || a.project?.address?.toLowerCase().includes(q);
        const matchStatus = !filterStatus || a.status === filterStatus;
        return matchSearch && matchStatus;
    });

    // KPIs
    const totalCount     = assignments.length;
    const activeCount    = assignments.filter(a => a.status === 'active').length;
    const completedCount = assignments.filter(a => a.status === 'completed').length;

    if (loading) return (
        <div className="wd-state">
            <RefreshCw size={22} className="wd-spinning" />
            <span>Cargando asignaciones...</span>
        </div>
    );
    if (error) return (
        <div className="wd-state wd-state--error">
            <AlertCircle size={22} /><span>{error}</span>
        </div>
    );

    return (
        <div className="wd-tab-assignments">
            {/* Mini KPIs */}
            <div className="wd-mini-kpis">
                <div className="wd-mini-kpi" style={{ '--wd-kpi-color': '#2A6C95' }}>
                    <div className="wd-mini-kpi__value">{totalCount}</div>
                    <div className="wd-mini-kpi__label">Total</div>
                </div>
                <div className="wd-mini-kpi" style={{ '--wd-kpi-color': '#10B981' }}>
                    <div className="wd-mini-kpi__value">{activeCount}</div>
                    <div className="wd-mini-kpi__label">Activas</div>
                </div>
                <div className="wd-mini-kpi" style={{ '--wd-kpi-color': '#8B5CF6' }}>
                    <div className="wd-mini-kpi__value">{completedCount}</div>
                    <div className="wd-mini-kpi__label">Completadas</div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="wd-toolbar">
                <div className="wd-search-wrap">
                    <Search size={14} className="wd-search-icon" />
                    <input
                        className="wd-search"
                        placeholder="Buscar proyecto..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && <button className="wd-search-clear" onClick={() => setSearch('')}><X size={13} /></button>}
                </div>
                <select className="wd-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">Todos los estados</option>
                    <option value="active">Activo</option>
                    <option value="completed">Completado</option>
                    <option value="cancelled">Cancelado</option>
                </select>
            </div>

            {/* Table */}
            {filtered.length === 0 ? (
                <div className="wd-empty">
                    <FolderKanban size={32} style={{ opacity: 0.2 }} />
                    <p>{assignments.length === 0 ? 'Sin asignaciones registradas.' : 'Sin resultados para esta búsqueda.'}</p>
                </div>
            ) : (
                <div className="wd-table-wrap">
                    <table className="wd-table">
                        <thead>
                            <tr>
                                <th>Proyecto</th>
                                <th>Inicio</th>
                                <th>Fin</th>
                                <th>Duración</th>
                                <th>Estado</th>
                                <th>Notas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(a => {
                                const cfg = STATUS_CFG[a.status] || STATUS_CFG.cancelled;
                                return (
                                    <tr key={a.id} className="wd-row">
                                        <td>
                                            <div className="wd-project-name">{a.project?.name || '—'}</div>
                                            {a.project?.address && <div className="wd-project-addr">{a.project.address}</div>}
                                        </td>
                                        <td className="wd-date-cell">
                                            <Calendar size={12} />
                                            {fmtDate(a.start_date)}
                                        </td>
                                        <td className="wd-date-cell">
                                            {a.end_date
                                                ? <><Calendar size={12} />{fmtDate(a.end_date)}</>
                                                : <span className="wd-ongoing">En curso</span>
                                            }
                                        </td>
                                        <td className="wd-duration">{calcDuration(a.start_date, a.end_date)}</td>
                                        <td><span className={`wd-badge ${cfg.cls}`}>{cfg.label}</span></td>
                                        <td className="wd-notes-cell">{a.notes || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="wd-table-footer">{filtered.length} de {assignments.length} asignaciones</div>
                </div>
            )}
        </div>
    );
};

// ─── Tab: Rendimiento ────────────────────────────────────────────────────────────
const TabRendimiento = ({ worker, projects }) => {
    const [data, setData]             = useState(null);
    const [loading, setLoading]       = useState(true);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [toast, setToast]           = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/performance/workers/${worker.id}`);
            setData(res.data.data);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [worker.id]);

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
        <div className="wd-state">
            <RefreshCw size={22} className="wd-spinning" />
            <span>Cargando rendimiento...</span>
        </div>
    );
    if (!data) return (
        <div className="wd-state wd-state--error">
            <AlertCircle size={22} /><span>No se pudo cargar el rendimiento.</span>
        </div>
    );

    const { metrics, weekly_hours, project_hours, recent_assignments, ratings } = data;
    const maxWeekHours = Math.max(...weekly_hours.map(w => w.hours), 1);
    const maxProjHours = Math.max(...project_hours.map(p => p.hours), 1);

    return (
        <div className="wd-tab-perf">
            {toast && (
                <div className={`wd-toast ${toast.type === 'error' ? 'wd-toast--error' : ''}`}>
                    {toast.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                    {toast.msg}
                </div>
            )}

            {/* KPIs */}
            <div className="wd-perf-kpis">
                <KpiCard label="Total horas" value={`${metrics.total_hours}h`} icon={Clock} color="#2A6C95" />
                <KpiCard label="Tasa aprobación" value={metrics.approval_rate !== null ? `${metrics.approval_rate}%` : '—'} icon={CheckCircle2} color="#10B981" />
                <KpiCard label="Rating promedio" value={metrics.avg_rating ? `${metrics.avg_rating}★` : '—'} sub={`${metrics.rating_count} calificaciones`} icon={Star} color="#F59E0B" />
                <KpiCard label="Asignaciones" value={`${metrics.assignments_active} activas`} sub={`${metrics.assignments_completed} completadas`} icon={Briefcase} color="#8B5CF6" />
            </div>

            <div className="wd-perf-grid">
                {/* Weekly chart */}
                <div className="wd-perf-card">
                    <h4 className="wd-perf-card__title">Horas por semana</h4>
                    {weekly_hours.length === 0 ? (
                        <p className="wd-muted">Sin datos</p>
                    ) : (
                        <div className="wd-bar-chart">
                            {weekly_hours.map(w => (
                                <div key={w.week} className="wd-bar-col">
                                    <div className="wd-bar-track">
                                        <div
                                            className="wd-bar-fill"
                                            style={{ height: `${(w.hours / maxWeekHours) * 100}%` }}
                                            title={`${w.hours}h`}
                                        />
                                    </div>
                                    <div className="wd-bar-label">{w.hours}h</div>
                                    <div className="wd-bar-week">{w.week.slice(5)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Hours by project */}
                <div className="wd-perf-card">
                    <h4 className="wd-perf-card__title">Horas por proyecto</h4>
                    {project_hours.length === 0 ? (
                        <p className="wd-muted">Sin datos</p>
                    ) : (
                        <div className="wd-proj-list">
                            {project_hours.slice(0, 6).map(p => (
                                <div key={p.name} className="wd-proj-row">
                                    <div className="wd-proj-name" title={p.name}>{p.name}</div>
                                    <div className="wd-proj-bar-wrap">
                                        <div
                                            className="wd-proj-bar"
                                            style={{ width: `${(p.hours / maxProjHours) * 100}%` }}
                                        />
                                    </div>
                                    <div className="wd-proj-hours">{p.hours}h</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent assignments */}
                <div className="wd-perf-card">
                    <h4 className="wd-perf-card__title">Asignaciones recientes</h4>
                    {recent_assignments.length === 0 ? (
                        <p className="wd-muted">Sin asignaciones</p>
                    ) : (
                        <div className="wd-asn-list">
                            {recent_assignments.map(a => (
                                <div key={a.id} className="wd-asn-row">
                                    <div>
                                        <div className="wd-asn-project">{a.project}</div>
                                        <div className="wd-asn-dates">{a.start_date} → {a.end_date || 'En curso'}</div>
                                    </div>
                                    <span className={`wd-badge wd-badge--${a.status}`}>
                                        {a.status === 'active' ? 'Activo' : a.status === 'completed' ? 'Completado' : 'Cancelado'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Ratings */}
                <div className="wd-perf-card">
                    <div className="wd-perf-card__title-row">
                        <h4 className="wd-perf-card__title">Calificaciones</h4>
                        <button className="wd-btn wd-btn--ghost wd-btn--sm" onClick={() => setShowRatingModal(true)}>
                            <Star size={12} /> Agregar
                        </button>
                    </div>
                    {ratings.length === 0 ? (
                        <p className="wd-muted">Sin calificaciones aún.</p>
                    ) : (
                        <div className="wd-ratings-list">
                            {ratings.map(r => (
                                <div key={r.id} className="wd-rating-item">
                                    <div className="wd-rating-item__top">
                                        <StarRating value={parseFloat(r.rating)} size={14} />
                                        <span className="wd-rating-item__by">{r.rated_by}</span>
                                        <button
                                            className="wd-rating-item__del"
                                            onClick={() => deleteRating(r.id)}
                                            disabled={deletingId === r.id}
                                            title="Eliminar"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                    {r.comment && <p className="wd-rating-item__comment">{r.comment}</p>}
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
                    onSaved={() => load()}
                />
            )}
        </div>
    );
};

// ─── Tab: Disponibilidad ─────────────────────────────────────────────────────────
const DAY_NAMES      = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const AvToggle = ({ on, onChange }) => (
    <label className="wd-avail-toggle" onClick={() => onChange(!on)}>
        <div className={`wd-avail-toggle__track${on ? ' wd-avail-toggle__track--on' : ''}`}>
            <div className="wd-avail-toggle__thumb" />
        </div>
    </label>
);

const TabDisponibilidad = ({ workerId }) => {
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [editing, setEditing]   = useState(false);
    const [draft, setDraft]       = useState([]);
    const [saving, setSaving]     = useState(false);
    const [toast, setToast]       = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get(`/availability/${workerId}`);
            // Backend returns { data: { worker_id, schedule: [...] } } for admin/:worker_id
            const payload = res.data?.data;
            const raw = Array.isArray(payload) ? payload
                      : Array.isArray(payload?.schedule) ? payload.schedule
                      : [];
            // buildFullWeek already returns 7 days — but normalize just in case
            const days = Array.from({ length: 7 }, (_, i) => {
                const found = raw.find(d => d.day_of_week === i);
                return found ?? { day_of_week: i, is_available: false, start_time: '08:00', end_time: '17:00', note: '' };
            });
            setSchedule(days);
        } catch {
            showToast('Error al cargar disponibilidad.', 'error');
        } finally {
            setLoading(false);
        }
    }, [workerId]);

    useEffect(() => { load(); }, [load]);

    const startEdit = () => {
        setDraft(schedule.map(d => ({ ...d })));
        setEditing(true);
    };

    const handleField = (idx, field, value) => {
        setDraft(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = draft.map(({ day_of_week, is_available, start_time, end_time, note }) => ({
                day_of_week, is_available, start_time, end_time, note: note || null,
            }));
            const res = await api.put(`/availability/${workerId}`, { schedule: payload });
            // PUT returns the fresh array directly in res.data.data
            const updated = res.data?.data ?? [];
            const arr = Array.isArray(updated) ? updated : [];
            const days = Array.from({ length: 7 }, (_, i) => {
                const found = arr.find(d => d.day_of_week === i);
                return found ?? { day_of_week: i, is_available: false, start_time: '08:00', end_time: '17:00', note: '' };
            });
            setSchedule(days);
            setEditing(false);
            showToast('Disponibilidad guardada.');
        } catch {
            showToast('Error al guardar.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="wd-state">
            <RefreshCw size={22} className="wd-spinning" />
            <span>Cargando disponibilidad...</span>
        </div>
    );

    const availDays = schedule.filter(d => d.is_available).length;
    const statusLabel = availDays === 0 ? 'No disponible' : availDays < 5 ? 'Disponibilidad limitada' : 'Disponible';
    const statusColor = availDays === 0 ? '#EF4444' : availDays < 5 ? '#F59E0B' : '#10B981';

    return (
        <div className="wd-tab-avail">
            {toast && (
                <div className={`wd-toast ${toast.type === 'error' ? 'wd-toast--error' : ''}`}>
                    {toast.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                    {toast.msg}
                </div>
            )}

            {/* Summary card */}
            <div className="wd-avail-summary">
                <div className="wd-avail-summary__left">
                    <CalendarCheck size={18} style={{ color: statusColor }} />
                    <div>
                        <div className="wd-avail-summary__status" style={{ color: statusColor }}>{statusLabel}</div>
                        <div className="wd-avail-summary__days">{availDays} de 7 días disponibles</div>
                    </div>
                </div>
                {!editing && (
                    <button className="wd-btn wd-btn--primary wd-btn--sm" onClick={startEdit}>
                        <Edit2 size={13} /> Editar horario
                    </button>
                )}
            </div>

            {/* Schedule — view or edit */}
            <div className="wd-avail-card">
                {!editing ? (
                    /* View mode */
                    <div className="wd-avail-schedule">
                        {schedule.map(day => (
                            <div key={day.day_of_week} className={`wd-avail-row ${day.is_available ? 'wd-avail-row--on' : 'wd-avail-row--off'}`}>
                                <div className={`wd-avail-dot ${day.is_available ? 'wd-avail-dot--on' : 'wd-avail-dot--off'}`} />
                                <span className="wd-avail-dayname">{DAY_NAMES_FULL[day.day_of_week]}</span>
                                {day.is_available ? (
                                    <span className="wd-avail-hours">{day.start_time} – {day.end_time}</span>
                                ) : (
                                    <span className="wd-avail-hours wd-avail-hours--off">No disponible</span>
                                )}
                                {day.is_available && day.note && (
                                    <span className="wd-avail-note">{day.note}</span>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    /* Edit mode */
                    <div className="wd-avail-edit">
                        {draft.map((day, idx) => (
                            <div key={day.day_of_week} className={`wd-avail-edit-row ${!day.is_available ? 'wd-avail-edit-row--off' : ''}`}>
                                <div className="wd-avail-edit-row__header">
                                    <span className="wd-avail-edit-row__dayname">{DAY_NAMES_FULL[day.day_of_week]}</span>
                                    <AvToggle on={day.is_available} onChange={v => handleField(idx, 'is_available', v)} />
                                </div>
                                {day.is_available && (
                                    <div className="wd-avail-edit-row__times">
                                        <span className="wd-avail-edit-row__timelbl">Horario</span>
                                        <input
                                            type="time"
                                            className="wd-avail-time-input"
                                            value={day.start_time}
                                            onChange={e => handleField(idx, 'start_time', e.target.value)}
                                        />
                                        <span className="wd-avail-sep">–</span>
                                        <input
                                            type="time"
                                            className="wd-avail-time-input"
                                            value={day.end_time}
                                            onChange={e => handleField(idx, 'end_time', e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            className="wd-avail-note-input"
                                            placeholder="Nota (opcional)"
                                            value={day.note || ''}
                                            onChange={e => handleField(idx, 'note', e.target.value)}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                        <div className="wd-avail-edit-actions">
                            <button className="wd-btn wd-btn--ghost" onClick={() => setEditing(false)} disabled={saving}>
                                Cancelar
                            </button>
                            <button className="wd-btn wd-btn--primary" onClick={handleSave} disabled={saving}>
                                {saving ? <RefreshCw size={13} className="wd-spinning" /> : <CheckCircle2 size={13} />}
                                Guardar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main WorkerDetail Page ──────────────────────────────────────────────────────
const TABS = [
    { id: 'info',           label: 'Información' },
    { id: 'disponibilidad', label: 'Disponibilidad' },
    { id: 'asignaciones',   label: 'Asignaciones' },
    { id: 'rendimiento',    label: 'Rendimiento' },
];

const WorkerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [worker, setWorker]   = useState(null);
    const [trades, setTrades]   = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);
    const [activeTab, setActiveTab] = useState('info');
    const [toast, setToast]     = useState(null);

    // Edit modal (basic — triggers worker list edit form)
    const [editMode, setEditMode] = useState(false);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [wRes, tRes, pRes] = await Promise.all([
                api.get(`/workers/${id}`),
                api.get('/trades'),
                api.get('/projects'),
            ]);
            setWorker(wRes.data?.data || wRes.data);
            setTrades(tRes.data?.data || tRes.data || []);
            setProjects(pRes.data?.data || pRes.data || []);
        } catch {
            setError('No se pudo cargar el perfil del trabajador.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    const handleToggle = async (w) => {
        try {
            await api.put(`/workers/${w.id}`, { status: w.status === 'active' ? 'inactive' : 'active' });
            showToast(`Trabajador ${w.status === 'active' ? 'desactivado' : 'reactivado'}.`);
            load();
        } catch {
            showToast('Error al cambiar estado.', 'error');
        }
    };

    const handleDeleted = () => {
        navigate('/admin/workers');
    };

    if (loading) return (
        <div className="wd-page-loading">
            <RefreshCw size={28} className="wd-spinning" />
            <p>Cargando perfil...</p>
        </div>
    );

    if (error || !worker) return (
        <div className="wd-page-error">
            <AlertCircle size={28} />
            <p>{error || 'Trabajador no encontrado.'}</p>
            <button className="wd-btn wd-btn--ghost" onClick={() => navigate('/admin/workers')}>
                <ArrowLeft size={14} /> Volver a Trabajadores
            </button>
        </div>
    );

    const isActive = worker.status === 'active';
    const tradeName = worker.trade?.name_es || worker.trade?.name || 'Sin oficio';
    const initials = `${worker.first_name?.[0] || ''}${worker.last_name?.[0] || ''}`;

    return (
        <div className="wd-page">
            {/* Toast */}
            {toast && (
                <div className={`wd-toast ${toast.type === 'error' ? 'wd-toast--error' : ''}`}>
                    {toast.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                    {toast.msg}
                </div>
            )}

            {/* Back nav */}
            <div className="wd-breadcrumb">
                <button className="wd-back-btn" onClick={() => navigate('/admin/workers')}>
                    <ArrowLeft size={16} /> Trabajadores
                </button>
                <span className="wd-breadcrumb__sep">/</span>
                <span className="wd-breadcrumb__current">{worker.first_name} {worker.last_name}</span>
            </div>

            {/* Hero header */}
            <div className="wd-hero">
                <div className={`wd-hero__avatar ${!isActive ? 'wd-hero__avatar--grey' : ''}`}>
                    {initials}
                </div>
                <div className="wd-hero__info">
                    <h1 className="wd-hero__name">{worker.first_name} {worker.last_name}</h1>
                    <div className="wd-hero__meta">
                        <code className="wd-code">{worker.worker_code}</code>
                        <span className="wd-hero__trade">
                            <Briefcase size={12} /> {tradeName}
                        </span>
                        <span className="wd-hero__rate">
                            <DollarSign size={12} /> ${parseFloat(worker.hourly_rate || 0).toFixed(2)}/hr
                        </span>
                    </div>
                    <div className="wd-hero__badges">
                        <span className={`wd-badge wd-badge--status-${worker.status}`}>
                            {isActive ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className={`wd-badge wd-badge--avail-${worker.availability}`}>
                            {worker.availability === 'available' ? 'Disponible'
                                : worker.availability === 'assigned' ? 'Asignado' : 'No disponible'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="wd-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`wd-tab ${activeTab === tab.id ? 'wd-tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="wd-tab-content">
                {activeTab === 'disponibilidad' && (
                    <TabDisponibilidad workerId={id} />
                )}
                {activeTab === 'info' && (
                    <TabInfo
                        worker={worker}
                        trades={trades}
                        onEdit={() => navigate('/admin/workers')}
                        onToggle={handleToggle}
                        onDeleted={handleDeleted}
                        showToast={showToast}
                    />
                )}
                {activeTab === 'asignaciones' && (
                    <TabAsignaciones workerId={id} />
                )}
                {activeTab === 'rendimiento' && (
                    <TabRendimiento worker={worker} projects={projects} />
                )}
            </div>
        </div>
    );
};

export default WorkerDetail;
