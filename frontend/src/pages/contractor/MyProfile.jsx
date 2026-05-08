import { useState, useEffect, useRef } from 'react';
import useApi from '../../hooks/useApi';
import {
    User, Shield, FileText, Pen, Check, CheckCircle, Circle,
    ChevronRight, ChevronLeft, Trash2, Save, AlertCircle,
    Loader, Phone, Home, UserCheck, FileImage, Hash,
    Eye, EyeOff, Building2,
} from 'lucide-react';
import DocumentUploader from '../../components/DocumentUploader';
import './MyProfile.css';

// ─── Step definitions ─────────────────────────────────────────
const STEPS = [
    { id: 'personal',   label: 'Información Personal', icon: User      },
    { id: 'emergency',  label: 'Contacto Emergencia',  icon: Shield    },
    { id: 'documents',  label: 'Documentos',           icon: FileText  },
    { id: 'w9',         label: 'Formulario W-9',       icon: Building2 },
    { id: 'contract',   label: 'Contrato',             icon: Pen       },
];

// Only two required uploads
const REQUIRED_DOCS = [
    { type: 'id_photo',  label: 'Foto de ID (frente)',    icon: FileImage, hint: 'Frente de tu documento de identificación' },
    { type: 'ssn_photo', label: 'Foto de Seguro Social',  icon: FileImage, hint: 'Foto de tu tarjeta de Social Security'     },
];

// Contract sections for display
const CONTRACT_SECTIONS = [
    { num: '1', title: 'Descripción de Servicios', body: 'El Contratista proveerá horas de trabajo como Plomero y/o Electricista. El Contratista tiene el derecho de control sobre cómo realizará los Servicios.' },
    { num: '2', title: 'Pago por Servicios', body: 'El pago será proporcional a las horas trabajadas en la semana. El Contratista es responsable de todos sus impuestos, contribuciones al Seguro Social y otros impuestos de nómina.' },
    { num: '3', title: 'Terminación', body: 'El acuerdo termina cuando la colaboración del Contratista ya no sea necesaria. El Contratista puede terminar este Acuerdo "a voluntad".' },
    { num: '4', title: 'Relación de las Partes', body: 'El Contratista es un contratista independiente y no un empleado. No se proveerán beneficios de empleado. La relación es no exclusiva.' },
    { num: '5', title: 'Sin Horario Fijo', body: 'El Contratista no tiene horario de trabajo fijo. No hay requisito de trabajar tiempo completo.' },
    { num: '6', title: 'Gastos', body: 'Los gastos de negocio y viaje son pagados por el Contratista.' },
    { num: '7', title: 'Confidencialidad', body: 'El Contratista no divulgará información confidencial del Receptor en ningún momento, incluso después de la terminación de este Acuerdo.' },
    { num: '8', title: 'Lesiones', body: 'El Contratista reconoce su obligación de obtener cobertura de seguro apropiada y renuncia a derechos de recuperación por lesiones por negligencia propia.' },
    { num: '9', title: 'Indemnización', body: 'El Contratista acuerda indemnizar y eximir al Receptor de todas las reclamaciones y gastos resultantes de los actos u omisiones del Contratista.' },
    { num: '10', title: 'Ley Aplicable', body: 'Este Acuerdo se rige por las leyes del Estado de Georgia.' },
];

// ─── Signature canvas ──────────────────────────────────────────
function SignatureCanvas({ onSave, label = 'Firma con el dedo o mouse' }) {
    const canvasRef = useRef(null);
    const drawing   = useRef(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [saved, setSaved]       = useState(false);
    const [preview, setPreview]   = useState(null);

    const getPos = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const src  = e.touches ? e.touches[0] : e;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    const startDraw = (e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const pos = getPos(e, canvas);
        ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
        drawing.current = true; setHasDrawn(true); setSaved(false);
    };
    const draw = (e) => {
        e.preventDefault();
        if (!drawing.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1a1a2e';
        const pos = getPos(e, canvas);
        ctx.lineTo(pos.x, pos.y); ctx.stroke();
    };
    const stopDraw = (e) => { e.preventDefault(); drawing.current = false; };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false); setSaved(false); setPreview(null); onSave(null);
    };

    const saveSignature = () => {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setPreview(dataUrl); setSaved(true); onSave(dataUrl);
    };

    return (
        <div className="mpr-sig-wrap">
            {preview && saved ? (
                <div className="mpr-sig-saved">
                    <img src={preview} alt="Firma" className="mpr-sig-preview-img" />
                    <div className="mpr-sig-saved-label"><Check size={14} /> Firma guardada</div>
                    <button className="mpr-sig-clear" onClick={() => { setPreview(null); setSaved(false); setHasDrawn(false); onSave(null); }}>
                        <Trash2 size={13} /> Firmar de nuevo
                    </button>
                </div>
            ) : (
                <>
                    <div className="mpr-sig-hint">{label}</div>
                    <canvas
                        ref={canvasRef} className="mpr-sig-canvas"
                        width={520} height={150}
                        onMouseDown={startDraw} onMouseMove={draw}
                        onMouseUp={stopDraw}    onMouseLeave={stopDraw}
                        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
                    />
                    <div className="mpr-sig-actions">
                        <button className="mpr-sig-clear" onClick={clearCanvas} disabled={!hasDrawn}>
                            <Trash2 size={13} /> Limpiar
                        </button>
                        <button className="mpr-sig-save" onClick={saveSignature} disabled={!hasDrawn}>
                            <Save size={13} /> Guardar firma
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Step progress bar ─────────────────────────────────────────
function StepBar({ steps, current, completedSteps }) {
    return (
        <div className="mpr-stepbar">
            {steps.map((step, i) => {
                const done   = completedSteps.includes(step.id);
                const active = step.id === current;
                const Icon   = step.icon;
                return (
                    <div key={step.id} className={`mpr-step${active ? ' mpr-step--active' : ''}${done ? ' mpr-step--done' : ''}`}>
                        <div className="mpr-step__circle">
                            {done ? <Check size={12} /> : <Icon size={12} />}
                        </div>
                        <span className="mpr-step__label">{step.label}</span>
                        {i < steps.length - 1 && <div className="mpr-step__line" />}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Toast ─────────────────────────────────────────────────────
function Toast({ msg, type }) {
    if (!msg) return null;
    return (
        <div className={`mpr-toast mpr-toast--${type}`}>
            {type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            {msg}
        </div>
    );
}

// ─── Field ─────────────────────────────────────────────────────
function Field({ label, children, required }) {
    return (
        <div className="mpr-field">
            <label className="mpr-field__label">{label}{required && <span className="mpr-field__req">*</span>}</label>
            {children}
        </div>
    );
}

// ─── Main component ────────────────────────────────────────────
export default function MyProfile() {
    const { get, patch, post } = useApi();
    const [worker, setWorker]   = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');
    const [step, setStep]       = useState('personal');
    const [completed, setCompleted] = useState([]);
    const [saving, setSaving]   = useState(false);
    const [toast, setToast]     = useState(null);

    // Forms
    const [form, setForm] = useState({
        phone: '', address: '', city: '', state: '', zip_code: '',
        emergency_contact_name: '', emergency_contact_phone: '',
    });

    // W-9 data
    const [ssn, setSsn]           = useState('');
    const [showSsn, setShowSsn]   = useState(false);
    const [w9Sig, setW9Sig]       = useState(null);

    // Contract data
    const [contractSig, setContractSig] = useState(null);
    const [contractRead, setContractRead] = useState(false);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Load profile
    useEffect(() => {
        (async () => {
            try {
                const res = await get('/workers/me');
                const w = res?.data || null;
                setWorker(w);
                if (w) {
                    setForm({
                        phone:                   w.phone || '',
                        address:                 w.address || '',
                        city:                    w.city || '',
                        state:                   w.state || '',
                        zip_code:                w.zip_code || '',
                        emergency_contact_name:  w.emergency_contact_name || '',
                        emergency_contact_phone: w.emergency_contact_phone || '',
                    });
                    const done = [];
                    if (w.phone && w.address && w.city) done.push('personal');
                    if (w.emergency_contact_name && w.emergency_contact_phone) done.push('emergency');
                    setCompleted(done);
                }
            } catch { setError('No se pudo cargar el perfil.'); }
            finally  { setLoading(false); }
        })();
    }, []);

    const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    // Format SSN input as XXX-XX-XXXX
    const handleSsnChange = (e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
        let formatted = digits;
        if (digits.length > 5) formatted = `${digits.slice(0,3)}-${digits.slice(3,5)}-${digits.slice(5)}`;
        else if (digits.length > 3) formatted = `${digits.slice(0,3)}-${digits.slice(3)}`;
        setSsn(formatted);
    };

    const savePersonalStep = async (stepId) => {
        setSaving(true);
        try {
            const res = await patch('/workers/me', form);
            setWorker(res?.data || worker);
            if (!completed.includes(stepId)) setCompleted(p => [...p, stepId]);
            showToast('Guardado correctamente');
            return true;
        } catch (e) {
            showToast(e?.response?.data?.message || 'Error al guardar', 'error');
            return false;
        } finally { setSaving(false); }
    };

    const generateDocs = async () => {
        if (!ssn || ssn.replace(/\D/g, '').length < 9) {
            showToast('Ingresa tu SSN completo (9 dígitos)', 'error');
            return false;
        }
        if (!w9Sig) {
            showToast('Firma el formulario W-9', 'error');
            return false;
        }
        if (!contractSig) {
            showToast('Firma el contrato', 'error');
            return false;
        }
        setSaving(true);
        try {
            // FIX W9-SIG: enviar w9Sig para W-9 y contractSig para contrato (antes ambos usaban contractSig)
            await post('/workers/me/generate-docs', {
                ssn:              ssn.replace(/\D/g, ''),
                signatureDataUrl: w9Sig,        // firma del W-9
                contractSigUrl:   contractSig,  // firma del contrato
                w9SignDate:       new Date().toISOString(),
                contractSignDate: new Date().toISOString(),
            });
            if (!completed.includes('w9'))       setCompleted(p => [...p, 'w9']);
            if (!completed.includes('contract')) setCompleted(p => [...p, 'contract']);
            showToast('¡Documentos generados! El admin los revisará pronto.');
            return true;
        } catch (e) {
            showToast(e?.response?.data?.message || 'Error al generar documentos', 'error');
            return false;
        } finally { setSaving(false); }
    };

    const goNext = async () => {
        const idx = STEPS.findIndex(s => s.id === step);

        if (step === 'personal' || step === 'emergency') {
            if (step === 'personal' && (!form.phone || !form.address || !form.city)) {
                showToast('Completa teléfono, dirección y ciudad', 'error');
                return;
            }
            if (step === 'emergency' && (!form.emergency_contact_name || !form.emergency_contact_phone)) {
                showToast('Completa nombre y teléfono de emergencia', 'error');
                return;
            }
            const ok = await savePersonalStep(step);
            if (!ok) return;
        }

        if (step === 'documents') {
            if (!completed.includes('documents')) setCompleted(p => [...p, 'documents']);
        }

        if (step === 'w9') {
            if (!ssn || ssn.replace(/\D/g, '').length < 9) {
                showToast('Ingresa tu SSN completo', 'error'); return;
            }
            if (!w9Sig) {
                showToast('Firma el W-9 antes de continuar', 'error'); return;
            }
            if (!completed.includes('w9')) setCompleted(p => [...p, 'w9']);
        }

        if (step === 'contract') {
            if (!contractRead) {
                showToast('Lee el contrato completo antes de firmar', 'error'); return;
            }
            if (!contractSig) {
                showToast('Firma el contrato antes de finalizar', 'error'); return;
            }
            // Generate both docs on final step
            const ok = await generateDocs();
            if (!ok) return;
            showToast('¡Perfil completado! El administrador revisará tus documentos.');
        }

        if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].id);
    };

    const goPrev = () => {
        const idx = STEPS.findIndex(s => s.id === step);
        if (idx > 0) setStep(STEPS[idx - 1].id);
    };

    if (loading) return <div className="mpr-loading"><Loader size={18} className="mpr-spin" /> Cargando perfil...</div>;
    if (error)   return <div className="mpr-error"><AlertCircle size={16} /> {error}</div>;
    if (!worker) return <div className="mpr-error">Perfil no encontrado.</div>;

    const fullName  = `${worker.first_name} ${worker.last_name}`;
    const initials  = (worker.first_name?.[0] || '') + (worker.last_name?.[0] || '');
    const tradeName = worker.trade?.name_es || worker.trade?.name || '—';
    const email     = worker.user?.email || '—';
    const allDone   = STEPS.every(s => completed.includes(s.id));
    const stepIdx   = STEPS.findIndex(s => s.id === step);
    const isLast    = stepIdx === STEPS.length - 1;

    return (
        <div className="mpr-page fade-in">
            <Toast msg={toast?.msg} type={toast?.type} />

            {/* Hero */}
            <div className="mpr-hero card">
                <div className="mpr-avatar">{initials.toUpperCase()}</div>
                <div className="mpr-hero-info">
                    <div className="mpr-name">{fullName}</div>
                    <div className="mpr-trade">{tradeName} · {email}</div>
                    <div className="mpr-code"><Hash size={12} /> {worker.worker_code}</div>
                </div>
                {allDone && <div className="mpr-complete-badge"><CheckCircle size={14} /> Perfil completo</div>}
            </div>

            {/* Progress bar */}
            <StepBar steps={STEPS} current={step} completedSteps={completed} />

            {/* Step card */}
            <div className="mpr-step-card card">

                {/* ── PASO 1: Información personal ── */}
                {step === 'personal' && (
                    <div className="mpr-step-body">
                        <div className="mpr-step-title"><User size={16} /> Información Personal</div>
                        <p className="mpr-step-sub">Esta información aparecerá en tus documentos oficiales.</p>
                        <div className="mpr-fields">
                            <Field label="Teléfono" required>
                                <div className="mpr-input-wrap">
                                    <Phone size={14} className="mpr-input-icon" />
                                    <input name="phone" value={form.phone} onChange={handleChange} placeholder="(555) 000-0000" type="tel" />
                                </div>
                            </Field>
                            <Field label="Dirección" required>
                                <div className="mpr-input-wrap">
                                    <Home size={14} className="mpr-input-icon" />
                                    <input name="address" value={form.address} onChange={handleChange} placeholder="123 Main St" />
                                </div>
                            </Field>
                            <div className="mpr-fields-row">
                                <Field label="Ciudad" required>
                                    <input className="mpr-input" name="city" value={form.city} onChange={handleChange} placeholder="Savannah" />
                                </Field>
                                <Field label="Estado">
                                    <input className="mpr-input" name="state" value={form.state} onChange={handleChange} placeholder="GA" maxLength={2} />
                                </Field>
                                <Field label="ZIP">
                                    <input className="mpr-input" name="zip_code" value={form.zip_code} onChange={handleChange} placeholder="31401" maxLength={10} />
                                </Field>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PASO 2: Contacto de emergencia ── */}
                {step === 'emergency' && (
                    <div className="mpr-step-body">
                        <div className="mpr-step-title"><Shield size={16} /> Contacto de Emergencia</div>
                        <p className="mpr-step-sub">Esta persona será contactada en caso de emergencia en el trabajo.</p>
                        <div className="mpr-fields">
                            <Field label="Nombre completo" required>
                                <div className="mpr-input-wrap">
                                    <UserCheck size={14} className="mpr-input-icon" />
                                    <input name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleChange} placeholder="Nombre del contacto" />
                                </div>
                            </Field>
                            <Field label="Teléfono de emergencia" required>
                                <div className="mpr-input-wrap">
                                    <Phone size={14} className="mpr-input-icon" />
                                    <input name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={handleChange} placeholder="(555) 000-0000" type="tel" />
                                </div>
                            </Field>
                        </div>
                    </div>
                )}

                {/* ── PASO 3: Documentos ── */}
                {step === 'documents' && (
                    <div className="mpr-step-body">
                        <div className="mpr-step-title"><FileText size={16} /> Documentos de Identificación</div>
                        <p className="mpr-step-sub">Sube las fotos de tus documentos de identidad. El administrador los verificará antes de tu primer turno.</p>
                        <div className="mpr-doc-list">
                            {REQUIRED_DOCS.map((doc, i) => (
                                <div key={i} className="mpr-doc-item">
                                    <div className="mpr-doc-item__header">
                                        <div className="mpr-doc-item__icon"><doc.icon size={15} /></div>
                                        <div>
                                            <div className="mpr-doc-item__label">{doc.label}</div>
                                            <div className="mpr-doc-item__hint">{doc.hint}</div>
                                        </div>
                                    </div>
                                    <div className="mpr-doc-item__uploader">
                                        <DocumentUploader ownerType="worker" ownerId={worker.id} filterType={doc.type} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── PASO 4: W-9 ── */}
                {step === 'w9' && (
                    <div className="mpr-step-body">
                        <div className="mpr-step-title"><Building2 size={16} /> Formulario W-9</div>
                        <p className="mpr-step-sub">Revisa tus datos, ingresa tu número de Seguro Social y firma. El W-9 se generará como PDF oficial.</p>

                        <div className="mpr-w9-preview card">
                            <div className="mpr-w9-header">
                                <span className="mpr-w9-title">Form W-9</span>
                                <span className="mpr-w9-subtitle">Request for Taxpayer Identification Number</span>
                            </div>
                            <div className="mpr-w9-fields">
                                <div className="mpr-w9-row">
                                    <span className="mpr-w9-label">Name</span>
                                    <span className="mpr-w9-val">{fullName}</span>
                                </div>
                                <div className="mpr-w9-row">
                                    <span className="mpr-w9-label">Address</span>
                                    <span className="mpr-w9-val">{form.address || '—'}, {form.city || '—'}, {form.state || '—'} {form.zip_code || ''}</span>
                                </div>
                                <div className="mpr-w9-row">
                                    <span className="mpr-w9-label">Tax Classification</span>
                                    <span className="mpr-w9-val mpr-w9-badge">☑ Individual / Sole Proprietor</span>
                                </div>
                            </div>
                        </div>

                        <div className="mpr-fields">
                            <Field label="Social Security Number (SSN)" required>
                                <div className="mpr-input-wrap">
                                    <input
                                        type={showSsn ? 'text' : 'password'}
                                        value={ssn}
                                        onChange={handleSsnChange}
                                        placeholder="XXX-XX-XXXX"
                                        className="mpr-ssn-input"
                                        maxLength={11}
                                        autoComplete="off"
                                    />
                                    <button type="button" className="mpr-ssn-toggle" onClick={() => setShowSsn(s => !s)} tabIndex={-1}>
                                        {showSsn ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                <div className="mpr-ssn-hint">Tu SSN es encriptado y solo usado para el W-9. Nunca se comparte.</div>
                            </Field>
                        </div>

                        <div className="mpr-sig-section-label">Firma del W-9</div>
                        <SignatureCanvas onSave={setW9Sig} label="Dibuja tu firma para el W-9" />

                        {w9Sig && (
                            <div className="mpr-sig-consent">
                                <Check size={13} /> Al firmar certificas que el número TIN proporcionado es correcto y que no estás sujeto a retención de respaldo.
                            </div>
                        )}
                    </div>
                )}

                {/* ── PASO 5: Contrato ── */}
                {step === 'contract' && (
                    <div className="mpr-step-body">
                        <div className="mpr-step-title"><Pen size={16} /> Contrato de Contratista Independiente</div>
                        <p className="mpr-step-sub">Lee el contrato completo. Al hacer scroll hasta el final podrás firmarlo.</p>

                        <div className="mpr-contract-box" onScroll={(e) => {
                            const el = e.currentTarget;
                            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setContractRead(true);
                        }}>
                            <div className="mpr-contract-header">
                                <div className="mpr-contract-title">INDEPENDENT CONTRACTOR AGREEMENT</div>
                                <div className="mpr-contract-parties">
                                    <strong>HM Plumbing &amp; Electric Staffing LLC</strong> ("Recipient")<br />
                                    500 Lucas Dr, Savannah, GA 31406<br /><br />
                                    y<br /><br />
                                    <strong>{fullName}</strong> ("Contractor")<br />
                                    {form.address}, {form.city}, {form.state} {form.zip_code}
                                </div>
                            </div>

                            {CONTRACT_SECTIONS.map(s => (
                                <div key={s.num} className="mpr-contract-section">
                                    <span className="mpr-contract-sec-title">{s.num}. {s.title}.</span>{' '}
                                    {s.body}
                                </div>
                            ))}

                            <div className="mpr-contract-scroll-hint">
                                {contractRead
                                    ? <span className="mpr-contract-read"><Check size={13} /> Contrato leído</span>
                                    : '↓ Sigue leyendo para habilitar la firma'}
                            </div>
                        </div>

                        {contractRead && (
                            <>
                                <div className="mpr-sig-section-label">Firma del Contrato</div>
                                <SignatureCanvas onSave={setContractSig} label="Dibuja tu firma para el contrato" />
                                {contractSig && (
                                    <div className="mpr-sig-consent">
                                        <Check size={13} /> Al firmar confirmas que has leído y aceptas todos los términos del contrato y que la información proporcionada es verídica.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Nav buttons */}
                <div className="mpr-step-nav">
                    <button className="mpr-btn mpr-btn--secondary" onClick={goPrev} disabled={stepIdx === 0}>
                        <ChevronLeft size={16} /> Anterior
                    </button>
                    <button className="mpr-btn mpr-btn--primary" onClick={goNext} disabled={saving}>
                        {saving
                            ? <><Loader size={14} className="mpr-spin" /> Procesando...</>
                            : isLast
                                ? <><Check size={14} /> Finalizar</>
                                : <>Siguiente <ChevronRight size={16} /></>
                        }
                    </button>
                </div>
            </div>

            {/* Summary */}
            {completed.length > 0 && (
                <div className="mpr-summary card">
                    <div className="mpr-summary__title">Estado del perfil</div>
                    {STEPS.map(s => (
                        <div key={s.id} className={`mpr-summary__row${completed.includes(s.id) ? ' mpr-summary__row--done' : ''}`}>
                            {completed.includes(s.id)
                                ? <CheckCircle size={14} className="mpr-summary__icon mpr-summary__icon--done" />
                                : <Circle      size={14} className="mpr-summary__icon" />}
                            <span>{s.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
