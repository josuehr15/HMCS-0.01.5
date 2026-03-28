import { useState, useEffect, useCallback } from 'react';
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

function StatusBadge({ status }) {
    return (
        <span className={`clients-badge clients-badge--${status}`}>
            {status === 'active' ? 'Activo' : 'Inactivo'}
        </span>
    );
}

// ─── Client Card ───────────────────────────────────────────────────────────────
function ClientCard({ client, onEdit, onToggle, onCardClick }) {
    const isActive = client.status === 'active';
    const rates = client.clientRates || [];
    const projectCount = (client.projects || []).length;

    return (
        <div
            className={`client-card ${!isActive ? 'client-card--inactive' : ''}`}
            onClick={() => onCardClick(client)}
        >
            {/* Top row: avatar + name + actions */}
            <div className="client-card__top">
                <div className={`clients-avatar ${!isActive ? 'clients-avatar--grey' : ''}`}>
                    {initials(client.company_name)}
                </div>
                <div className="client-card__identity">
                    <p className="client-card__name">{client.company_name}</p>
                    <p className="client-card__contact">{client.contact_name}</p>
                </div>
                <div className="client-card__actions" onClick={e => e.stopPropagation()}>
                    <button
                        className="cc-icon-btn cc-icon-btn--edit"
                        title="Editar"
                        onClick={() => onEdit(client)}
                    >
                        <Edit2 size={13} />
                    </button>
                    <button
                        className={`cc-icon-btn ${isActive ? 'cc-icon-btn--pause' : 'cc-icon-btn--play'}`}
                        title={isActive ? 'Desactivar' : 'Reactivar'}
                        onClick={() => onToggle(client)}
                    >
                        {isActive ? <Pause size={13} /> : <Play size={13} />}
                    </button>
                </div>
            </div>

            {/* Info rows */}
            <div className="client-card__body">
                <div className="client-card__row">
                    <Mail size={12} className="client-card__row-icon" />
                    <span className="client-card__row-text">{client.contact_email}</span>
                </div>
                <div className="client-card__row">
                    <Phone size={12} className="client-card__row-icon" />
                    <span className="client-card__row-text">{client.contact_phone}</span>
                </div>
            </div>

            {/* Status + quick stats */}
            <div className="client-card__middle">
                <StatusBadge status={client.status} />
                <div className="client-card__quick-stats">
                    <span><FolderOpen size={11} /> {projectCount} proyecto{projectCount !== 1 ? 's' : ''}</span>
                    <span><DollarSign size={11} /> {rates.length} tarifa{rates.length !== 1 ? 's' : ''}</span>
                </div>
            </div>

            {/* Rates bar (show first 2 rates) */}
            {rates.length > 0 && (
                <div className="client-card__rates">
                    {rates.slice(0, 2).map(r => (
                        <div key={r.id} className="client-card__rate-chip">
                            <span>{r.trade?.name_es || r.trade?.name || '—'}</span>
                            <strong>${parseFloat(r.hourly_rate).toFixed(2)}/hr</strong>
                        </div>
                    ))}
                    {rates.length > 2 && (
                        <span className="client-card__rate-more">+{rates.length - 2} más</span>
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

    return (
        <>
            <div className="drawer-overlay" onClick={onClose} />
            <aside className="client-drawer" role="dialog" aria-label="Perfil del cliente">
                <button className="drawer-close" onClick={onClose} title="Cerrar"><X size={20} /></button>

                {/* Hero */}
                <div className="drawer-hero">
                    <div className={`clients-avatar clients-avatar--xl ${!isActive ? 'clients-avatar--grey' : ''}`}>
                        {initials(client.company_name)}
                    </div>
                    <div className="drawer-hero__info">
                        <h2 className="drawer-hero__name">{client.company_name}</h2>
                        <span className="drawer-hero__sub">{client.contact_name}</span>
                        <div className="drawer-hero__badges">
                            <StatusBadge status={client.status} />
                        </div>
                    </div>
                </div>

                <div className="drawer-body">
                    {/* Contact info */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><User size={13} /> Información de Contacto</p>
                        <div className="drawer-field"><Mail size={13} /><span className="drawer-field__label">Email (contacto):</span><span>{client.contact_email}</span></div>
                        <div className="drawer-field"><Phone size={13} /><span className="drawer-field__label">Teléfono:</span><span>{client.contact_phone}</span></div>
                        {client.address && <div className="drawer-field"><MapPin size={13} /><span className="drawer-field__label">Dirección:</span><span>{client.address}</span></div>}
                        <div className="drawer-field"><Shield size={13} /><span className="drawer-field__label">Login:</span><span>{client.user?.email || '—'}</span></div>
                    </div>

                    {/* Client Rates */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><DollarSign size={13} /> Tarifas por Oficio</p>
                        {rates.length === 0 ? (
                            <p className="drawer-empty-note">Sin tarifas configuradas</p>
                        ) : (
                            <div className="drawer-rates-list">
                                {rates.map(r => (
                                    <div key={r.id} className="drawer-rate-row">
                                        <span className="drawer-rate-trade">{r.trade?.name_es || r.trade?.name}</span>
                                        <span className="drawer-rate-amount">${parseFloat(r.hourly_rate).toFixed(2)}/hr</span>
                                        <span className="drawer-rate-ot">{parseFloat(r.overtime_multiplier || 1.5).toFixed(1)}x OT</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Projects */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><FolderOpen size={13} /> Proyectos ({projects.length} activo{projects.length !== 1 ? 's' : ''})</p>
                        {projects.length === 0 ? (
                            <p className="drawer-empty-note">Sin proyectos activos</p>
                        ) : (
                            <div className="drawer-projects-list">
                                {projects.slice(0, 5).map(p => (
                                    <div key={p.id} className="drawer-project-row">
                                        <MapPin size={12} />
                                        <span className="drawer-project-name">{p.name}</span>
                                        <span className={`clients-badge clients-badge--${p.status}`} style={{ fontSize: 9, padding: '1px 6px' }}>
                                            {p.status === 'active' ? 'Activo' : p.status}
                                        </span>
                                    </div>
                                ))}
                                {projects.length > 5 && <p className="drawer-empty-note">+{projects.length - 5} más</p>}
                            </div>
                        )}
                    </div>

                    {/* Documents */}
                    <div className="drawer-section">
                        <p className="drawer-section__title"><FileText size={13} /> Documentos</p>
                        <DocumentUploader ownerType="client" ownerId={client.id} token={token} />
                    </div>

                    {/* Actions */}
                    <div className="drawer-section drawer-section--actions">
                        <p className="drawer-section__title">Acciones</p>
                        <button className="drawer-action-btn" onClick={() => onEdit(client)}>
                            <Edit2 size={14} /> Editar Cliente
                        </button>
                        <button
                            className="drawer-action-btn"
                            onClick={() => onToggle(client)}
                        >
                            {isActive ? <Pause size={14} /> : <Play size={14} />}
                            {isActive ? 'Desactivar Cliente' : 'Reactivar Cliente'}
                        </button>
                        <button className="drawer-action-btn" onClick={handleResetPassword} disabled={resetLoading}>
                            <Key size={14} /> {resetLoading ? 'Reseteando...' : 'Resetear Contraseña'}
                        </button>
                        <button className="drawer-action-btn drawer-action-btn--danger" onClick={startDelete}>
                            <Trash2 size={14} /> Eliminar Cliente
                        </button>
                    </div>
                </div>

                {/* Reset password modal */}
                {resetModal && (
                    <div className="workers-modal-overlay" style={{ zIndex: 1200 }}>
                        <div className="workers-confirm-modal" onClick={e => e.stopPropagation()}>
                            <div className="workers-confirm-modal__icon" style={{ background: '#DBEAFE', color: '#2A6C95' }}>
                                <Key size={28} />
                            </div>
                            <h3>Contraseña Temporal Generada</h3>
                            <p>Comparte esta contraseña con el cliente de forma segura:</p>
                            <div className="reset-pwd-display">
                                <code className="reset-pwd-code">{resetPwd}</code>
                                <button className="reset-pwd-copy" onClick={copyPassword}>
                                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                                    {copied ? 'Copiado' : 'Copiar'}
                                </button>
                            </div>
                            <p className="reset-pwd-note">El cliente deberá cambiar su contraseña en el primer inicio de sesión.</p>
                            <div className="workers-confirm-modal__actions">
                                <button className="workers-btn-primary" onClick={() => setResetModal(false)}>Listo</button>
                            </div>
                        </div>
                    </div>
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
                                        <h3>Eliminar Cliente Permanentemente</h3>
                                        <p>Este cliente <strong>no tiene datos vinculados</strong>. Puedes eliminarlo de forma definitiva.</p>
                                        <div className="delete-linked-data" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
                                            <p className="delete-linked-data__title" style={{ color: '#065F46' }}>✓ Sin datos vinculados</p>
                                            <p className="delete-linked-data__warning">El email quedará libre para reutilizar.</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <h3>Ocultar Cliente Permanentemente</h3>
                                        <p>Este cliente <strong>tiene datos vinculados</strong> y no puede borrarse.</p>
                                        <div className="delete-linked-data">
                                            <p className="delete-linked-data__title">Datos vinculados:</p>
                                            <ul>
                                                {linkedData.projects > 0 && <li>• {linkedData.projects} proyecto(s)</li>}
                                                {linkedData.invoices > 0 && <li>• {linkedData.invoices} factura(s)</li>}
                                            </ul>
                                            <p className="delete-linked-data__warning">El cliente quedará oculto permanentemente. Los datos se conservan.</p>
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

                {/* Delete Step 2: confirm with ID */}
                {deleteStep === 2 && (() => {
                    const canHard = linkedData?.can_hard_delete ?? (linkedData?.total === 0);
                    return (
                        <div className="workers-modal-overlay" style={{ zIndex: 1200 }} onClick={() => { setDeleteStep(0); setConfirmId(''); }}>
                            <div className="workers-confirm-modal" onClick={e => e.stopPropagation()}>
                                <div className="workers-confirm-modal__icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                                    <Shield size={28} />
                                </div>
                                <h3>Confirmación Final</h3>
                                <p>{canHard ? 'Para eliminar' : 'Para ocultar'}, escribe el ID del cliente:</p>
                                <div className="delete-code-confirm">
                                    <code className="delete-code-target">{client.id}</code>
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
                                        disabled={String(confirmId).trim() !== String(client.id) || deleteLoading}
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

// ─── Rates sub-form ────────────────────────────────────────────────────────────
function RatesForm({ rates, onChange, trades }) {
    const addRate = () => onChange([...rates, { trade_id: '', hourly_rate: '', overtime_multiplier: '1.50' }]);
    const removeRate = i => onChange(rates.filter((_, idx) => idx !== i));
    const updateField = (i, field, val) => onChange(rates.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

    return (
        <div className="rates-form">
            <div className="rates-form__header">
                <span>Tarifas por Oficio</span>
                <button type="button" className="rates-form__add" onClick={addRate}>
                    <Plus size={13} /> Agregar tarifa
                </button>
            </div>
            {rates.length === 0 && <p className="rates-form__empty">Sin tarifas — opcional</p>}
            {rates.map((r, i) => (
                <div key={i} className="rates-form__row">
                    <select
                        className="wf-select"
                        value={r.trade_id}
                        onChange={e => updateField(i, 'trade_id', e.target.value)}
                    >
                        <option value="">Oficio</option>
                        {trades.map(t => <option key={t.id} value={t.id}>{t.name_es || t.name}</option>)}
                    </select>
                    <input
                        className="wf-input"
                        type="number"
                        placeholder="$/hr"
                        value={r.hourly_rate}
                        onChange={e => updateField(i, 'hourly_rate', e.target.value)}
                        min="0"
                        step="0.01"
                    />
                    <input
                        className="wf-input"
                        type="number"
                        placeholder="OT x"
                        value={r.overtime_multiplier}
                        onChange={e => updateField(i, 'overtime_multiplier', e.target.value)}
                        min="1"
                        step="0.01"
                        style={{ width: 64 }}
                    />
                    <button type="button" className="rates-form__remove" onClick={() => removeRate(i)}>
                        <X size={13} />
                    </button>
                </div>
            ))}
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
            const withP = actv.filter(c => (c.projects || []).length > 0);
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
            <div className="clients-header">
                <div>
                    <h1 className="clients-title">Gestión de Clientes</h1>
                    <p className="clients-subtitle">Administra tus clientes, tarifas y contratos</p>
                </div>
                <button className="workers-btn-primary" onClick={openCreate}>
                    <Plus size={16} /> Nuevo Cliente
                </button>
            </div>

            {/* Stat cards */}
            <div className="clients-stats-grid">
                {STAT_CARDS.map((s, i) => (
                    <div key={i} className="clients-stat-card">
                        <div className="clients-stat-card__icon" style={{ background: `${s.color}15`, color: s.color }}>
                            {s.icon}
                        </div>
                        <div>
                            <p className="clients-stat-card__value">{s.value}</p>
                            <p className="clients-stat-card__label">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters bar */}
            <div className="workers-toolbar">
                <div className="workers-search-box">
                    <Search size={15} className="workers-search-icon" />
                    <input
                        className="workers-search-input"
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
                <span className="workers-count">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
                <div className="workers-view-toggle">
                    <button className={`workers-view-btn ${viewMode === 'cards' ? 'workers-view-btn--active' : ''}`} onClick={() => changeView('cards')} title="Tarjetas"><LayoutGrid size={15} /></button>
                    <button className={`workers-view-btn ${viewMode === 'table' ? 'workers-view-btn--active' : ''}`} onClick={() => changeView('table')} title="Tabla"><List size={15} /></button>
                </div>
            </div>

            {/* Content */}
            {filtered.length === 0 ? (
                <div className="workers-empty">
                    <Building2 size={48} />
                    <p>No se encontraron clientes</p>
                    <button className="workers-btn-primary" onClick={openCreate}><Plus size={16} /> Agregar el primero</button>
                </div>
            ) : viewMode === 'cards' ? (
                <div className="clients-cards-grid">
                    {filtered.map(c => (
                        <ClientCard key={c.id} client={c} onEdit={openEdit} onToggle={handleToggle} onCardClick={setDrawerClient} />
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

            {/* Modal Create/Edit */}
            {modalOpen && (
                <div className="workers-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="workers-modal" onClick={e => e.stopPropagation()}>
                        <div className="workers-modal__header">
                            <h2>{modalMode === 'create' ? 'Nuevo Cliente' : 'Editar Cliente'}</h2>
                            <button className="workers-modal__close" onClick={() => setModalOpen(false)}><X size={18} /></button>
                        </div>
                        <div className="workers-modal__body">
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
                        <div className="workers-modal__footer">
                            <button className="workers-btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
                            <button className="workers-btn-primary" onClick={handleSave} disabled={submitting}>
                                {submitting ? 'Guardando...' : (modalMode === 'create' ? 'Crear Cliente' : 'Guardar Cambios')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
