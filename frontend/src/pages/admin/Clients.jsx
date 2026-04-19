import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
    Search, Plus, Edit2, X, ChevronDown,
    Phone, MapPin, User, Users, Building2,
    Settings, DollarSign, LayoutGrid, List,
    ChevronRight, Shield, Trash2, Key, Mail,
    BarChart3, Briefcase, EyeOff, CheckCircle,
    FolderOpen, FileText, Copy, Pause, Play
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import DocumentUploader from '../../components/DocumentUploader';
import { useAuth } from '../../context/AuthContext';
import './Clients.css';

// ─── Constants ─────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
    company_name: '', contact_name: '', contact_email: '',
    contact_phone: '', address: '', email: '', password: '',
    notes: '', preferred_language: 'es',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function initials(name) {
    if (!name) return '?';
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Deterministic avatar color from company name
const AVATAR_PALETTE = [
    '#2A6C95', '#1E5270', '#0D6B5E', '#7C3AED',
    '#B45309', '#DC2626', '#0369A1', '#047857',
];
function avatarColor(name) {
    if (!name) return AVATAR_PALETTE[0];
    const code = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return AVATAR_PALETTE[code % AVATAR_PALETTE.length];
}

function StatusBadge({ status }) {
    return (
        <span className={`cl-badge cl-badge--${status === 'active' ? 'active' : 'inactive'}`}>
            {status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
    );
}

// ─── Client Card ───────────────────────────────────────────────────────────────
function ClientCard({ client, onEdit, onToggle, onCardClick, selected }) {
    const isActive = client.status === 'active';
    const rates = (client.clientRates || []).filter(r => r.is_active !== false);
    const projectCount = (client.projects || []).length;
    const bgColor = avatarColor(client.company_name);

    return (
        <div
            className={`cl-card${selected ? ' cl-card--selected' : ''}${!isActive ? ' cl-card--inactive' : ''}`}
            onClick={() => onCardClick(client)}
        >
            {/* Header: avatar + name + action buttons */}
            <div className="cl-card__head">
                <div className="cl-card__identity">
                    <div
                        className="cl-card__avatar"
                        style={{ background: isActive ? bgColor : '#9CA3AF' }}
                    >
                        {initials(client.company_name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <p className="cl-card__name" title={client.company_name}>{client.company_name}</p>
                        <p className="cl-card__contact">{client.contact_name}</p>
                    </div>
                </div>
                <div className="cl-card__actions" onClick={e => e.stopPropagation()}>
                    <button className="cl-card__action-btn" title="Editar" onClick={() => onEdit(client)}>
                        <Edit2 size={13} />
                    </button>
                    <button
                        className={`cl-card__action-btn${isActive ? '' : ''}`}
                        title={isActive ? 'Desactivar' : 'Reactivar'}
                        onClick={() => onToggle(client)}
                    >
                        {isActive ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                </div>
            </div>

            {/* Contact info rows */}
            <div className="cl-card__info">
                <div className="cl-card__info-row">
                    <Mail size={11} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.contact_email}</span>
                </div>
                {client.contact_phone && (
                    <div className="cl-card__info-row">
                        <Phone size={11} />
                        <span>{client.contact_phone}</span>
                    </div>
                )}
            </div>

            {/* Footer: badge + quick stats */}
            <div className="cl-card__footer">
                <StatusBadge status={client.status} />
                <div className="cl-card__stats">
                    <span title={`${projectCount} proyecto${projectCount !== 1 ? 's' : ''}`}><FolderOpen size={10} style={{ marginRight: 3 }} />{projectCount} proy.</span>
                    <span title={`${rates.length} tarifa${rates.length !== 1 ? 's' : ''}`}><DollarSign size={10} style={{ marginRight: 3 }} />{rates.length} tar.</span>
                </div>
            </div>

            {/* Rate chips (first 2) */}
            {rates.length > 0 && (
                <div className="cl-card__rates">
                    {rates.slice(0, 2).map(r => (
                        <span key={r.id} className="cl-rate-chip">
                            {r.trade?.name_es || r.trade?.name || '—'} · ${parseFloat(r.hourly_rate).toFixed(2)}/hr
                        </span>
                    ))}
                    {rates.length > 2 && (
                        <span className="cl-rate-chip" style={{ opacity: 0.65 }}>+{rates.length - 2}</span>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Client Drawer ─────────────────────────────────────────────────────────────
function ClientDrawer({ client, api, showToast, onClose, onEdit, onDeleted, onToggle, token }) {
    const { put, del, get } = api;
    const [deleteStep, setDeleteStep] = useState(0);
    const [linkedData, setLinkedData] = useState(null);
    const [confirmId, setConfirmId] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [resetModal, setResetModal] = useState(false);
    const [resetPwd, setResetPwd] = useState('');
    const [copied, setCopied] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);

    useEffect(() => {
        const handler = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!client) return null;
    const isActive = client.status === 'active';
    const rates = client.clientRates || [];
    const projects = client.projects?.filter(p => p.status === 'active') || client.projects || [];

    // Reset password
    const handleResetPassword = async () => {
        setResetLoading(true);
        try {
            const res = await put(`/clients/${client.id}/reset-password`, {});
            const data = res.data?.data || res.data || res;
            setResetPwd(data.temporary_password || '');
            setResetModal(true);
        } catch { showToast('Error al resetear contraseña', 'error'); }
        finally { setResetLoading(false); }
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
            const res = await get(`/clients/${client.id}/linked-data`);
            const data = res.data?.data || res.data || res;
            setLinkedData(data);
        } catch {
            setLinkedData({ projects: 0, invoices: 0, total: 0, can_hard_delete: true });
        }
        setDeleteStep(1);
    };

    const confirmDelete = async () => {
        if (String(confirmId).trim() !== String(client.id)) return;
        setDeleteLoading(true);
        try {
            const res = await del(`/clients/${client.id}/force?confirmed_id=${client.id}`);
            const data = res.data?.data || res.data || res;
            const action = data?.action;
            if (action === 'deleted') {
                showToast(`${client.company_name} eliminado permanentemente. Email liberado.`, 'success');
            } else {
                showToast(`${client.company_name} ocultado. Datos históricos conservados.`, 'success');
            }
            onDeleted(client.id);
            onClose();
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al eliminar', 'error');
        } finally {
            setDeleteLoading(false);
            setDeleteStep(0);
            setConfirmId('');
        }
    };

    return ReactDOM.createPortal(
        <>
            <div className="cl-detail-overlay" onClick={onClose} />
            <aside className="cl-detail-panel" role="dialog" aria-label="Perfil del cliente">
                {/* Header */}
                <div className="cl-detail__header">
                    <div className="cl-detail__header-top">
                        <div
                            className="cl-detail__avatar"
                            style={{ background: isActive ? avatarColor(client.company_name) : '#9CA3AF' }}
                        >
                            {initials(client.company_name)}
                        </div>
                        <button className="cl-detail__close" onClick={onClose} title="Cerrar"><X size={18} /></button>
                    </div>
                    <h2 className="cl-detail__name">{client.company_name}</h2>
                    <p className="cl-detail__contact-name">{client.contact_name}</p>
                    <StatusBadge status={client.status} />
                </div>

                {/* Body */}
                <div className="cl-detail__body">
                    {/* Contact info */}
                    <div className="cl-detail__section">
                        <p className="cl-detail__section-title"><User size={12} /> Contacto</p>
                        <div className="cl-detail__row"><Mail size={12} /><span className="cl-detail__row-label">Email:</span><span className="cl-detail__row-value">{client.contact_email}</span></div>
                        <div className="cl-detail__row"><Phone size={12} /><span className="cl-detail__row-label">Teléfono:</span><span className="cl-detail__row-value">{client.contact_phone}</span></div>
                        {client.address && <div className="cl-detail__row"><MapPin size={12} /><span className="cl-detail__row-label">Dirección:</span><span className="cl-detail__row-value">{client.address}</span></div>}
                        <div className="cl-detail__row"><Shield size={12} /><span className="cl-detail__row-label">Login:</span><span className="cl-detail__row-value">{client.user?.email || '—'}</span></div>
                    </div>

                    {/* Rates */}
                    <div className="cl-detail__section">
                        <p className="cl-detail__section-title"><DollarSign size={12} /> Tarifas por Oficio</p>
                        {rates.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin tarifas configuradas</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {rates.map(r => (
                                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                                        <span style={{ color: 'var(--text)' }}>{r.trade?.name_es || r.trade?.name}</span>
                                        <span style={{ fontWeight: 700, color: '#2A6C95' }}>${parseFloat(r.hourly_rate).toFixed(2)}/hr</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{parseFloat(r.overtime_multiplier || 1.5).toFixed(1)}x OT</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Projects */}
                    <div className="cl-detail__section">
                        <p className="cl-detail__section-title"><FolderOpen size={12} /> Proyectos ({projects.length})</p>
                        {projects.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin proyectos activos</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {projects.slice(0, 5).map(p => (
                                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                                        <MapPin size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        <span style={{ flex: 1, color: 'var(--text)' }}>{p.name}</span>
                                        <StatusBadge status={p.status} />
                                    </div>
                                ))}
                                {projects.length > 5 && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{projects.length - 5} más</p>}
                            </div>
                        )}
                    </div>

                    {/* Documents */}
                    <div className="cl-detail__section">
                        <p className="cl-detail__section-title"><FileText size={12} /> Documentos</p>
                        <DocumentUploader ownerType="client" ownerId={client.id} token={token} />
                    </div>
                </div>

                {/* Action footer */}
                <div className="cl-detail__actions">
                    <button className="cl-detail__action-btn" onClick={() => onEdit(client)}>
                        <Edit2 size={14} /> Editar Cliente
                    </button>
                    <button className="cl-detail__action-btn" onClick={() => onToggle(client)}>
                        {isActive ? <Pause size={14} /> : <Play size={14} />} {isActive ? 'Desactivar' : 'Reactivar'}
                    </button>
                    <button className="cl-detail__action-btn" onClick={handleResetPassword} disabled={resetLoading}>
                        <Key size={14} /> {resetLoading ? 'Reseteando...' : 'Resetear Contraseña'}
                    </button>
                    <button className="cl-detail__action-btn cl-detail__action-btn--danger" onClick={startDelete}>
                        <Trash2 size={14} /> Eliminar Cliente
                    </button>
                </div>

                {/* Reset password modal — via portal */}
                {resetModal && ReactDOM.createPortal(
                    <div className="cl-overlay" style={{ zIndex: 700 }} onClick={() => setResetModal(false)}>
                        <div className="cl-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                            <div className="cl-modal__header">
                                <div className="hmcs-modal-identity">
                                    <div className="hmcs-modal-identity__avatar-wrap">
                                        <div className="hmcs-modal-identity__avatar">
                                            <Key size={24} />
                                        </div>
                                    </div>
                                    <div className="hmcs-modal-identity__text">
                                        <h2 className="hmcs-modal-identity__name">Contraseña Temporal</h2>
                                        <div className="hmcs-modal-identity__meta">
                                            <span>{client?.company_name || client?.contact_name}</span>
                                        </div>
                                    </div>
                                </div>
                                <button className="cl-modal__close" onClick={() => setResetModal(false)}><X size={16} /></button>
                            </div>
                            <div className="cl-modal__body">
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 16 }}>Comparte esta contraseña con el cliente de forma segura:</p>
                                <div className="reset-pwd-display">
                                    <code className="reset-pwd-code">{resetPwd}</code>
                                    <button className="reset-pwd-copy" onClick={copyPassword}>
                                        {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                                        {copied ? 'Copiado' : 'Copiar'}
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 12 }}>El cliente deberá cambiar su contraseña en el primer inicio de sesión.</p>
                            </div>
                            <div className="cl-modal__footer">
                                <button className="cl-btn-primary" onClick={() => setResetModal(false)}>Listo</button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Delete Step 1 */}
                {deleteStep === 1 && linkedData && (() => {
                    const canHard = linkedData.can_hard_delete ?? (linkedData.total === 0);
                    return ReactDOM.createPortal(
                        <div className="cl-overlay" style={{ zIndex: 700 }} onClick={() => setDeleteStep(0)}>
                            <div className="cl-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
                                <div className="cl-modal__header">
                                    <h2 className="cl-modal__title" style={{ color: '#DC2626' }}>
                                        {canHard ? <><Trash2 size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />Eliminar Cliente</> : <><EyeOff size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />Ocultar Cliente</>}
                                    </h2>
                                    <button className="cl-modal__close" onClick={() => setDeleteStep(0)}><X size={16} /></button>
                                </div>
                                <div className="cl-modal__body">
                                    {canHard ? (
                                        <>
                                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Este cliente <strong>no tiene datos vinculados</strong>. Puedes eliminarlo de forma definitiva.</p>
                                            <div className="delete-linked-data" style={{ background: '#F0FDF4', borderColor: '#BBF7D0', marginTop: 14 }}>
                                                <p className="delete-linked-data__title" style={{ color: '#065F46' }}>✓ Sin datos vinculados</p>
                                                <p className="delete-linked-data__warning">El email quedará libre para reutilizar.</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Este cliente <strong>tiene datos vinculados</strong> y no puede borrarse.</p>
                                            <div className="delete-linked-data" style={{ marginTop: 14 }}>
                                                <p className="delete-linked-data__title">Datos vinculados:</p>
                                                <ul>
                                                    {linkedData.projects > 0 && <li>• {linkedData.projects} proyecto(s)</li>}
                                                    {linkedData.invoices > 0 && <li>• {linkedData.invoices} factura(s)</li>}
                                                </ul>
                                                <p className="delete-linked-data__warning">El cliente quedará oculto permanentemente. Los datos se conservan.</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="cl-modal__footer">
                                    <button className="cl-btn-cancel" onClick={() => setDeleteStep(0)}>Cancelar</button>
                                    <button className="workers-btn-danger" onClick={() => setDeleteStep(2)}>Sí, continuar →</button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    );
                })()}

                {/* Delete Step 2 */}
                {deleteStep === 2 && (() => {
                    const canHard = linkedData?.can_hard_delete ?? (linkedData?.total === 0);
                    return ReactDOM.createPortal(
                        <div className="cl-overlay" style={{ zIndex: 700 }} onClick={() => { setDeleteStep(0); setConfirmId(''); }}>
                            <div className="cl-modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                                <div className="cl-modal__header">
                                    <h2 className="cl-modal__title" style={{ color: '#DC2626' }}><Shield size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />Confirmación Final</h2>
                                    <button className="cl-modal__close" onClick={() => { setDeleteStep(0); setConfirmId(''); }}><X size={16} /></button>
                                </div>
                                <div className="cl-modal__body">
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 14 }}>{canHard ? 'Para eliminar' : 'Para ocultar'}, escribe el ID del cliente:</p>
                                    <div className="delete-code-confirm">
                                        <code className="delete-code-target">{client.id}</code>
                                        <input className="delete-code-input wf-input" value={confirmId} onChange={e => setConfirmId(e.target.value)} placeholder="Escribe el ID aquí" autoFocus type="number" />
                                    </div>
                                </div>
                                <div className="cl-modal__footer">
                                    <button className="cl-btn-cancel" onClick={() => { setDeleteStep(0); setConfirmId(''); }}>Cancelar</button>
                                    <button className="workers-btn-danger" onClick={confirmDelete} disabled={String(confirmId).trim() !== String(client.id) || deleteLoading}>
                                        {canHard ? <><Trash2 size={15} /> {deleteLoading ? 'Eliminando...' : 'Eliminar Definitivamente'}</> : <><EyeOff size={15} /> {deleteLoading ? 'Ocultando...' : 'Ocultar Permanentemente'}</>}
                                    </button>
                                </div>
                            </div>
                        </div>,
                        document.body
                    );
                })()}
            </aside>
        </>,
        document.body
    );
}

// ─── Rates sub-form ────────────────────────────────────────────────────────────
function RatesForm({ rates, onChange, trades }) {
    const addRate = () => onChange([...rates, { trade_id: '', hourly_rate: '', overtime_multiplier: '1.50' }]);
    const removeRate = i => onChange(rates.filter((_, idx) => idx !== i));
    const updateField = (i, field, val) => onChange(rates.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

    return (
        <div className="cl-form-section">
            <div className="cl-form-section__title">
                <DollarSign size={14} />
                TARIFAS POR OFICIO
            </div>

            {/* Filas de tarifas agregadas */}
            {rates.length > 0 ? (
                <div className="cl-rates-list">
                    {rates.map((r, i) => (
                        <div key={i} className="cl-rate-row">
                            {/* Select de oficio */}
                            <select
                                className="cl-rate-row__select"
                                value={r.trade_id}
                                onChange={e => updateField(i, 'trade_id', e.target.value)}
                            >
                                <option value="">Oficio...</option>
                                {trades.map(t => (
                                    <option key={t.id} value={t.id}>{t.name_es || t.name}</option>
                                ))}
                            </select>

                            {/* Input $/hr */}
                            <div className="cl-rate-row__field">
                                <span className="cl-rate-row__prefix">$</span>
                                <input
                                    className="cl-rate-row__input"
                                    type="number"
                                    placeholder="0.00"
                                    value={r.hourly_rate}
                                    onChange={e => updateField(i, 'hourly_rate', e.target.value)}
                                    min="0"
                                    step="0.01"
                                />
                                <span className="cl-rate-row__suffix">/hr</span>
                            </div>

                            {/* Input OT multiplier */}
                            <div className="cl-rate-row__field cl-rate-row__field--ot">
                                <input
                                    className="cl-rate-row__input"
                                    type="number"
                                    placeholder="1.50"
                                    value={r.overtime_multiplier}
                                    onChange={e => updateField(i, 'overtime_multiplier', e.target.value)}
                                    min="1"
                                    step="0.01"
                                />
                                <span className="cl-rate-row__suffix">x OT</span>
                            </div>

                            {/* Botón eliminar */}
                            <button
                                type="button"
                                className="cl-rate-row__remove"
                                onClick={() => removeRate(i)}
                                title="Eliminar tarifa"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="cl-rates-empty">
                    Sin tarifas — opcional. Puedes agregar tarifas después.
                </p>
            )}

            {/* Botón agregar */}
            <button type="button" className="cl-btn-add-rate" onClick={addRate}>
                <Plus size={14} />
                Agregar tarifa por oficio
            </button>
        </div>
    );
}


// ─── Main Component ────────────────────────────────────────────────────────────
export default function Clients() {
    const { token } = useAuth();
    const api = useApi();
    const { get, post, put } = api;

    // State
    const [clients, setClients] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [trades, setTrades] = useState([]);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('clients_view') || 'cards');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [drawerClient, setDrawerClient] = useState(null);
    const [toastMsg, setToastMsg] = useState(null);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [formRates, setFormRates] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('active');

    // Stats
    const [stats, setStats] = useState({ total: 0, active: 0, withProjects: 0 });

    const changeView = m => { setViewMode(m); localStorage.setItem('clients_view', m); };

    // ── Fetch ──────────────────────────────────────────────────────
    const fetchClients = useCallback(async () => {
        try {
            let url = '/clients';
            if (filterStatus === 'inactive') url += '?status=inactive';
            else if (filterStatus === 'all') url += '?include_inactive=true';
            const res = await get(url);
            const data = res.data || res;
            setClients(data);
        } catch { showToast('Error al cargar clientes', 'error'); }
    }, [get, filterStatus]);

    const fetchTrades = useCallback(async () => {
        try {
            const res = await get('/trades');
            setTrades(res.data || res);
        } catch { /* no-op */ }
    }, [get]);

    const fetchStats = useCallback(async () => {
        try {
            const res = await get('/clients?include_inactive=true');
            const all = res.data || res;
            const list = Array.isArray(all) ? all : [];
            const actv = list.filter(c => c.status === 'active');
            const withP = actv.filter(c => (c.projects || []).some(p => p.status === 'active'));
            setStats({ total: list.length, active: actv.length, withProjects: withP.length });
        } catch { /* no-op */ }
    }, [get]);


    useEffect(() => { fetchClients(); fetchTrades(); fetchStats(); }, [fetchClients, fetchTrades, fetchStats]);

    // ── Client-side filter (search) ────────────────────────────────
    useEffect(() => {
        let list = [...clients];
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(c =>
                c.company_name?.toLowerCase().includes(q) ||
                c.contact_name?.toLowerCase().includes(q) ||
                c.contact_email?.toLowerCase().includes(q)
            );
        }
        setFiltered(list);
    }, [clients, searchTerm]);

    // ── Toast ──────────────────────────────────────────────────────
    const showToast = (msg, type = 'success') => {
        setToastMsg({ msg, type });
        setTimeout(() => setToastMsg(null), 3800);
    };

    // ── CRUD ───────────────────────────────────────────────────────
    const openCreate = () => {
        setFormData(EMPTY_FORM); setFormRates([]); setFormError('');
        setEditingId(null); setModalMode('create'); setModalOpen(true);
    };
    const openEdit = c => {
        setFormData({
            company_name: c.company_name || '', contact_name: c.contact_name || '',
            contact_email: c.contact_email || '', contact_phone: c.contact_phone || '',
            address: c.address || '', email: c.user?.email || '', password: '',
            notes: c.notes || '', preferred_language: c.user?.preferred_language || 'es',
        });
        setFormRates((c.clientRates || []).map(r => ({
            id: r.id,
            trade_id: String(r.trade_id),
            hourly_rate: String(r.hourly_rate),
            overtime_multiplier: String(r.overtime_multiplier || '1.50'),
        })));
        setFormError(''); setEditingId(c.id);
        setModalMode('edit'); setModalOpen(true);
    };

    const handleSave = async () => {
        const { company_name, contact_name, contact_email, contact_phone, email } = formData;
        if (!company_name || !contact_name || !contact_email || !contact_phone) {
            return setFormError('Empresa, contacto, email de contacto y teléfono son requeridos.');
        }
        if (modalMode === 'create' && !email) {
            return setFormError('Email de login requerido.');
        }
        if (modalMode === 'create' && !formData.password) {
            return setFormError('Contraseña requerida.');
        }
        setSubmitting(true);
        setFormError('');
        try {
            if (modalMode === 'create') {
                const res = await post('/clients', { ...formData, rates: formRates });
                const newC = res.data?.data || res.data || res;
                setClients(prev => [...prev, newC].sort((a, b) => a.company_name.localeCompare(b.company_name)));
                showToast(`${newC.company_name} creado exitosamente.`);
            } else {
                const res = await put(`/clients/${editingId}`, formData);
                const upd = res.data?.data || res.data || res;
                setClients(prev => prev.map(c => c.id === editingId ? upd : c));
                if (drawerClient?.id === editingId) setDrawerClient(upd);
                showToast(`${upd.company_name} actualizado.`);
            }
            setModalOpen(false);
            fetchStats();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Error al guardar');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggle = async (c) => {
        try {
            const res = await put(`/clients/${c.id}/toggle-status`, {});
            const upd = res.data?.data || res.data || res;
            setClients(prev => prev.map(x => x.id === c.id ? upd : x));
            if (drawerClient?.id === c.id) setDrawerClient(upd);
            showToast(upd.status === 'active' ? 'Cliente reactivado.' : 'Cliente desactivado.');
            fetchClients(); // re-fetch if filterStatus changes visibility
        } catch { showToast('Error al cambiar estado', 'error'); }
    };

    const handleDeleted = (id) => {
        setClients(prev => prev.filter(c => c.id !== id));
        fetchStats();
    };

    // ── Computed stats ─────────────────────────────────────────────
    const STAT_CARDS = [
        { label: 'Total Clientes', value: stats.total, icon: <Building2 size={18} />, color: '#2A6C95' },
        { label: 'Activos', value: stats.active, icon: <CheckCircle size={18} />, color: '#10B981' },
        { label: 'Con Proyectos', value: stats.withProjects, icon: <FolderOpen size={18} />, color: '#F59E0B' },
        { label: 'Facturado (mes)', value: '$0.00', icon: <BarChart3 size={18} />, color: '#8B5CF6' },
    ];

    return (
        <div className="clients-page fade-in">
            {/* Toast */}
            {toastMsg && (
                <div className={`workers-toast workers-toast--${toastMsg.type}`}>
                    {toastMsg.type === 'success' ? <CheckCircle size={15} /> : <X size={15} />}
                    {toastMsg.msg}
                </div>
            )}

            {/* Header */}
            <div className="cl-header">
                <div>
                    <h1 className="cl-header__title">Gestión de Clientes</h1>
                    <p className="cl-header__subtitle">Administra tus clientes, tarifas y contratos</p>
                </div>
                <button className="cl-btn-new" onClick={openCreate}>
                    <Plus size={16} /> Nuevo Cliente
                </button>
            </div>

            {/* KPI Cards */}
            <div className="cl-kpis">
                {STAT_CARDS.map((s, i) => (
                    <div key={i} className="cl-kpi">
                        <div className="cl-kpi__icon" style={{ background: `${s.color}18`, color: s.color }}>
                            {s.icon}
                        </div>
                        <div className="cl-kpi__body">
                            <p className="cl-kpi__value">{s.value}</p>
                            <p className="cl-kpi__label">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="cl-toolbar">
                <div className="cl-search">
                    <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        className="cl-search__input"
                        placeholder="Buscar empresa, contacto..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="workers-select-wrapper">
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="workers-select">
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                        <option value="all">Todos</option>
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <div className="workers-view-toggle" style={{ marginLeft: 'auto' }}>
                    <button className={`workers-view-btn ${viewMode === 'cards' ? 'workers-view-btn--active' : ''}`} onClick={() => changeView('cards')} title="Tarjetas"><LayoutGrid size={15} /></button>
                    <button className={`workers-view-btn ${viewMode === 'table' ? 'workers-view-btn--active' : ''}`} onClick={() => changeView('table')} title="Tabla"><List size={15} /></button>
                </div>
            </div>
            <p className="cl-results">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>

            {/* Content */}
            {filtered.length === 0 ? (
                <div className="workers-empty">
                    <Building2 size={48} />
                    <p>No se encontraron clientes</p>
                    <button className="workers-btn-primary" onClick={openCreate}><Plus size={16} /> Agregar el primero</button>
                </div>
            ) : viewMode === 'cards' ? (
                <div className="cl-grid">
                    {filtered.map(c => (
                        <ClientCard
                            key={c.id}
                            client={c}
                            selected={drawerClient?.id === c.id}
                            onEdit={openEdit}
                            onToggle={handleToggle}
                            onCardClick={setDrawerClient}
                        />
                    ))}
                </div>
            ) : (
                /* Table view */
                <div className="workers-table-wrap">
                    <table className="workers-table">
                        <thead>
                            <tr>
                                <th>Empresa</th>
                                <th>Contacto</th>
                                <th>Email</th>
                                <th>Teléfono</th>
                                <th>Estado</th>
                                <th>Proyectos</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(c => (
                                <tr key={c.id} className="workers-table__row" onClick={() => setDrawerClient(c)}>
                                    <td>
                                        <div className="workers-table__name-cell">
                                            <div className="clients-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                                                {initials(c.company_name)}
                                            </div>
                                            <span>{c.company_name}</span>
                                        </div>
                                    </td>
                                    <td>{c.contact_name}</td>
                                    <td>{c.contact_email}</td>
                                    <td>{c.contact_phone}</td>
                                    <td><StatusBadge status={c.status} /></td>
                                    <td>{(c.projects || []).length}</td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <div className="workers-table__actions">
                                            <button className="cc-icon-btn cc-icon-btn--edit" onClick={() => openEdit(c)} title="Editar"><Edit2 size={13} /></button>
                                            <button className={`cc-icon-btn ${c.status === 'active' ? 'cc-icon-btn--pause' : 'cc-icon-btn--play'}`} onClick={() => handleToggle(c)} title="Toggle">
                                                {c.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
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
            {drawerClient && (
                <ClientDrawer
                    client={drawerClient}
                    api={api}
                    showToast={showToast}
                    onClose={() => setDrawerClient(null)}
                    onEdit={openEdit}
                    onDeleted={handleDeleted}
                    onToggle={handleToggle}
                    token={token}
                />
            )}

            {/* Modal Create/Edit — via Portal */}
            {modalOpen && ReactDOM.createPortal(
                <div className="cl-overlay" onClick={() => setModalOpen(false)}>
                    <div className="cl-modal" onClick={e => e.stopPropagation()}>
                        <div className="cl-modal__header">
                            <div className="hmcs-modal-identity">
                                <div className="hmcs-modal-identity__avatar-wrap">
                                    <div className="hmcs-modal-identity__avatar">
                                        {modalMode === 'edit' && formData.company_name
                                            ? formData.company_name.slice(0, 2).toUpperCase()
                                            : <Building2 size={24} />
                                        }
                                    </div>
                                </div>
                                <div className="hmcs-modal-identity__text">
                                    <h2 className="hmcs-modal-identity__name">
                                        {modalMode === 'create' ? 'Nuevo Cliente' : formData.company_name || 'Editar Cliente'}
                                    </h2>
                                    <div className="hmcs-modal-identity__meta">
                                        <span>Gestión de clientes</span>
                                    </div>
                                </div>
                            </div>
                            <button className="cl-modal__close" onClick={() => setModalOpen(false)}><X size={16} /></button>
                        </div>
                        <div className="cl-modal__body">
                            {formError && <div className="wf-error">{formError}</div>}

                            <div className="wf-section-title"><Building2 size={14} /> Datos de la Empresa</div>
                            <div className="wf-grid-2">
                                <div className="wf-field">
                                    <label className="wf-label">Empresa *</label>
                                    <input className="wf-input" value={formData.company_name} onChange={e => setFormData(p => ({ ...p, company_name: e.target.value }))} placeholder="ABC Construction LLC" />
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Nombre de contacto *</label>
                                    <input className="wf-input" value={formData.contact_name} onChange={e => setFormData(p => ({ ...p, contact_name: e.target.value }))} placeholder="John Smith" />
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Email de contacto *</label>
                                    <input className="wf-input" type="email" value={formData.contact_email} onChange={e => setFormData(p => ({ ...p, contact_email: e.target.value }))} placeholder="john@abc.com" />
                                </div>
                                <div className="wf-field">
                                    <label className="wf-label">Teléfono *</label>
                                    <input className="wf-input" value={formData.contact_phone} onChange={e => setFormData(p => ({ ...p, contact_phone: e.target.value }))} placeholder="(912) 555-1234" />
                                </div>
                            </div>
                            <div className="wf-field">
                                <label className="wf-label">Dirección</label>
                                <textarea className="wf-input wf-textarea" value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} rows={2} placeholder="123 Main St, Savannah, GA 31401" />
                            </div>

                            {modalMode === 'create' && (
                                <>
                                    <div className="wf-section-title"><Shield size={14} /> Cuenta de Acceso</div>
                                    <div className="wf-grid-2">
                                        <div className="wf-field">
                                            <label className="wf-label">Email para login *</label>
                                            <input className="wf-input" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="login@abc.com" />
                                        </div>
                                        <div className="wf-field">
                                            <label className="wf-label">Contraseña inicial *</label>
                                            <input className="wf-input" type="password" value={formData.password} onChange={e => setFormData(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
                                        </div>
                                    </div>
                                </>
                            )}

                            <RatesForm rates={formRates} onChange={setFormRates} trades={trades} />

                            <div className="wf-field" style={{ marginTop: 12 }}>
                                <label className="wf-label">Notas internas</label>
                                <textarea className="wf-input wf-textarea" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Notas opcionales..." />
                            </div>
                        </div>
                        <div className="cl-modal__footer">
                            <button className="cl-btn-cancel" onClick={() => setModalOpen(false)}>Cancelar</button>
                            <button className="cl-btn-primary" onClick={handleSave} disabled={submitting}>
                                {submitting ? 'Guardando...' : (modalMode === 'create' ? 'Crear Cliente' : 'Guardar Cambios')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
