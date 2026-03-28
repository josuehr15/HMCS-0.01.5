import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Search, Plus, Edit2, UserX, UserCheck, X, ChevronDown,
    Phone, MapPin, Briefcase, DollarSign, User, AlertTriangle,
    Users, CheckCircle, Clock, Shield, LayoutGrid, List,
    Settings, Wrench, Pencil, Trash2, Save, Key, Mail,
    FileText, Play, Pause, Copy, ExternalLink, LogIn, EyeOff
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import './Workers.css';

// ─── Constants ─────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
    first_name: '', last_name: '', email: '', password: '',
    phone: '', address: '', trade_id: '', hourly_rate: '',
    status: 'active', availability: 'available',
    emergency_contact_name: '', emergency_contact_phone: '', notes: '',
    preferred_language: 'es',
};

const STATUS_CONFIG = {
    active: { label: 'Activo', className: 'badge--active' },
    inactive: { label: 'Inactivo', className: 'badge--inactive' },
};
const AVAILABILITY_CONFIG = {
    available: { label: 'Disponible', className: 'badge--available' },
    assigned: { label: 'Asignado', className: 'badge--assigned' },
    unavailable: { label: 'No disponible', className: 'badge--unavailable' },
};

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
    return <span className={`workers-badge ${cfg.className}`}>{cfg.label}</span>;
}
function AvailabilityBadge({ availability }) {
    const cfg = AVAILABILITY_CONFIG[availability] || AVAILABILITY_CONFIG.unavailable;
    return <span className={`workers-badge ${cfg.className}`}>{cfg.label}</span>;
}
function FormField({ label, required, children, hint }) {
    return (
        <div className="wf-field">
            <label className="wf-label">{label}{required && <span className="wf-required"> *</span>}</label>
            {children}
            {hint && <p className="wf-hint">{hint}</p>}
        </div>
    );
}

// ─── Worker Card ───────────────────────────────────────────────────────────────
function WorkerCard({ worker, onEdit, onToggle, onCardClick, getStats }) {
    const isActive = worker.status === 'active';
    const [stats, setStats] = useState(null);

    // Lazy-load stats once card mounts
    useEffect(() => {
        if (!getStats) return;
        getStats(worker.id).then(s => setStats(s)).catch(() => { });
    }, [worker.id, getStats]);

    const hoursPercent = stats
        ? Math.min(100, (stats.total_hours_this_month / 160) * 100) // 160h = full month
        : 0;

    return (
        <div
            className={`worker-card ${!isActive ? 'worker-card--inactive' : ''}`}
            onClick={() => onCardClick(worker)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && onCardClick(worker)}
            style={{ cursor: 'pointer' }}
        >
            {/* Top row: avatar + name + action buttons */}
            <div className="worker-card__top">
                <div className={`workers-avatar workers-avatar--lg ${!isActive ? 'workers-avatar--grey' : ''}`}>
                    {worker.first_name?.[0]}{worker.last_name?.[0]}
                </div>
                <div className="worker-card__identity">
                    <p className="worker-card__name">{worker.first_name} {worker.last_name}</p>
                    <code className="workers-code">{worker.worker_code}</code>
                </div>
                {/* Action buttons — top right, icon-only */}
                <div className="worker-card__actions" onClick={e => e.stopPropagation()}>
                    <button
                        className="wc-icon-btn wc-icon-btn--edit"
                        onClick={e => { e.stopPropagation(); onEdit(worker); }}
                        title="Editar"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        className={`wc-icon-btn ${isActive ? 'wc-icon-btn--pause' : 'wc-icon-btn--play'}`}
                        onClick={e => { e.stopPropagation(); onToggle(worker); }}
                        title={isActive ? 'Desactivar' : 'Reactivar'}
                    >
                        {isActive ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                </div>
            </div>

            {/* Info rows */}
            <div className="worker-card__body">
                <div className="worker-card__row">
                    <Wrench size={12} className="worker-card__ico" />
                    <span>{worker.trade?.name_es || worker.trade?.name || '—'}</span>
                </div>
                <div className="worker-card__row">
                    <DollarSign size={12} className="worker-card__ico" />
                    <span className="worker-card__rate">${parseFloat(worker.hourly_rate || 0).toFixed(2)}/hr</span>
                </div>
                {worker.phone && (
                    <div className="worker-card__row">
                        <Phone size={12} className="worker-card__ico" />
                        <span>{worker.phone}</span>
                    </div>
                )}
            </div>

            {/* Badges */}
            <div className="worker-card__badges">
                <StatusBadge status={worker.status} />
                <AvailabilityBadge availability={worker.availability} />
            </div>

            {/* Stats bar */}
            <div className="worker-card__stats">
                <div className="worker-card__stat-bar">
                    <div
                        className="worker-card__stat-fill"
                        style={{ width: `${hoursPercent}%` }}
                    />
                </div>
                <div className="worker-card__stat-text">
                    <span>{stats ? `${stats.total_hours_this_month}h este mes` : '—'}</span>
                    <span>{stats ? `$${stats.total_earned_this_month.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</span>
                </div>
            </div>
        </div>
    );
}


// ─── Worker Drawer ─────────────────────────────────────────────────────────────
function WorkerDrawer({ worker, trades, onClose, onEdit, onDeleted, onToggle, api, showToast }) {
    const { put, del, get } = api;
    const [activeLocation, setActiveLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(true);

    // Reset password modal
    const [resetModal, setResetModal] = useState(false);
    const [resetPwd, setResetPwd] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Delete flow
    const [deleteStep, setDeleteStep] = useState(0); // 0=none, 1=warning, 2=confirm
    const [linkedData, setLinkedData] = useState(null);
    const [confirmCode, setConfirmCode] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Escape key to close
    useEffect(() => {
        const handler = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Fetch active location (time entry)
    useEffect(() => {
        if (!worker) return;
        setLocationLoading(true);
        get(`/time-entries?worker_id=${worker.id}&status=active`)
            .then(res => {
                const entries = res.data || res;
                if (Array.isArray(entries) && entries.length > 0) {
                    const entry = entries[0];
                    if (entry.project?.latitude && entry.project?.longitude) {
                        setActiveLocation(entry.project);
                    }
                }
            })
            .catch(() => { })
            .finally(() => setLocationLoading(false));
    }, [worker, get]);

    // Reset password
    const handleResetPassword = async () => {
        setResetLoading(true);
        try {
            const res = await put(`/workers/${worker.id}/reset-password`, {});
            const data = res.data || res;
            setResetPwd(data.temporary_password || data.data?.temporary_password || '');
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

    // Delete flow
    const startDelete = async () => {
        try {
            const res = await get(`/workers/${worker.id}/linked-data`);
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
            const res = await del(`/workers/${worker.id}/force?confirmed_code=${encodeURIComponent(confirmCode)}`);
            const data = res.data?.data || res.data || res;
            const action = data?.action;

            if (action === 'deleted') {
                showToast(`Perfil de ${worker.first_name} eliminado permanentemente. Email liberado.`, 'success');
            } else if (action === 'hidden') {
                showToast(`${worker.first_name} ocultado del sistema. Los datos históricos se conservan.`, 'success');
            } else {
                showToast(`Perfil de ${worker.first_name} procesado.`, 'success');
            }
            onDeleted(worker.id);
            onClose();
        } catch (err) {
            showToast(err.response?.data?.message || err.message || 'Error al eliminar perfil', 'error');
        } finally {
            setDeleteLoading(false);
            setDeleteStep(0);
            setConfirmCode('');
        }
    };

    if (!worker) return null;

    const tradeName = worker.trade?.name_es || worker.trade?.name || 'Sin oficio';
    const isActive = worker.status === 'active';

    return (
        <>
            {/* Overlay */}
            <div className="drawer-overlay" onClick={onClose} />

            {/* Drawer panel */}
            <aside className="worker-drawer" role="dialog" aria-label="Perfil del trabajador">
                {/* Close */}
                <button className="drawer-close" onClick={onClose} title="Cerrar"><X size={20} /></button>

                {/* Hero */}
                <div className="drawer-hero">
                    <div className={`workers-avatar workers-avatar--xl ${!isActive ? 'workers-avatar--grey' : ''}`}>
                        {worker.first_name?.[0]}{worker.last_name?.[0]}
                    </div>
                    <div className="drawer-hero__info">
                        <h2 className="drawer-hero__name">{worker.first_name} {worker.last_name}</h2>
                        <code className="workers-code">{worker.worker_code}</code>
                        <div className="drawer-hero__badges">
                            <StatusBadge status={worker.status} />
                            <AvailabilityBadge availability={worker.availability} />
                        </div>
                    </div>
                </div>

                <div className="drawer-body">
                    {/* Personal info */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><User size={13} /> Información Personal</p>
                        <div className="drawer-field"><Mail size={13} /><span className="drawer-field__label">Email:</span><span>{worker.user?.email || '—'}</span></div>
                        <div className="drawer-field"><Phone size={13} /><span className="drawer-field__label">Teléfono:</span><span>{worker.phone || '—'}</span></div>
                        {worker.address && (
                            <div className="drawer-field"><MapPin size={13} /><span className="drawer-field__label">Dirección:</span><span>{worker.address}</span></div>
                        )}
                    </div>

                    {/* Work info */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><Briefcase size={13} /> Información Laboral</p>
                        <div className="drawer-field"><Wrench size={13} /><span className="drawer-field__label">Oficio:</span><span>{tradeName}</span></div>
                        <div className="drawer-field"><DollarSign size={13} /><span className="drawer-field__label">Tarifa:</span><span className="drawer-field__rate">${parseFloat(worker.hourly_rate || 0).toFixed(2)}/hr</span></div>
                        <div className="drawer-field"><Shield size={13} /><span className="drawer-field__label">Código:</span><code className="workers-code">{worker.worker_code}</code></div>
                    </div>

                    {/* Emergency contact */}
                    {(worker.emergency_contact_name || worker.emergency_contact_phone) && (
                        <div className="drawer-section">
                            <p className="drawer-section__title"><AlertTriangle size={13} /> Contacto de Emergencia</p>
                            {worker.emergency_contact_name && (
                                <div className="drawer-field"><User size={13} /><span className="drawer-field__label">Nombre:</span><span>{worker.emergency_contact_name}</span></div>
                            )}
                            {worker.emergency_contact_phone && (
                                <div className="drawer-field"><Phone size={13} /><span className="drawer-field__label">Teléfono:</span><span>{worker.emergency_contact_phone}</span></div>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    {worker.notes && (
                        <div className="drawer-section">
                            <p className="drawer-section__title"><FileText size={13} /> Notas</p>
                            <p className="drawer-notes">{worker.notes}</p>
                        </div>
                    )}

                    {/* Active location */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><MapPin size={13} /> Ubicación Actual</p>
                        {locationLoading ? (
                            <div className="drawer-location-placeholder">
                                <div className="workers-spinner" style={{ width: 20, height: 20 }} />
                                <span>Verificando...</span>
                            </div>
                        ) : activeLocation ? (
                            <div className="drawer-map">
                                <iframe
                                    src={`https://maps.google.com/maps?q=${activeLocation.latitude},${activeLocation.longitude}&z=15&output=embed`}
                                    width="100%"
                                    height="180"
                                    style={{ border: 0, borderRadius: 8 }}
                                    loading="lazy"
                                    title="Ubicación del trabajador"
                                />
                                <p className="drawer-map__label">
                                    <ExternalLink size={12} /> Proyecto: {activeLocation.name || 'Sin nombre'}
                                </p>
                            </div>
                        ) : (
                            <div className="drawer-location-placeholder">
                                <Clock size={16} />
                                <span>Sin ubicación activa — no está en horario</span>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="drawer-actions">
                        <button className="drawer-action-btn drawer-action-btn--edit" onClick={() => { onClose(); onEdit(worker); }}>
                            <Edit2 size={15} /> Editar Perfil
                        </button>
                        <button className="drawer-action-btn drawer-action-btn--key" onClick={handleResetPassword} disabled={resetLoading}>
                            <Key size={15} /> {resetLoading ? 'Reseteando...' : 'Resetear Contraseña'}
                        </button>
                        <button
                            className={`drawer-action-btn ${isActive ? 'drawer-action-btn--toggle-off' : 'drawer-action-btn--toggle-on'}`}
                            onClick={() => onToggle(worker)}
                        >
                            {isActive ? <><Pause size={15} /> Desactivar</> : <><Play size={15} /> Reactivar</>}
                        </button>
                        <button className="drawer-action-btn drawer-action-btn--delete" onClick={startDelete}>
                            <Trash2 size={15} /> Eliminar Perfil
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Reset Password Modal ── */}
            {resetModal && (
                <div className="workers-modal-overlay" style={{ zIndex: 1200 }} onClick={() => setResetModal(false)}>
                    <div className="workers-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="workers-modal__header">
                            <h2 className="workers-modal__title"><Key size={16} /> Contraseña Temporal</h2>
                            <button className="workers-modal__close" onClick={() => setResetModal(false)}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '24px 26px 28px' }}>
                            <p style={{ fontSize: 14, color: '#374151', marginBottom: 16 }}>
                                Dale esta contraseña temporal a <strong>{worker.first_name}</strong>:
                            </p>
                            <div className="reset-pwd-display">
                                <code className="reset-pwd-code">{resetPwd}</code>
                                <button className="reset-pwd-copy" onClick={copyPassword} title="Copiar">
                                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                                    {copied ? 'Copiado' : 'Copiar'}
                                </button>
                            </div>
                            <p className="reset-pwd-note">
                                Al iniciar sesión, el trabajador deberá cambiar su contraseña.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Step 1: Warning + linked data — differentiated by level ── */}
            {deleteStep === 1 && linkedData && (() => {
                const canHardDelete = linkedData.can_hard_delete ?? (linkedData.total === 0);
                const total = linkedData.total ?? (linkedData.assignments + linkedData.time_entries);
                return (
                    <div className="workers-modal-overlay" style={{ zIndex: 1200 }} onClick={() => setDeleteStep(0)}>
                        <div className="workers-confirm-modal" onClick={e => e.stopPropagation()}>
                            <div className="workers-confirm-modal__icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                                {canHardDelete ? <Trash2 size={28} /> : <EyeOff size={28} />}
                            </div>

                            {canHardDelete ? (
                                /* LEVEL 2: no linked data → hard delete */
                                <>
                                    <h3>Eliminar Perfil Permanentemente</h3>
                                    <p>Este trabajador <strong>no tiene datos vinculados</strong>. Puedes eliminarlo de forma permanente.</p>
                                    <div className="delete-linked-data" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                        <p className="delete-linked-data__title" style={{ color: '#065F46' }}>✓ Sin datos vinculados</p>
                                        <ul><li style={{ color: '#047857' }}>• Asignaciones: 0 &nbsp;• Horas: 0 &nbsp;• Facturas: 0</li></ul>
                                        <p className="delete-linked-data__warning">
                                            El registro del trabajador y su usuario se borrarán de la base de datos. El email quedará libre para reutilizar.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                /* LEVEL 3: has linked data → permanent hide */
                                <>
                                    <h3>Ocultar Perfil Permanentemente</h3>
                                    <p>Este trabajador <strong>tiene datos vinculados</strong>. No se puede borrar para proteger la contabilidad.</p>
                                    <div className="delete-linked-data">
                                        <p className="delete-linked-data__title">Datos vinculados (se conservarán):</p>
                                        <ul>
                                            {linkedData.assignments > 0 && <li>• {linkedData.assignments} asignación(es)</li>}
                                            {linkedData.time_entries > 0 && <li>• {linkedData.time_entries} registro(s) de horas</li>}
                                            {linkedData.invoice_lines > 0 && <li>• {linkedData.invoice_lines} línea(s) de factura</li>}
                                            {linkedData.payroll_lines > 0 && <li>• {linkedData.payroll_lines} línea(s) de nómina</li>}
                                        </ul>
                                        <p className="delete-linked-data__warning">
                                            El perfil quedará oculto permanentemente. No aparecerá en ninguna vista, pero los datos históricos se conservan.
                                        </p>
                                    </div>
                                </>
                            )}

                            <div className="workers-confirm-modal__actions">
                                <button className="workers-btn-outline" onClick={() => setDeleteStep(0)}>Cancelar</button>
                                <button className="workers-btn-danger" onClick={() => setDeleteStep(2)}>
                                    Sí, continuar →
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Delete Step 2: Type worker_code to confirm ── */}
            {deleteStep === 2 && (() => {
                const canHardDelete = linkedData?.can_hard_delete ?? (linkedData?.total === 0);
                return (
                    <div className="workers-modal-overlay" style={{ zIndex: 1200 }} onClick={() => { setDeleteStep(0); setConfirmCode(''); }}>
                        <div className="workers-confirm-modal" onClick={e => e.stopPropagation()}>
                            <div className="workers-confirm-modal__icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                                <Shield size={28} />
                            </div>
                            <h3>Confirmación Final</h3>
                            <p>
                                {canHardDelete
                                    ? 'Para eliminar permanentemente, escribe el código del trabajador:'
                                    : 'Para ocultar permanentemente, escribe el código del trabajador:'}
                            </p>
                            <div className="delete-code-confirm">
                                <code className="delete-code-target">{worker.worker_code}</code>
                                <input
                                    className="delete-code-input wf-input"
                                    value={confirmCode}
                                    onChange={e => setConfirmCode(e.target.value.toUpperCase())}
                                    placeholder="Escribe el código aquí"
                                    autoFocus
                                />
                            </div>
                            <div className="workers-confirm-modal__actions">
                                <button className="workers-btn-outline" onClick={() => { setDeleteStep(0); setConfirmCode(''); }}>Cancelar</button>
                                <button
                                    className="workers-btn-danger"
                                    onClick={confirmHardDelete}
                                    disabled={confirmCode !== worker.worker_code || deleteLoading}
                                >
                                    {canHardDelete
                                        ? <><Trash2 size={15} /> {deleteLoading ? 'Eliminando...' : 'Eliminar Definitivamente'}</>
                                        : <><EyeOff size={15} /> {deleteLoading ? 'Ocultando...' : 'Ocultar Permanentemente'}</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
}

// ─── Trades Modal ──────────────────────────────────────────────────────────────
function TradesModal({ trades, onClose, onRefresh, api }) {
    const { post, put, del } = api;
    const [newTrade, setNewTrade] = useState({ name: '', name_es: '' });
    const [editingTrade, setEditingTrade] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!newTrade.name.trim() || !newTrade.name_es.trim()) { setError('Ambos campos son requeridos.'); return; }
        setSaving(true); setError('');
        try {
            await post('/trades', newTrade);
            setNewTrade({ name: '', name_es: '' });
            onRefresh();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al crear oficio.');
        } finally { setSaving(false); }
    };

    const handleUpdate = async () => {
        if (!editingTrade.name.trim() || !editingTrade.name_es.trim()) { setError('Ambos campos son requeridos.'); return; }
        setSaving(true); setError('');
        try {
            await put(`/trades/${editingTrade.id}`, { name: editingTrade.name, name_es: editingTrade.name_es });
            setEditingTrade(null);
            onRefresh();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al actualizar oficio.');
        } finally { setSaving(false); }
    };

    const handleDeactivate = async (trade) => {
        if (!window.confirm(`¿Desactivar el oficio "${trade.name_es}"?`)) return;
        try { await del(`/trades/${trade.id}`); onRefresh(); }
        catch { setError('Error al desactivar oficio.'); }
    };

    return (
        <div className="workers-modal-overlay" onClick={onClose}>
            <div className="workers-modal trades-modal" onClick={e => e.stopPropagation()}>
                <div className="workers-modal__header">
                    <h2 className="workers-modal__title"><Wrench size={16} /> Gestionar Oficios</h2>
                    <button className="workers-modal__close" onClick={onClose}><X size={20} /></button>
                </div>
                <div className="trades-modal__body">
                    {error && <div className="workers-form__error"><AlertTriangle size={14} /><span>{error}</span></div>}
                    <p className="trades-modal__section-label">Agregar nuevo oficio</p>
                    <div className="trades-modal__add-row">
                        <input className="wf-input" placeholder="Inglés (ej: Plumbing)" value={newTrade.name} onChange={e => setNewTrade(p => ({ ...p, name: e.target.value }))} />
                        <input className="wf-input" placeholder="Español (ej: Plomería)" value={newTrade.name_es} onChange={e => setNewTrade(p => ({ ...p, name_es: e.target.value }))} />
                        <button className="workers-btn-primary" onClick={handleCreate} disabled={saving}><Plus size={14} /> Agregar</button>
                    </div>
                    <p className="trades-modal__section-label" style={{ marginTop: 20 }}>Oficios actuales ({trades.length})</p>
                    <div className="trades-modal__list">
                        {trades.length === 0 ? (
                            <p className="trades-modal__empty">No hay oficios registrados.</p>
                        ) : trades.map(trade => (
                            <div key={trade.id} className="trades-modal__item">
                                {editingTrade?.id === trade.id ? (
                                    <div className="trades-modal__edit-row">
                                        <input className="wf-input" value={editingTrade.name} onChange={e => setEditingTrade(p => ({ ...p, name: e.target.value }))} placeholder="Inglés" />
                                        <input className="wf-input" value={editingTrade.name_es} onChange={e => setEditingTrade(p => ({ ...p, name_es: e.target.value }))} placeholder="Español" />
                                        <button className="workers-btn-primary" onClick={handleUpdate} disabled={saving}><Save size={13} /></button>
                                        <button className="workers-btn-outline" onClick={() => setEditingTrade(null)}><X size={13} /></button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="trades-modal__item-info">
                                            <span className="trades-modal__item-es">{trade.name_es}</span>
                                            <span className="trades-modal__item-en">{trade.name}</span>
                                        </div>
                                        <div className="trades-modal__item-actions">
                                            <button className="workers-action-btn workers-action-btn--edit" onClick={() => setEditingTrade({ ...trade })} title="Editar"><Pencil size={13} /></button>
                                            <button className="workers-action-btn workers-action-btn--deactivate" onClick={() => handleDeactivate(trade)} title="Desactivar"><Trash2 size={13} /></button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function Workers() {
    const apiHook = useApi();
    const { get, post, put, patch, del } = apiHook;

    // Stable callback for per-card stats fetch
    const getStats = useCallback(async (workerId) => {
        const res = await get(`/workers/${workerId}/stats`);
        return res.data || res;
    }, [get]);

    const [workers, setWorkers] = useState([]);
    const [trades, setTrades] = useState([]);
    const [filteredWorkers, setFiltered] = useState([]);
    const [isLoading, setIsLoading] = useState(true); // local loading flag
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('workers_view') || 'cards');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [drawerWorker, setDrawerWorker] = useState(null);
    const [toggleModal, setToggleModal] = useState(null);
    const [tradesModal, setTradesModal] = useState(false);
    const [toastMsg, setToastMsg] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTrade, setFilterTrade] = useState('');
    const [filterStatus, setFilterStatus] = useState('active'); // default: show only actives

    const changeView = (mode) => { setViewMode(mode); localStorage.setItem('workers_view', mode); };

    // ── Fetch — delegates status filtering to backend ─────────────────────
    const fetchWorkers = useCallback(async () => {
        setIsLoading(true);
        try {
            let url = '/workers';
            if (filterStatus === 'inactive') url += '?status=inactive';
            else if (filterStatus === 'all') url += '?include_inactive=true';
            // else '' → default active-only
            const res = await get(url);
            const list = res.data || res;
            setWorkers(Array.isArray(list) ? list : []);
        } catch {
            showToast('Error al cargar trabajadores', 'error');
            setWorkers([]);
        } finally {
            setIsLoading(false);
        }
    }, [get, filterStatus]);

    const fetchTrades = useCallback(async () => {
        try {
            const res = await get('/trades');
            setTrades(res.data || res);
        } catch { showToast('Error al cargar oficios', 'error'); }
    }, [get]);

    useEffect(() => { fetchWorkers(); fetchTrades(); }, [fetchWorkers, fetchTrades]);

    // ── Client-side filter (search + trade — status is server-side) ───────
    useEffect(() => {
        let list = [...workers];
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(w =>
                `${w.first_name} ${w.last_name}`.toLowerCase().includes(q) ||
                w.worker_code?.toLowerCase().includes(q) ||
                w.user?.email?.toLowerCase().includes(q)
            );
        }
        if (filterTrade) list = list.filter(w => String(w.trade_id) === filterTrade);
        setFiltered(list);
    }, [workers, searchTerm, filterTrade]);

    // ── Toast ────────────────────────────────────────────────────────────────
    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3800);
    };

    // ── Worker CRUD ──────────────────────────────────────────────────────────
    const openCreate = () => {
        setFormData(EMPTY_FORM); setFormError('');
        setEditingId(null); setModalMode('create'); setModalOpen(true);
    };
    const openEdit = (w) => {
        setFormData({
            first_name: w.first_name || '', last_name: w.last_name || '',
            email: w.user?.email || '', password: '',
            phone: w.phone || '', address: w.address || '',
            trade_id: String(w.trade_id) || '',
            hourly_rate: String(w.hourly_rate) || '',
            status: w.status || 'active',
            availability: w.availability || 'available',
            emergency_contact_name: w.emergency_contact_name || '',
            emergency_contact_phone: w.emergency_contact_phone || '',
            notes: w.notes || '',
            preferred_language: w.user?.preferred_language || 'es',
        });
        setFormError(''); setEditingId(w.id);
        setModalMode('edit'); setModalOpen(true);
    };
    const closeModal = () => { setModalOpen(false); setFormError(''); };
    const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault(); setFormError(''); setSubmitting(true);
        try {
            if (modalMode === 'create') {
                const res = await post('/workers', {
                    ...formData,
                    hourly_rate: parseFloat(formData.hourly_rate),
                    trade_id: parseInt(formData.trade_id),
                });
                const data = res.data || res;
                // Backend returns 200 for reactivation, 201 for new creation
                const isReactivated = res.status === 200 || (data && res.message?.includes('reactivado'));
                showToast(isReactivated ? 'Trabajador reactivado exitosamente' : 'Trabajador creado exitosamente');
            } else {
                await put(`/workers/${editingId}`, {
                    first_name: formData.first_name, last_name: formData.last_name,
                    phone: formData.phone, address: formData.address,
                    trade_id: parseInt(formData.trade_id),
                    hourly_rate: parseFloat(formData.hourly_rate),
                    status: formData.status, availability: formData.availability,
                    emergency_contact_name: formData.emergency_contact_name,
                    emergency_contact_phone: formData.emergency_contact_phone,
                    notes: formData.notes,
                });
                showToast('Trabajador actualizado exitosamente');
            }
            closeModal(); fetchWorkers();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Error al guardar. Revisa los datos.');
        } finally { setSubmitting(false); }
    };

    // ── Toggle active/inactive ───────────────────────────────────────────────
    const handleToggle = (worker) => setToggleModal(worker);

    const confirmToggle = async () => {
        const worker = toggleModal;
        const isActive = worker.status === 'active';
        try {
            await patch(`/workers/${worker.id}/toggle-status`);
            showToast(isActive ? `${worker.first_name} desactivado` : `${worker.first_name} reactivado`);
            setToggleModal(null);
            fetchWorkers();
        } catch {
            showToast('Error al cambiar estado', 'error');
            setToggleModal(null);
        }
    };

    // Stats
    const stats = {
        total: workers.length,
        active: workers.filter(w => w.status === 'active').length,
        available: workers.filter(w => w.availability === 'available').length,
        assigned: workers.filter(w => w.availability === 'assigned').length,
    };

    return (
        <div className="workers-page">
            {/* Toast */}
            {toastMsg && (
                <div className={`workers-toast ${toastMsg.type === 'error' ? 'workers-toast--error' : ''}`}>
                    {toastMsg.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                    <span>{toastMsg.msg}</span>
                </div>
            )}

            {/* Header */}
            <div className="workers-header">
                <div className="workers-header__left">
                    <h1 className="workers-title">Gestión de Trabajadores</h1>
                    <p className="workers-subtitle">Administra el equipo de HM Construction Staffing</p>
                </div>
                <button className="workers-btn-primary" onClick={openCreate}>
                    <Plus size={16} /> Agregar Trabajador
                </button>
            </div>

            {/* Stats */}
            <div className="workers-stats">
                {[
                    { icon: <Users size={20} />, value: stats.total, label: 'Total', color: 'blue' },
                    { icon: <CheckCircle size={20} />, value: stats.active, label: 'Activos', color: 'green' },
                    { icon: <Clock size={20} />, value: stats.available, label: 'Disponibles', color: 'teal' },
                    { icon: <Briefcase size={20} />, value: stats.assigned, label: 'Asignados', color: 'orange' },
                ].map(({ icon, value, label, color }) => (
                    <div className="workers-stat-card" key={label}>
                        <div className={`workers-stat-card__icon workers-stat-card__icon--${color}`}>{icon}</div>
                        <div>
                            <p className="workers-stat-card__value">{value}</p>
                            <p className="workers-stat-card__label">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="workers-filters">
                <div className="workers-search">
                    <Search size={15} className="workers-search__icon" />
                    <input type="text" placeholder="Buscar por nombre, código o email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="workers-search__input" />
                </div>
                <div className="workers-filter-trade-group">
                    <div className="workers-select-wrapper">
                        <select value={filterTrade} onChange={e => setFilterTrade(e.target.value)} className="workers-select">
                            <option value="">Todos los oficios</option>
                            {trades.map(t => <option key={t.id} value={String(t.id)}>{t.name_es || t.name}</option>)}
                        </select>
                        <ChevronDown size={13} className="workers-select__arrow" />
                    </div>
                    <button className="workers-gear-btn" onClick={() => setTradesModal(true)} title="Gestionar oficios"><Settings size={15} /></button>
                </div>
                <div className="workers-select-wrapper">
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="workers-select">
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                        <option value="all">Todos</option>
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <span className="workers-count">{filteredWorkers.length} resultado{filteredWorkers.length !== 1 ? 's' : ''}</span>
                <div className="workers-view-toggle">
                    <button className={`workers-view-btn ${viewMode === 'cards' ? 'workers-view-btn--active' : ''}`} onClick={() => changeView('cards')} title="Vista tarjetas"><LayoutGrid size={15} /></button>
                    <button className={`workers-view-btn ${viewMode === 'table' ? 'workers-view-btn--active' : ''}`} onClick={() => changeView('table')} title="Vista tabla"><List size={15} /></button>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="workers-loading"><div className="workers-spinner" /><p>Cargando trabajadores...</p></div>
            ) : filteredWorkers.length === 0 ? (
                <div className="workers-empty">
                    <Users size={48} /><p>No se encontraron trabajadores</p>
                    <button className="workers-btn-primary" onClick={openCreate}><Plus size={16} /> Agregar el primero</button>
                </div>
            ) : viewMode === 'cards' ? (
                <div className="workers-cards-grid">
                    {filteredWorkers.map(w => (
                        <WorkerCard key={w.id} worker={w} onEdit={openEdit} onToggle={handleToggle} onCardClick={setDrawerWorker} getStats={getStats} />
                    ))}
                </div>
            ) : (
                <div className="workers-table-card">
                    <div className="workers-table-wrapper">
                        <table className="workers-table">
                            <thead>
                                <tr>
                                    <th>Trabajador</th><th>Código</th><th>Oficio</th>
                                    <th>Tarifa / hora</th><th>Estado</th><th>Disponibilidad</th><th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredWorkers.map(worker => (
                                    <tr key={worker.id} onClick={() => setDrawerWorker(worker)} style={{ cursor: 'pointer' }}>
                                        <td>
                                            <div className="workers-table__name">
                                                <div className={`workers-avatar ${worker.status === 'inactive' ? 'workers-avatar--grey' : ''}`}>{worker.first_name?.[0]}{worker.last_name?.[0]}</div>
                                                <div>
                                                    <p className="workers-table__fullname">{worker.first_name} {worker.last_name}</p>
                                                    <p className="workers-table__email">{worker.user?.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td><code className="workers-code">{worker.worker_code}</code></td>
                                        <td><span className="workers-trade">{worker.trade?.name_es || worker.trade?.name || '—'}</span></td>
                                        <td><span className="workers-rate">${parseFloat(worker.hourly_rate || 0).toFixed(2)}/hr</span></td>
                                        <td><StatusBadge status={worker.status} /></td>
                                        <td><AvailabilityBadge availability={worker.availability} /></td>
                                        <td onClick={e => e.stopPropagation()}>
                                            <div className="workers-actions">
                                                <button className="workers-action-btn workers-action-btn--edit" onClick={() => openEdit(worker)} title="Editar"><Edit2 size={14} /></button>
                                                <button
                                                    className={`workers-action-btn ${worker.status === 'active' ? 'workers-action-btn--deactivate' : 'workers-action-btn--reactivate'}`}
                                                    onClick={() => handleToggle(worker)}
                                                    title={worker.status === 'active' ? 'Desactivar' : 'Reactivar'}
                                                >
                                                    {worker.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Create/Edit Modal ── */}
            {modalOpen && (
                <div className="workers-modal-overlay" onClick={closeModal}>
                    <div className="workers-modal" onClick={e => e.stopPropagation()}>
                        <div className="workers-modal__header">
                            <h2 className="workers-modal__title">{modalMode === 'create' ? 'Agregar Nuevo Trabajador' : 'Editar Trabajador'}</h2>
                            <button className="workers-modal__close" onClick={closeModal}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="workers-form">
                            {formError && <div className="workers-form__error"><AlertTriangle size={15} /><span>{formError}</span></div>}
                            {modalMode === 'edit' && (
                                <div className="wf-readonly-badge">
                                    <Shield size={13} />
                                    <span>Código: <strong>{workers.find(w => w.id === editingId)?.worker_code}</strong></span>
                                </div>
                            )}
                            <div className="wf-section-title"><User size={14} /> Datos Personales</div>
                            <div className="wf-grid-2">
                                <FormField label="Nombre" required><input className="wf-input" name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="Ej: Juan" /></FormField>
                                <FormField label="Apellido" required><input className="wf-input" name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="Ej: Pérez" /></FormField>
                            </div>
                            {modalMode === 'create' && (
                                <div className="wf-grid-2">
                                    <FormField label="Email (login)" required hint="Si el email fue desactivado, el trabajador se reactiva automáticamente">
                                        <input className="wf-input" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="contractor@correo.com" />
                                    </FormField>
                                    <FormField label="Contraseña inicial" required hint="Mínimo 6 caracteres">
                                        <input className="wf-input" name="password" type="password" value={formData.password} onChange={handleChange} required placeholder="••••••••" />
                                    </FormField>
                                </div>
                            )}
                            <div className="wf-grid-2">
                                <FormField label="Teléfono" required>
                                    <div className="wf-input-icon"><Phone size={14} className="wf-icon" /><input className="wf-input wf-input--padded" name="phone" value={formData.phone} onChange={handleChange} required placeholder="+1 (912) 000-0000" /></div>
                                </FormField>
                                <FormField label="Idioma preferido">
                                    <div className="wf-select-wrapper">
                                        <select className="wf-select" name="preferred_language" value={formData.preferred_language} onChange={handleChange}>
                                            <option value="es">Español</option><option value="en">English</option>
                                        </select>
                                        <ChevronDown size={13} className="wf-select__arrow" />
                                    </div>
                                </FormField>
                            </div>
                            <FormField label="Dirección">
                                <div className="wf-input-icon"><MapPin size={14} className="wf-icon" /><textarea className="wf-input wf-textarea wf-input--padded" name="address" value={formData.address} onChange={handleChange} placeholder="Dirección completa" rows={2} /></div>
                            </FormField>
                            <div className="wf-section-title"><Briefcase size={14} /> Datos Laborales</div>
                            <div className="wf-grid-2">
                                <FormField label="Oficio" required>
                                    <div className="wf-select-wrapper">
                                        <select className="wf-select" name="trade_id" value={formData.trade_id} onChange={handleChange} required>
                                            <option value="">Seleccionar oficio</option>
                                            {trades.map(t => <option key={t.id} value={String(t.id)}>{t.name_es || t.name}</option>)}
                                        </select>
                                        <ChevronDown size={13} className="wf-select__arrow" />
                                    </div>
                                </FormField>
                                <FormField label="Tarifa / hora ($)" required hint="Tarifa individual">
                                    <div className="wf-input-icon"><DollarSign size={14} className="wf-icon" /><input className="wf-input wf-input--padded" name="hourly_rate" type="number" step="0.01" min="0" value={formData.hourly_rate} onChange={handleChange} required placeholder="0.00" /></div>
                                </FormField>
                            </div>
                            {modalMode === 'edit' && (
                                <div className="wf-grid-2">
                                    <FormField label="Estado">
                                        <div className="wf-select-wrapper">
                                            <select className="wf-select" name="status" value={formData.status} onChange={handleChange}>
                                                <option value="active">Activo</option><option value="inactive">Inactivo</option>
                                            </select>
                                            <ChevronDown size={13} className="wf-select__arrow" />
                                        </div>
                                    </FormField>
                                    <FormField label="Disponibilidad">
                                        <div className="wf-select-wrapper">
                                            <select className="wf-select" name="availability" value={formData.availability} onChange={handleChange}>
                                                <option value="available">Disponible</option><option value="assigned">Asignado</option><option value="unavailable">No disponible</option>
                                            </select>
                                            <ChevronDown size={13} className="wf-select__arrow" />
                                        </div>
                                    </FormField>
                                </div>
                            )}
                            <div className="wf-section-title"><Phone size={14} /> Contacto de Emergencia</div>
                            <div className="wf-grid-2">
                                <FormField label="Nombre"><input className="wf-input" name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange} placeholder="Nombre completo" /></FormField>
                                <FormField label="Teléfono"><input className="wf-input" name="emergency_contact_phone" value={formData.emergency_contact_phone} onChange={handleChange} placeholder="+1 (912) 000-0000" /></FormField>
                            </div>
                            <FormField label="Notas internas"><textarea className="wf-input wf-textarea" name="notes" value={formData.notes} onChange={handleChange} placeholder="Observaciones, habilidades especiales..." rows={3} /></FormField>
                            <div className="workers-modal__footer">
                                <button type="button" className="workers-btn-outline" onClick={closeModal}>Cancelar</button>
                                <button type="submit" className="workers-btn-primary" disabled={submitting}>
                                    {submitting ? <><div className="workers-btn-spinner" /> Guardando...</>
                                        : modalMode === 'create' ? <><Plus size={15} /> Crear Trabajador</>
                                            : <><CheckCircle size={15} /> Guardar Cambios</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Toggle Status Modal ── */}
            {toggleModal && (
                <div className="workers-modal-overlay" onClick={() => setToggleModal(null)}>
                    <div className="workers-confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className={`workers-confirm-modal__icon ${toggleModal.status === 'active' ? '' : 'workers-confirm-modal__icon--green'}`}>
                            {toggleModal.status === 'active' ? <Pause size={28} /> : <Play size={28} />}
                        </div>
                        <h3>{toggleModal.status === 'active' ? 'Desactivar Trabajador' : 'Reactivar Trabajador'}</h3>
                        <p>
                            {toggleModal.status === 'active'
                                ? <>¿Desactivar a <strong>{toggleModal.first_name} {toggleModal.last_name}</strong>? No podrá hacer login.</>
                                : <>¿Reactivar a <strong>{toggleModal.first_name} {toggleModal.last_name}</strong>? Recuperará acceso a la app.</>}
                        </p>
                        <div className="workers-confirm-modal__actions">
                            <button className="workers-btn-outline" onClick={() => setToggleModal(null)}>Cancelar</button>
                            <button
                                className={toggleModal.status === 'active' ? 'workers-btn-danger' : 'workers-btn-success'}
                                onClick={confirmToggle}
                            >
                                {toggleModal.status === 'active' ? <><Pause size={15} /> Sí, desactivar</> : <><Play size={15} /> Sí, reactivar</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Trades Modal ── */}
            {tradesModal && (
                <TradesModal trades={trades} onClose={() => setTradesModal(false)}
                    onRefresh={() => { fetchTrades(); setTradesModal(false); }}
                    api={{ post, put, del }} />
            )}

            {/* ── Worker Drawer ── */}
            {drawerWorker && (
                <WorkerDrawer
                    worker={drawerWorker}
                    trades={trades}
                    onClose={() => setDrawerWorker(null)}
                    onEdit={(w) => { setDrawerWorker(null); openEdit(w); }}
                    onToggle={(w) => { setDrawerWorker(null); handleToggle(w); }}
                    onDeleted={(id) => { setWorkers(prev => prev.filter(w => w.id !== id)); }}
                    api={{ put, del, get }}
                    showToast={showToast}
                />
            )}
        </div>
    );
}
