import { useState, useEffect, useCallback } from 'react';
import {
    Building2, FileText, Lock, Save, CheckCircle,
    AlertCircle, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import useApi from '../../hooks/useApi';
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

// ─── Sections ─────────────────────────────────────────────────────────────────
const SECTIONS = [
    { id: 'company', label: 'Empresa', icon: Building2 },
    { id: 'invoicing', label: 'Facturación', icon: FileText },
    { id: 'account', label: 'Cuenta de Usuario', icon: Lock },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Settings() {
    const { get, put } = useApi();
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

    // Load settings
    const loadSettings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await get('/settings');
            const data = res.data || res;
            setSettings(data);
            setForm({
                company_name: data.company_name || '',
                address: data.address || '',
                city: data.city || '',
                state: data.state || '',
                zip: data.zip || '',
                email: data.email || '',
                phone: data.phone || '',
                invoice_prefix: data.invoice_prefix || '26',
                payment_terms_days: String(data.payment_terms_days || 14),
                payment_instructions: data.payment_instructions || '',
            });
        } catch {
            showToast('Error al cargar configuración.', 'error');
        } finally {
            setLoading(false);
        }
    }, [get]);

    useEffect(() => { loadSettings(); }, [loadSettings]);

    const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    // Save company / invoicing
    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await put('/settings', form);
            const data = res.data || res;
            setSettings(data);
            showToast('Configuración guardada correctamente.');
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al guardar.', 'error');
        } finally { setSaving(false); }
    };

    // Change password
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
                new_password: pwdForm.new_password,
            });
            showToast('Contraseña cambiada correctamente.');
            setPwdForm({ current_password: '', new_password: '', confirm_password: '' });
        } catch (err) {
            showToast(err.response?.data?.message || 'Error al cambiar contraseña.', 'error');
        } finally { setPwdSaving(false); }
    };

    return (
        <div className="set-page fade-in">
            {/* Toast */}
            {toast && (
                <div className={`workers-toast ${toast.type === 'error' ? 'workers-toast--error' : ''}`}>
                    {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                    <span>{toast.msg}</span>
                </div>
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
                            {/* ── Company Info ── */}
                            {activeSection === 'company' && (
                                <div className="set-section">
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
                                        <button className="set-save-btn" onClick={handleSave} disabled={saving}>
                                            {saving ? <><RefreshCw size={14} className="rpt-spin" /> Guardando...</> : <><Save size={14} /> Guardar Empresa</>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Invoicing ── */}
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

                                    {settings?.invoice_next_number && (
                                        <div className="set-info-box">
                                            <p>Próximo número de factura: <strong>{settings.invoice_prefix}-{String(settings.invoice_next_number).padStart(3, '0')}</strong></p>
                                            <p className="set-hint">Este número se incrementa automáticamente al generar facturas.</p>
                                        </div>
                                    )}

                                    <div className="set-actions">
                                        <button className="set-save-btn" onClick={handleSave} disabled={saving}>
                                            {saving ? <><RefreshCw size={14} className="rpt-spin" /> Guardando...</> : <><Save size={14} /> Guardar Facturación</>}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ── Account / Password ── */}
                            {activeSection === 'account' && (
                                <div className="set-section">
                                    <h2 className="set-section__title"><Lock size={17} /> Cuenta de Administrador</h2>
                                    <p className="set-section__desc">Cambia la contraseña de tu cuenta de administrador.</p>

                                    <div className="set-pwd-box">
                                        {[
                                            { key: 'current_password', label: 'Contraseña Actual', pwdKey: 'current' },
                                            { key: 'new_password', label: 'Nueva Contraseña', pwdKey: 'new' },
                                            { key: 'confirm_password', label: 'Confirmar Nueva', pwdKey: 'confirm' },
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
