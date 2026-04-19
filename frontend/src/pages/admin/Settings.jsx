import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Building2, FileText, Lock, Save, CheckCircle,
    AlertCircle, RefreshCw, Eye, EyeOff,
    Wrench, DollarSign, Bell, Plus, X, Edit2, Upload,
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import api from '../../utils/api';
import './Settings.css';

// ─── Toast helper ─────────────────────────────────────────────────────────────
function useToast() {
    const [toast, setToast] = useState(null);
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3800);
    };
    return { toast, showToast };
}

// ─── Default notification prefs ───────────────────────────────────────────────
const DEFAULT_NOTIF_PREFS = {
    missing_clock_out: true,
    pending_time_entries: true,
    overtime_detected: false,
    invoice_pending_approval: true,
    invoice_overdue: true,
    payroll_ready: true,
    payroll_paid: false,
};

// ─── Sections ─────────────────────────────────────────────────────────────────
const SECTIONS = [
    { id: 'company',       label: 'Empresa',          icon: Building2  },
    { id: 'invoicing',     label: 'Facturación',       icon: FileText   },
    { id: 'trades',        label: 'Oficios',           icon: Wrench     },
    { id: 'payroll',       label: 'Nómina',            icon: DollarSign },
    { id: 'notifications', label: 'Notificaciones',    icon: Bell       },
    { id: 'account',       label: 'Cuenta de Usuario', icon: Lock       },
];

// ─── Toggle Switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange }) {
    return (
        <label className="set-switch">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
            <span className="set-switch-slider" />
        </label>
    );
}

// ─── Notification groups config ───────────────────────────────────────────────
const NOTIF_GROUPS = [
    {
        title: 'Horas y Asistencia',
        items: [
            { key: 'missing_clock_out',      label: 'Entrada sin salida registrada',       desc: 'Alerta si un trabajador hizo clock-in pero no clock-out al final del día' },
            { key: 'pending_time_entries',    label: 'Entradas pendientes de aprobación',   desc: 'Recordatorio cuando hay time entries sin aprobar después de 48h' },
            { key: 'overtime_detected',       label: 'Overtime detectado',                 desc: 'Aviso cuando un trabajador supera las horas configuradas en la semana' },
        ],
    },
    {
        title: 'Facturación',
        items: [
            { key: 'invoice_pending_approval', label: 'Factura lista para aprobar', desc: 'Notificación cuando una factura pasa a pending approval' },
            { key: 'invoice_overdue',           label: 'Factura vencida',            desc: 'Alerta cuando una factura supera su fecha de vencimiento sin pago' },
        ],
    },
    {
        title: 'Nómina',
        items: [
            { key: 'payroll_ready', label: 'Nómina lista para procesar',       desc: 'Aviso al cerrar la semana con horas aprobadas sin pagar' },
            { key: 'payroll_paid',  label: 'Pago marcado como completado',     desc: 'Confirmación cuando el admin marca una nómina como pagada' },
        ],
    },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Settings() {
    const { get, post, put, del } = useApi();
    const { toast, showToast } = useToast();

    const [activeSection, setActiveSection] = useState('company');
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({});

    // Password change state
    const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
    const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false });
    const [pwdSaving, setPwdSaving] = useState(false);

    // Trades state
    const [trades, setTrades] = useState([]);
    const [tradeModal, setTradeModal] = useState(null); // null | { mode: 'create'|'edit', trade: {} }
    const [tradeForm, setTradeForm] = useState({ name: '', name_es: '' });
    const [tradeError, setTradeError] = useState('');
    const [tradeSaving, setTradeSaving] = useState(false);
    const [tradeConfirm, setTradeConfirm] = useState(null); // { id, name }

    // Notification preferences
    const [notifPrefs, setNotifPrefs] = useState(DEFAULT_NOTIF_PREFS);
    const [notifSaving, setNotifSaving] = useState(false);

    // Logo upload state
    const [logos, setLogos] = useState({
        horizontal: { preview: null, file: null, uploading: false },
        square:     { preview: null, file: null, uploading: false },
    });
    const logoHorizRef = useRef(null);
    const logoSquareRef = useRef(null);

    // ── Loaders ──────────────────────────────────────────────────────────────
    const loadSettings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await get('/settings');
            const data = res.data || res;
            setSettings(data);
            setForm({
                company_name:            data.company_name || '',
                address:                 data.address || '',
                city:                    data.city || '',
                state:                   data.state || '',
                zip:                     data.zip || '',
                email:                   data.email || '',
                phone:                   data.phone || '',
                invoice_prefix:          data.invoice_prefix || '26',
                payment_terms_days:      String(data.payment_terms_days || 14),
                payment_instructions:    data.payment_instructions || '',
                invoice_footer_note:     data.invoice_footer_note || '',
                standard_hours_per_week: String(data.standard_hours_per_week || 40),
                default_ot_multiplier:   String(data.default_ot_multiplier || 1.5),
                default_payment_method:  data.default_payment_method || 'zelle',
                week_start_day:          data.week_start_day || 'monday',
            });
            setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...(data.notification_preferences || {}) });
        } catch {
            showToast('Error al cargar configuración.', 'error');
        } finally {
            setLoading(false);
        }
    }, [get]);

    const loadTrades = useCallback(async () => {
        try {
            const res = await get('/trades?include_inactive=true');
            const data = res.data || res;
            setTrades(Array.isArray(data) ? data : []);
        } catch {
            showToast('Error al cargar oficios.', 'error');
        }
    }, [get]);

    useEffect(() => {
        loadSettings();
        loadTrades();
    }, [loadSettings, loadTrades]);

    const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    // ── Save company ──────────────────────────────────────────────────────────
    const handleSaveCompany = async () => {
        setSaving(true);
        try {
            const res = await put('/settings', {
                company_name: form.company_name,
                address:      form.address,
                city:         form.city,
                state:        form.state,
                zip:          form.zip,
                email:        form.email,
                phone:        form.phone,
            });
            const data = res.data || res;
            setSettings(data);
            showToast('Configuración de empresa guardada.');
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al guardar.', 'error');
        } finally { setSaving(false); }
    };

    // ── Save invoicing ────────────────────────────────────────────────────────
    const handleSaveInvoicing = async () => {
        setSaving(true);
        try {
            const res = await put('/settings', {
                invoice_prefix:       form.invoice_prefix,
                payment_terms_days:   Number(form.payment_terms_days),
                payment_instructions: form.payment_instructions,
                invoice_footer_note:  form.invoice_footer_note,
            });
            const data = res.data || res;
            setSettings(data);
            showToast('Configuración de facturación guardada.');
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al guardar.', 'error');
        } finally { setSaving(false); }
    };

    // ── Save payroll ──────────────────────────────────────────────────────────
    const handleSavePayroll = async () => {
        setSaving(true);
        try {
            const res = await put('/settings', {
                standard_hours_per_week: Number(form.standard_hours_per_week),
                default_ot_multiplier:   Number(form.default_ot_multiplier),
                default_payment_method:  form.default_payment_method,
                week_start_day:          form.week_start_day,
            });
            const data = res.data || res;
            setSettings(data);
            showToast('Configuración de nómina guardada.');
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al guardar.', 'error');
        } finally { setSaving(false); }
    };

    // ── Save notifications ────────────────────────────────────────────────────
    const handleSaveNotifications = async () => {
        setNotifSaving(true);
        try {
            await put('/settings', { notification_preferences: notifPrefs });
            showToast('Notificaciones guardadas.');
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al guardar.', 'error');
        } finally { setNotifSaving(false); }
    };

    // ── Change password ───────────────────────────────────────────────────────
    const handlePasswordChange = async () => {
        if (!pwdForm.current_password || !pwdForm.new_password) {
            return showToast('Completa todos los campos.', 'error');
        }
        if (pwdForm.new_password !== pwdForm.confirm_password) {
            return showToast('Las contraseñas nuevas no coinciden.', 'error');
        }
        if (pwdForm.new_password.length < 6) {
            return showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
        }
        setPwdSaving(true);
        try {
            await put('/settings/change-password', {
                current_password: pwdForm.current_password,
                new_password:     pwdForm.new_password,
            });
            showToast('Contraseña cambiada correctamente.');
            setPwdForm({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al cambiar contraseña.', 'error');
        } finally { setPwdSaving(false); }
    };

    // ── Logo upload ───────────────────────────────────────────────────────────
    const handleLogoSelect = (slot, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => setLogos(prev => ({
            ...prev,
            [slot]: { ...prev[slot], preview: e.target.result, file },
        }));
        reader.readAsDataURL(file);
    };

    const handleLogoUpload = async (slot) => {
        const { file } = logos[slot];
        if (!file) return;
        setLogos(prev => ({ ...prev, [slot]: { ...prev[slot], uploading: true } }));
        try {
            const formData = new FormData();
            formData.append('logo', file);
            const endpoint = slot === 'horizontal'
                ? '/settings/logo/horizontal'
                : '/settings/logo/square';
            const res = await api.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const url = res.data?.data?.url || res.data?.url;
            // Update settings in state so the current URL reflects the new logo
            setSettings(prev => ({
                ...prev,
                [slot === 'horizontal' ? 'logo_horizontal_url' : 'logo_square_url']: url,
            }));
            // Clear the pending file — preview stays as confirmation
            setLogos(prev => ({ ...prev, [slot]: { ...prev[slot], file: null, uploading: false } }));
            showToast(`Logo ${slot === 'horizontal' ? 'horizontal' : 'cuadrado'} actualizado.`);
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al subir logo.', 'error');
            setLogos(prev => ({ ...prev, [slot]: { ...prev[slot], uploading: false } }));
        }
    };

    // ── Trade CRUD ────────────────────────────────────────────────────────────
    const openTradeModal = (mode, trade = null) => {
        setTradeForm(trade ? { name: trade.name, name_es: trade.name_es } : { name: '', name_es: '' });
        setTradeError('');
        setTradeModal({ mode, trade });
    };

    const closeTradeModal = () => {
        setTradeModal(null);
        setTradeError('');
    };

    const handleSaveTrade = async () => {
        if (!tradeForm.name.trim() || !tradeForm.name_es.trim()) {
            setTradeError('Nombre en inglés y español son requeridos.');
            return;
        }
        setTradeSaving(true);
        setTradeError('');
        try {
            if (tradeModal.mode === 'create') {
                await post('/trades', tradeForm);
                showToast('Oficio creado correctamente.');
            } else {
                await put(`/trades/${tradeModal.trade.id}`, tradeForm);
                showToast('Oficio actualizado.');
            }
            closeTradeModal();
            loadTrades();
        } catch (err) {
            setTradeError(err.response?.data?.message || 'Error al guardar oficio.');
        } finally { setTradeSaving(false); }
    };

    const handleToggleTrade = async (trade) => {
        if (trade.is_active) {
            setTradeConfirm({ id: trade.id, name: trade.name });
        } else {
            try {
                await put(`/trades/${trade.id}`, { is_active: true });
                showToast(`Oficio "${trade.name}" reactivado.`);
                loadTrades();
            } catch (err) {
                showToast(err.response?.data?.message || 'Error al reactivar.', 'error');
            }
        }
    };

    const confirmDeactivate = async () => {
        if (!tradeConfirm) return;
        try {
            await del(`/trades/${tradeConfirm.id}`);
            showToast(`Oficio "${tradeConfirm.name}" desactivado.`);
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al desactivar.', 'error');
        } finally {
            setTradeConfirm(null);
            loadTrades();
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="set-page fade-in">
            {/* Toast */}
            {toast && (
                <div className={`workers-toast ${toast.type === 'error' ? 'workers-toast--error' : ''}`}>
                    {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                    <span>{toast.msg}</span>
                </div>
            )}

            {/* Trade create/edit modal */}
            {tradeModal && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.45)',
                        zIndex: 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onClick={closeTradeModal}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '24px',
                            width: '100%',
                            maxWidth: '440px',
                            margin: '0 16px',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                            zIndex: 501,
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="set-modal-header">
                            <div className="hmcs-modal-identity">
                                <div className="hmcs-modal-identity__avatar-wrap">
                                    <div className="hmcs-modal-identity__avatar">
                                        <Wrench size={24} />
                                    </div>
                                </div>
                                <div className="hmcs-modal-identity__text">
                                    <h2 className="hmcs-modal-identity__name">
                                        {tradeModal.mode === 'create' ? 'Nuevo Oficio' : 'Editar Oficio'}
                                    </h2>
                                    <div className="hmcs-modal-identity__meta">
                                        <span>Configuración de oficios</span>
                                    </div>
                                </div>
                            </div>
                            <button className="set-modal-close" onClick={closeTradeModal}><X size={16} /></button>
                        </div>
                        <div className="set-modal-body">
                            {tradeError && (
                                <div className="set-modal-error">
                                    <AlertCircle size={14} /> {tradeError}
                                </div>
                            )}
                            <div className="set-field">
                                <label className="set-label">Nombre en Inglés *</label>
                                <input
                                    className="set-input"
                                    value={tradeForm.name}
                                    onChange={e => setTradeForm(p => ({ ...p, name: e.target.value }))}
                                    placeholder="Carpentry"
                                    autoFocus
                                />
                            </div>
                            <div className="set-field">
                                <label className="set-label">Nombre en Español *</label>
                                <input
                                    className="set-input"
                                    value={tradeForm.name_es}
                                    onChange={e => setTradeForm(p => ({ ...p, name_es: e.target.value }))}
                                    placeholder="Carpintería"
                                />
                            </div>
                        </div>
                        <div className="set-modal-actions">
                            <button className="set-btn-secondary" onClick={closeTradeModal}>Cancelar</button>
                            <button className="set-save-btn" onClick={handleSaveTrade} disabled={tradeSaving}>
                                {tradeSaving ? <><RefreshCw size={14} className="rpt-spin" /> Guardando...</> : <><Save size={14} /> Guardar</>}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Confirm deactivate modal */}
            {tradeConfirm && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.45)',
                        zIndex: 500,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                    onClick={() => setTradeConfirm(null)}
                >
                    <div
                        style={{
                            background: 'white',
                            borderRadius: '12px',
                            padding: '24px',
                            width: '100%',
                            maxWidth: '360px',
                            margin: '0 16px',
                            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
                            zIndex: 501,
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="set-modal-header">
                            <h3>Desactivar Oficio</h3>
                            <button className="set-modal-close" onClick={() => setTradeConfirm(null)}><X size={16} /></button>
                        </div>
                        <div className="set-modal-body">
                            <p>¿Desactivar el oficio <strong>"{tradeConfirm.name}"</strong>?</p>
                            <p className="set-hint">Los trabajadores con este oficio no se verán afectados, pero no podrás asignar nuevos.</p>
                        </div>
                        <div className="set-modal-actions">
                            <button className="set-btn-secondary" onClick={() => setTradeConfirm(null)}>Cancelar</button>
                            <button className="set-btn-danger" onClick={confirmDeactivate}>Desactivar</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Header */}
            <div className="set-header">
                <h1 className="set-title">Configuración</h1>
                <p className="set-subtitle">Ajustes generales del sistema HMCS</p>
            </div>

            <div className="set-layout">
                {/* Sidebar nav */}
                <nav className="set-nav">
                    {SECTIONS.map(s => (
                        <button
                            key={s.id}
                            className={`set-nav__item ${activeSection === s.id ? 'set-nav__item--active' : ''}`}
                            onClick={() => setActiveSection(s.id)}
                        >
                            <s.icon size={16} />
                            {s.label}
                        </button>
                    ))}
                </nav>

                {/* Content */}
                <div className="set-content">
                    {loading ? (
                        <div className="set-loading"><RefreshCw size={20} className="rpt-spin" /> Cargando...</div>
                    ) : (
                        <>
                            {/* ── Empresa ── */}
                            {activeSection === 'company' && (
                                <div className="set-section">
                                    {/* Logo upload cards */}
                                    <h2 className="set-section__title"><Building2 size={17} /> Logo de la Empresa</h2>
                                    <p className="set-section__desc">Los logos se usan en el header de la app y en facturas.</p>

                                    <div className="set-logo-cards">
                                        {/* ── Horizontal logo ── */}
                                        {[
                                            {
                                                slot: 'horizontal',
                                                title: 'Logo Horizontal',
                                                desc: 'Usado en el header de la app',
                                                ref: logoHorizRef,
                                                currentUrl: settings?.logo_horizontal_url,
                                                fallback: '/images/logo transaparente.PNG',
                                                imgStyle: { maxHeight: 60 },
                                            },
                                            {
                                                slot: 'square',
                                                title: 'Logo Cuadrado',
                                                desc: 'Usado en facturas y documentos',
                                                ref: logoSquareRef,
                                                currentUrl: settings?.logo_square_url,
                                                fallback: '/images/logo cuadrado.JPG',
                                                imgStyle: { maxHeight: 80, maxWidth: 80 },
                                            },
                                        ].map(({ slot, title, desc, ref, currentUrl, fallback, imgStyle }) => {
                                            const { preview, file, uploading } = logos[slot];
                                            const displaySrc = preview || (currentUrl
                                                ? `http://localhost:5000${currentUrl}`
                                                : null);
                                            return (
                                                <div key={slot} className="set-logo-card">
                                                    <div className="set-logo-card__preview">
                                                        {displaySrc ? (
                                                            <img
                                                                src={displaySrc}
                                                                alt={title}
                                                                style={{ ...imgStyle, objectFit: 'contain' }}
                                                                onError={e => {
                                                                    e.currentTarget.src = fallback;
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="set-logo-card__empty">
                                                                <Upload size={20} />
                                                                <span>Sin logo</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="set-logo-card__info">
                                                        <p className="set-logo-card__title">{title}</p>
                                                        <p className="set-logo-card__desc">{desc}</p>
                                                        <div className="set-logo-card__actions">
                                                            <input
                                                                ref={ref}
                                                                type="file"
                                                                accept="image/png,image/jpeg,image/webp"
                                                                style={{ display: 'none' }}
                                                                onChange={e => handleLogoSelect(slot, e.target.files?.[0])}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="set-btn-secondary"
                                                                onClick={() => ref.current?.click()}
                                                            >
                                                                Cambiar
                                                            </button>
                                                            {file && (
                                                                <button
                                                                    type="button"
                                                                    className="set-save-btn"
                                                                    onClick={() => handleLogoUpload(slot)}
                                                                    disabled={uploading}
                                                                >
                                                                    {uploading
                                                                        ? <><RefreshCw size={13} className="rpt-spin" /> Subiendo...</>
                                                                        : <><Upload size={13} /> Guardar Logo</>}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <hr className="set-divider" />

                                    <h2 className="set-section__title"><Building2 size={17} /> Información de la Empresa</h2>
                                    <p className="set-section__desc">Esta información aparece en las facturas y documentos oficiales.</p>

                                    <div className="set-grid-2">
                                        <div className="set-field">
                                            <label className="set-label">Nombre Legal *</label>
                                            <input className="set-input" name="company_name" value={form.company_name} onChange={handleChange} placeholder="HM Construction Staffing LLLP" />
                                        </div>
                                        <div className="set-field">
                                            <label className="set-label">Email</label>
                                            <input className="set-input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="info@empresa.com" />
                                        </div>
                                    </div>
                                    <div className="set-field">
                                        <label className="set-label">Dirección</label>
                                        <input className="set-input" name="address" value={form.address} onChange={handleChange} placeholder="500 Lucas Dr" />
                                    </div>
                                    <div className="set-grid-3">
                                        <div className="set-field">
                                            <label className="set-label">Ciudad</label>
                                            <input className="set-input" name="city" value={form.city} onChange={handleChange} placeholder="Savannah" />
                                        </div>
                                        <div className="set-field">
                                            <label className="set-label">Estado</label>
                                            <input className="set-input" name="state" value={form.state} onChange={handleChange} placeholder="GA" maxLength={2} />
                                        </div>
                                        <div className="set-field">
                                            <label className="set-label">ZIP</label>
                                            <input className="set-input" name="zip" value={form.zip} onChange={handleChange} placeholder="31406" />
                                        </div>
                                    </div>
                                    <div className="set-field">
                                        <label className="set-label">Teléfono</label>
                                        <input className="set-input" name="phone" value={form.phone} onChange={handleChange} placeholder="+1 (912) 000-0000" />
                                    </div>

                                    <div className="set-actions">
                                        <button className="set-save-btn" onClick={handleSaveCompany} disabled={saving}>
                                            {saving ? <><RefreshCw size={14} className="rpt-spin" /> Guardando...</> : <><Save size={14} /> Guardar Empresa</>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Facturación ── */}
                            {activeSection === 'invoicing' && (
                                <div className="set-section">
                                    <h2 className="set-section__title"><FileText size={17} /> Configuración de Facturas</h2>
                                    <p className="set-section__desc">Prefijos, términos de pago y notas que aparecen en todas las facturas.</p>

                                    <div className="set-grid-2">
                                        <div className="set-field">
                                            <label className="set-label">Prefijo de Factura</label>
                                            <input className="set-input" name="invoice_prefix" value={form.invoice_prefix} onChange={handleChange} placeholder="26" maxLength={10} />
                                            <p className="set-hint">Ej: prefijo "26" genera facturas "26-001", "26-002"...</p>
                                        </div>
                                        <div className="set-field">
                                            <label className="set-label">Días de Pago (Net)</label>
                                            <input className="set-input" name="payment_terms_days" type="number" min="0" max="90" value={form.payment_terms_days} onChange={handleChange} />
                                            <p className="set-hint">Ej: 14 → "Net 14" en cada factura</p>
                                        </div>
                                    </div>
                                    <div className="set-field">
                                        <label className="set-label">Instrucciones de Pago</label>
                                        <textarea
                                            className="set-input set-textarea"
                                            name="payment_instructions"
                                            rows={3}
                                            value={form.payment_instructions}
                                            onChange={handleChange}
                                            placeholder="Please make checks payable to: HM Construction Staffing LLLP"
                                        />
                                    </div>
                                    <div className="set-field">
                                        <label className="set-label">Nota de Pie de Factura</label>
                                        <textarea
                                            className="set-input set-textarea"
                                            name="invoice_footer_note"
                                            rows={2}
                                            value={form.invoice_footer_note}
                                            onChange={handleChange}
                                            placeholder="Nota opcional que aparece al final de cada factura..."
                                        />
                                    </div>

                                    {settings?.invoice_next_number && (
                                        <div className="set-info-box">
                                            <p>Próximo número de factura: <strong>{settings.invoice_prefix}-{String(settings.invoice_next_number).padStart(3, '0')}</strong></p>
                                            <p className="set-hint">Este número se incrementa automáticamente al generar facturas.</p>
                                        </div>
                                    )}

                                    <div className="set-actions">
                                        <button className="set-save-btn" onClick={handleSaveInvoicing} disabled={saving}>
                                            {saving ? <><RefreshCw size={14} className="rpt-spin" /> Guardando...</> : <><Save size={14} /> Guardar Facturación</>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Oficios ── */}
                            {activeSection === 'trades' && (
                                <div className="set-section">
                                    <div className="set-section-header">
                                        <div>
                                            <h2 className="set-section__title"><Wrench size={17} /> Oficios</h2>
                                            <p className="set-section__desc">Gestiona los oficios disponibles para asignar a trabajadores.</p>
                                        </div>
                                        <button className="set-add-btn" onClick={() => openTradeModal('create')}>
                                            <Plus size={14} /> Nuevo Oficio
                                        </button>
                                    </div>

                                    <div className="set-trades-list">
                                        {trades.length === 0 && (
                                            <p className="set-empty">No hay oficios registrados.</p>
                                        )}
                                        {trades.map(trade => (
                                            <div
                                                key={trade.id}
                                                className={`set-trade-item ${!trade.is_active ? 'set-trade-item--inactive' : ''}`}
                                            >
                                                <div className="set-trade-info">
                                                    <span className="set-trade-name">{trade.name}</span>
                                                    <span className="set-trade-name-es">{trade.name_es}</span>
                                                    <span className={`set-trade-badge ${trade.is_active ? 'set-trade-badge--active' : 'set-trade-badge--inactive'}`}>
                                                        {trade.is_active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </div>
                                                <div className="set-trade-actions">
                                                    {trade.is_active && (
                                                        <button
                                                            className="set-trade-btn"
                                                            onClick={() => openTradeModal('edit', trade)}
                                                            title="Editar"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                    )}
                                                    <button
                                                        className={`set-trade-btn ${trade.is_active ? 'set-trade-btn--deactivate' : 'set-trade-btn--activate'}`}
                                                        onClick={() => handleToggleTrade(trade)}
                                                        title={trade.is_active ? 'Desactivar' : 'Reactivar'}
                                                    >
                                                        {trade.is_active ? <X size={14} /> : <Plus size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Nómina ── */}
                            {activeSection === 'payroll' && (
                                <div className="set-section">
                                    <h2 className="set-section__title"><DollarSign size={17} /> Configuración de Nómina</h2>
                                    <p className="set-section__desc">Reglas globales de nómina. Las tarifas por cliente y oficio sobrescriben estos valores.</p>

                                    <div className="set-grid-2">
                                        <div className="set-field">
                                            <label className="set-label">Umbral de Overtime</label>
                                            <div className="set-input-unit-wrap">
                                                <input
                                                    className="set-input"
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    step="0.5"
                                                    name="standard_hours_per_week"
                                                    value={form.standard_hours_per_week}
                                                    onChange={handleChange}
                                                />
                                                <span className="set-input-unit">hrs/semana</span>
                                            </div>
                                        </div>
                                        <div className="set-field">
                                            <label className="set-label">Multiplicador de Overtime</label>
                                            <div className="set-input-unit-wrap">
                                                <input
                                                    className="set-input"
                                                    type="number"
                                                    min="1"
                                                    max="3"
                                                    step="0.25"
                                                    name="default_ot_multiplier"
                                                    value={form.default_ot_multiplier}
                                                    onChange={handleChange}
                                                />
                                                <span className="set-input-unit">× tarifa</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="set-field">
                                        <label className="set-label">Método de Pago por Defecto</label>
                                        <div className="set-pill-group">
                                            {[
                                                { value: 'zelle', label: 'Zelle'    },
                                                { value: 'cash',  label: 'Efectivo' },
                                                { value: 'check', label: 'Cheque'   },
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    className={`set-pill ${form.default_payment_method === opt.value ? 'set-pill--active' : ''}`}
                                                    onClick={() => setForm(p => ({ ...p, default_payment_method: opt.value }))}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="set-field">
                                        <label className="set-label">Inicio de Semana Laboral</label>
                                        <select
                                            className="set-input"
                                            name="week_start_day"
                                            value={form.week_start_day}
                                            onChange={handleChange}
                                            style={{ maxWidth: 220 }}
                                        >
                                            <option value="monday">Lunes</option>
                                            <option value="sunday">Domingo</option>
                                        </select>
                                    </div>

                                    <div className="set-actions">
                                        <button className="set-save-btn" onClick={handleSavePayroll} disabled={saving}>
                                            {saving ? <><RefreshCw size={14} className="rpt-spin" /> Guardando...</> : <><Save size={14} /> Guardar Nómina</>}
                                        </button>
                                    </div>

                                    <div className="set-warn-note">
                                        ⚠️ Los cambios aplican solo a nóminas futuras. Los registros ya generados no se modifican.
                                    </div>
                                </div>
                            )}

                            {/* ── Notificaciones ── */}
                            {activeSection === 'notifications' && (
                                <div className="set-section">
                                    <h2 className="set-section__title"><Bell size={17} /> Notificaciones</h2>
                                    <p className="set-section__desc">Configura qué alertas deseas recibir en el sistema.</p>

                                    {NOTIF_GROUPS.map(group => (
                                        <div key={group.title} className="set-notif-group">
                                            <h3 className="set-notif-group-title">{group.title}</h3>
                                            {group.items.map(item => (
                                                <div key={item.key} className="set-toggle-row">
                                                    <div className="set-toggle-info">
                                                        <span className="set-toggle-label">{item.label}</span>
                                                        <span className="set-toggle-desc">{item.desc}</span>
                                                    </div>
                                                    <ToggleSwitch
                                                        checked={notifPrefs[item.key] ?? false}
                                                        onChange={val => setNotifPrefs(p => ({ ...p, [item.key]: val }))}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    ))}

                                    <div className="set-actions">
                                        <button className="set-save-btn" onClick={handleSaveNotifications} disabled={notifSaving}>
                                            {notifSaving ? <><RefreshCw size={14} className="rpt-spin" /> Guardando...</> : <><Save size={14} /> Guardar Notificaciones</>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Cuenta de Usuario ── */}
                            {activeSection === 'account' && (
                                <div className="set-section">
                                    <h2 className="set-section__title"><Lock size={17} /> Cuenta de Administrador</h2>
                                    <p className="set-section__desc">Cambia la contraseña de tu cuenta de administrador.</p>

                                    <div className="set-pwd-box">
                                        {[
                                            { key: 'current_password', label: 'Contraseña Actual',  pwdKey: 'current' },
                                            { key: 'new_password',     label: 'Nueva Contraseña',   pwdKey: 'new'     },
                                            { key: 'confirm_password', label: 'Confirmar Nueva',    pwdKey: 'confirm' },
                                        ].map(field => (
                                            <div key={field.key} className="set-field">
                                                <label className="set-label">{field.label}</label>
                                                <div className="set-pwd-input-wrap">
                                                    <input
                                                        className="set-input"
                                                        type={showPwd[field.pwdKey] ? 'text' : 'password'}
                                                        value={pwdForm[field.key]}
                                                        onChange={e => setPwdForm(p => ({ ...p, [field.key]: e.target.value }))}
                                                        placeholder="••••••••"
                                                        style={{ paddingRight: 40 }}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="set-pwd-toggle"
                                                        onClick={() => setShowPwd(p => ({ ...p, [field.pwdKey]: !p[field.pwdKey] }))}
                                                    >
                                                        {showPwd[field.pwdKey] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="set-actions">
                                        <button className="set-save-btn" onClick={handlePasswordChange} disabled={pwdSaving}>
                                            {pwdSaving ? <><RefreshCw size={14} className="rpt-spin" /> Cambiando...</> : <><Lock size={14} /> Cambiar Contraseña</>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
