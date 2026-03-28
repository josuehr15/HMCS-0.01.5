import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Plus, X, Search, ChevronDown, CheckCircle, Clock,
    DollarSign, Send, FileText, Eye, Trash2, Edit2,
    AlertCircle, CreditCard, BarChart2, Download, RotateCcw,
    Building2, Calendar, RefreshCw, PrinterIcon
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import './Invoices.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt$ = v => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';
const fmtDateRange = (s, e) => {
    if (!s || !e) return '—';
    const ds = new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const de = new Date(e + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${ds} – ${de}`;
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    draft: { label: 'Borrador', cls: 'inv-badge--draft', icon: '📝' },
    pending_approval: { label: 'Pen. Aprobación', cls: 'inv-badge--pending', icon: '⏳' },
    approved: { label: 'Aprobada', cls: 'inv-badge--approved', icon: '✅' },
    sent: { label: 'Enviada', cls: 'inv-badge--sent', icon: '📧' },
    paid: { label: 'Pagada', cls: 'inv-badge--paid', icon: '💰' },
    overdue: { label: 'Vencida', cls: 'inv-badge--overdue', icon: '🔴' },
};

function StatusBadge({ status }) {
    const c = STATUS_CONFIG[status] || { label: status, cls: '', icon: '?' };
    return <span className={`inv-badge ${c.cls}`}>{c.icon} {c.label}</span>;
}

// ─── Inline Invoice Preview (the "document") ─────────────────────────────────
function InvoiceDocument({ invoice, company, editable, onNotesChange, onAdjChange }) {
    const client = invoice.client || {};
    const project = invoice.project || {};
    const lines = invoice.lines || [];

    // Build calendar
    const weekStart = invoice.week_start_date ? new Date(invoice.week_start_date + 'T00:00:00') : null;
    const DAYS_H = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const weekDays = weekStart ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
    }) : [];

    // Mark days that had entries (if we have lines with detailed entries — approximate via lines existing)
    // We'll just highlight Mon-Fri by default; real data comes from the HTML endpoint for PDF
    const workedDaySet = useMemo(() => {
        const s = new Set();
        // Lines don't carry per-day data here; highlight weekdays as "worked"
        weekDays.forEach((d, i) => { if (i < 5) s.add(i); }); // Mon-Fri
        return s;
    }, [invoice.id]);

    const subtotal = parseFloat(invoice.subtotal || 0);
    const perDiemTotal = parseFloat(invoice.per_diem_total || 0);
    const adj = parseFloat(invoice.adjustments || 0);
    const total = parseFloat(invoice.total || 0);

    return (
        <div className="inv-doc">
            {/* Header */}
            <div className="inv-doc__header">
                <div>
                    <h1 className="inv-doc__title">I N V O I C E</h1>
                    <p className="inv-doc__co">{company?.company_name || 'HM Construction Staffing LLLP'}</p>
                    <p className="inv-doc__co-addr">
                        {company?.address}<br />
                        {company?.city}, {company?.state} {company?.zip}<br />
                        {company?.email}<br />
                        {company?.phone}
                    </p>
                </div>
                <div className="inv-doc__meta">
                    <div className="inv-doc__meta-row"><span>Invoice no.:</span><strong>{invoice.invoice_number}</strong></div>
                    <div className="inv-doc__meta-row"><span>Invoice date:</span><strong>{fmtDate(invoice.invoice_date)}</strong></div>
                    <div className="inv-doc__meta-row"><span>Due date:</span><strong>{fmtDate(invoice.due_date)}</strong></div>
                    <span className="inv-doc__status-chip"><StatusBadge status={invoice.status} /></span>
                </div>
            </div>
            <hr className="inv-doc__divider" />

            {/* Bill to */}
            <div className="inv-doc__bill">
                <div>
                    <p className="inv-doc__section-label">Bill to</p>
                    <p className="inv-doc__bill-name">{client.company_name || '—'}</p>
                    {client.address && <p className="inv-doc__bill-addr">{client.address}</p>}
                    {client.city && <p className="inv-doc__bill-addr">{client.city}, {client.state} {client.zip}</p>}
                </div>
                <div>
                    <p className="inv-doc__section-label">Project</p>
                    <p className="inv-doc__bill-name">{project.name || '—'}</p>
                    {project.address && <p className="inv-doc__bill-addr">{project.address}</p>}
                </div>
            </div>
            <hr className="inv-doc__divider" />

            {/* Week calendar */}
            {weekDays.length > 0 && (
                <div className="inv-doc__week-box">
                    <p className="inv-doc__week-title">
                        📅 WEEK WORKED: {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} — {new Date(invoice.week_end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <div className="inv-doc__cal">
                        {weekDays.map((d, i) => (
                            <div key={i} className={`inv-doc__cal-day ${workedDaySet.has(i) ? 'inv-doc__cal-day--worked' : 'inv-doc__cal-day--off'}`}>
                                <span className="inv-doc__cal-label">{DAYS_H[i]}</span>
                                <span className="inv-doc__cal-num">{d.getDate()}</span>
                            </div>
                        ))}
                    </div>
                    <p className="inv-doc__cal-legend">■ = Days worked &nbsp;&nbsp; □ = Off</p>
                </div>
            )}

            {/* Lines table */}
            <table className="inv-doc__table">
                <thead>
                    <tr>
                        <th>Service</th>
                        <th>Contractor</th>
                        <th className="r">Reg Hrs</th>
                        <th className="r">OT Hrs</th>
                        <th className="r">Per Diem</th>
                        <th className="r">Rate</th>
                        <th className="r">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {lines.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9CA3AF', padding: '20px' }}>Sin líneas</td></tr>
                    )}
                    {lines.map((line, i) => (
                        <tr key={i}>
                            <td>{line.trade?.name || '—'}</td>
                            <td>{line.worker?.first_name} {line.worker?.last_name}</td>
                            <td className="r">{parseFloat(line.regular_hours || 0).toFixed(2)}</td>
                            <td className="r">{parseFloat(line.overtime_hours || 0).toFixed(2)}</td>
                            <td className="r">{fmt$(line.per_diem_amount)}</td>
                            <td className="r">{fmt$(line.rate)}</td>
                            <td className="r bold">{fmt$(line.line_total || line.amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div className="inv-doc__totals">
                <div className="inv-doc__totals-inner">
                    <div className="inv-doc__total-row"><span>Subtotal (labor):</span><span>{fmt$(subtotal)}</span></div>
                    <div className="inv-doc__total-row"><span>Per Diem:</span><span>{fmt$(perDiemTotal)}</span></div>
                    <div className="inv-doc__total-row">
                        <span>Adjustments:</span>
                        {editable
                            ? <input type="number" className="inv-adj-input" value={adj} step="0.01"
                                onChange={e => onAdjChange && onAdjChange(parseFloat(e.target.value) || 0)} />
                            : <span>{fmt$(adj)}</span>
                        }
                    </div>
                    <div className="inv-doc__total-row inv-doc__total-row--grand">
                        <span>TOTAL:</span>
                        <span>{fmt$(editable ? subtotal + perDiemTotal + adj : total)}</span>
                    </div>
                </div>
            </div>

            {/* Notes */}
            <div className="inv-doc__notes">
                <p className="inv-doc__section-label">Note to customer</p>
                {editable
                    ? <textarea className="inv-notes-input" rows={3} value={invoice.notes || ''} onChange={e => onNotesChange && onNotesChange(e.target.value)} />
                    : <p className="inv-doc__notes-text">{invoice.notes || '—'}</p>
                }
            </div>
            <div className="inv-doc__footer">
                Payment terms: Net {company?.payment_terms_days || 14} days<br />
                {company?.payment_instructions || 'Please make checks payable to: HM Construction Staffing LLLP'}
            </div>
        </div>
    );
}

// ─── Invoice Preview Modal ────────────────────────────────────────────────────
function InvoiceModal({ invoice: initInvoice, company, api, showToast, onClose, onUpdated, onDeleted }) {
    const { put, patch, del } = api;
    const [invoice, setInvoice] = useState(initInvoice);
    const [editMode, setEditMode] = useState(false);
    const [notes, setNotes] = useState(initInvoice.notes || '');
    const [adj, setAdj] = useState(parseFloat(initInvoice.adjustments || 0));
    const [loading, setLoading] = useState('');
    const [payModal, setPayModal] = useState(false);
    const [payForm, setPayForm] = useState({ payment_method: 'check', payment_reference: '' });

    useEffect(() => {
        const h = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const doStatus = async (status, extra = {}) => {
        setLoading(status);
        try {
            const res = await patch(`/invoices/${invoice.id}/status`, { status, ...extra });
            const upd = res.data?.data || res.data || res;
            setInvoice(upd);
            onUpdated(upd);
            showToast(`Factura marcada como ${STATUS_CONFIG[status]?.label || status}.`);
        } catch { showToast('Error al cambiar estado.', 'error'); }
        finally { setLoading(''); }
    };

    const doSave = async () => {
        setLoading('save');
        try {
            const res = await put(`/invoices/${invoice.id}`, { notes, adjustments: adj });
            const upd = res.data?.data || res.data || res;
            setInvoice(upd);
            onUpdated(upd);
            setEditMode(false);
            showToast('Factura actualizada.');
        } catch { showToast('Error al guardar.', 'error'); }
        finally { setLoading(''); }
    };

    const doDelete = async () => {
        if (!window.confirm('¿Eliminar esta factura? Esta acción no se puede deshacer.')) return;
        setLoading('delete');
        try {
            await del(`/invoices/${invoice.id}`);
            onDeleted(invoice.id);
            onClose();
            showToast('Factura eliminada.');
        } catch { showToast('Error al eliminar.', 'error'); }
        finally { setLoading(''); }
    };

    const doSendEmail = async () => {
        setLoading('send');
        try {
            const res = await api.post(`/invoices/${invoice.id}/send-email`, {});
            const upd = res.data?.data || res.data || res;
            setInvoice(upd);
            onUpdated(upd);
            showToast('Factura enviada al cliente.');
        } catch { showToast('Error al enviar.', 'error'); }
        finally { setLoading(''); }
    };

    const doPrint = () => {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        window.open(`${apiBase}/invoices/${invoice.id}/html?token=${token}`, '_blank');
    };

    const st = invoice.status;

    return (
        <div className="inv-modal-overlay" onClick={onClose}>
            <div className="inv-modal" onClick={e => e.stopPropagation()}>
                {/* Modal header / actions */}
                <div className="inv-modal__header">
                    <div className="inv-modal__title-row">
                        <h2 className="inv-modal__title">Factura #{invoice.invoice_number}</h2>
                        <StatusBadge status={st} />
                    </div>
                    <div className="inv-modal__actions">
                        {/* Print/PDF */}
                        <button className="inv-action-btn inv-action-btn--ghost" onClick={doPrint} title="Ver/Imprimir PDF">
                            <PrinterIcon size={14} /> PDF
                        </button>

                        {/* Edit draft */}
                        {['draft', 'pending_approval'].includes(st) && !editMode && (
                            <button className="inv-action-btn inv-action-btn--ghost" onClick={() => setEditMode(true)}>
                                <Edit2 size={14} /> Editar
                            </button>
                        )}
                        {editMode && (
                            <>
                                <button className="inv-action-btn inv-action-btn--primary" onClick={doSave} disabled={loading === 'save'}>
                                    {loading === 'save' ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button className="inv-action-btn inv-action-btn--ghost" onClick={() => setEditMode(false)}>Cancelar</button>
                            </>
                        )}

                        {/* State transitions */}
                        {st === 'draft' && (
                            <button className="inv-action-btn inv-action-btn--accent" onClick={() => doStatus('pending_approval')} disabled={!!loading}>
                                <Send size={13} /> Enviar a aprobación
                            </button>
                        )}
                        {st === 'pending_approval' && (
                            <>
                                <button className="inv-action-btn inv-action-btn--success" onClick={() => doStatus('approved')} disabled={!!loading}>
                                    <CheckCircle size={13} /> Aprobar
                                </button>
                                <button className="inv-action-btn inv-action-btn--danger" onClick={() => doStatus('draft')} disabled={!!loading}>
                                    <RotateCcw size={13} /> Rechazar
                                </button>
                            </>
                        )}
                        {st === 'approved' && (
                            <button className="inv-action-btn inv-action-btn--accent" onClick={doSendEmail} disabled={!!loading}>
                                <Send size={13} /> {loading === 'send' ? 'Enviando...' : 'Enviar al cliente'}
                            </button>
                        )}
                        {(st === 'sent' || st === 'approved') && (
                            <button className="inv-action-btn inv-action-btn--success" onClick={() => setPayModal(true)} disabled={!!loading}>
                                <DollarSign size={13} /> Marcar pagada
                            </button>
                        )}
                        {['draft', 'pending_approval'].includes(st) && (
                            <button className="inv-action-btn inv-action-btn--danger" onClick={doDelete} disabled={!!loading}>
                                <Trash2 size={13} /> Eliminar
                            </button>
                        )}

                        <button className="inv-modal__close" onClick={onClose}><X size={18} /></button>
                    </div>
                </div>

                {/* Invoice document */}
                <div className="inv-modal__body">
                    <InvoiceDocument
                        invoice={{ ...invoice, notes: editMode ? notes : invoice.notes, adjustments: editMode ? adj : invoice.adjustments }}
                        company={company}
                        editable={editMode}
                        onNotesChange={setNotes}
                        onAdjChange={setAdj}
                    />
                </div>
            </div>

            {/* Pay modal */}
            {payModal && (
                <div className="inv-pay-overlay" onClick={() => setPayModal(false)}>
                    <div className="inv-pay-modal" onClick={e => e.stopPropagation()}>
                        <h3>Registrar Pago</h3>
                        <div className="wf-field">
                            <label className="wf-label">Método de pago</label>
                            <div className="workers-select-wrapper">
                                <select className="wf-select" value={payForm.payment_method} onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))}>
                                    <option value="check">Cheque</option>
                                    <option value="ach">ACH / Wire</option>
                                    <option value="cash">Efectivo</option>
                                    <option value="card">Tarjeta</option>
                                </select>
                                <ChevronDown size={13} className="workers-select__arrow" />
                            </div>
                        </div>
                        <div className="wf-field">
                            <label className="wf-label">Referencia / # Cheque</label>
                            <input className="wf-input" value={payForm.payment_reference} onChange={e => setPayForm(p => ({ ...p, payment_reference: e.target.value }))} placeholder="Ej: CHK-1042" />
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <button className="workers-btn-outline" onClick={() => setPayModal(false)}>Cancelar</button>
                            <button className="workers-btn-primary" onClick={async () => {
                                await doStatus('paid', payForm);
                                setPayModal(false);
                            }}>Confirmar Pago</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Generate Invoice Modal ────────────────────────────────────────────────────
function GenerateModal({ clients, api, showToast, onGenerated, onClose }) {
    const { get, post } = api;
    const [clientId, setClientId] = useState('');
    const [projects, setProjects] = useState([]);
    const [projectId, setProjectId] = useState('');
    const [loadingProj, setLoadingProj] = useState(false);
    const [weeks, setWeeks] = useState([]);
    const [weekIdx, setWeekIdx] = useState('');
    const [loadingWeeks, setLoadingWeeks] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState('');

    const fmt$ = v => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Load projects for selected client
    useEffect(() => {
        if (!clientId) { setProjects([]); setProjectId(''); setWeeks([]); setWeekIdx(''); return; }
        setLoadingProj(true);
        get(`/projects?client_id=${clientId}`)
            .then(r => setProjects(r.data || r))
            .catch(() => setProjects([]))
            .finally(() => setLoadingProj(false));
    }, [clientId]);

    // Load unbilled weeks for project
    useEffect(() => {
        if (!projectId) { setWeeks([]); setWeekIdx(''); return; }
        setLoadingWeeks(true);
        get(`/invoices/unbilled-weeks?project_id=${projectId}&client_id=${clientId}`)
            .then(r => setWeeks(r.data?.data || r.data || r))
            .catch(() => setWeeks([]))
            .finally(() => setLoadingWeeks(false));
    }, [projectId]);

    const selectedWeek = weeks[parseInt(weekIdx)];

    const handleGenerate = async () => {
        if (!clientId || !projectId || weekIdx === '') return setError('Selecciona cliente, proyecto y semana.');
        setGenerating(true); setError('');
        try {
            const res = await post('/invoices/generate', {
                client_id: parseInt(clientId),
                project_id: parseInt(projectId),
                week_start_date: selectedWeek.week_start_date,
                week_end_date: selectedWeek.week_end_date,
            });
            const inv = res.data?.data || res.data || res;
            onGenerated(inv);
            showToast(`Factura ${inv.invoice_number} generada.`);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Error al generar factura.');
        } finally { setGenerating(false); }
    };

    return (
        <div className="workers-modal-overlay" onClick={onClose}>
            <div className="workers-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                <div className="workers-modal__header">
                    <h2>⚡ Generar Nueva Factura</h2>
                    <button className="workers-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="workers-modal__body">
                    {error && <div className="wf-error">{error}</div>}

                    {/* Step 1: Cliente */}
                    <div className="wf-field">
                        <label className="wf-label">Cliente *</label>
                        <div className="workers-select-wrapper">
                            <select className="wf-select" value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(''); setWeekIdx(''); }}>
                                <option value="">Selecciona cliente...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                            </select>
                            <ChevronDown size={13} className="workers-select__arrow" />
                        </div>
                    </div>

                    {/* Step 2: Proyecto (habilitado tras selección de cliente) */}
                    <div className="wf-field">
                        <label className="wf-label" style={{ color: !clientId ? '#9CA3AF' : undefined }}>Proyecto *</label>
                        <div className="workers-select-wrapper">
                            <select className="wf-select" value={projectId} onChange={e => { setProjectId(e.target.value); setWeekIdx(''); }} disabled={!clientId}>
                                <option value="">
                                    {loadingProj ? 'Cargando proyectos...' : 'Selecciona proyecto...'}
                                </option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <ChevronDown size={13} className="workers-select__arrow" />
                        </div>
                    </div>

                    {/* Step 3: Semana (habilitado tras selección de proyecto) */}
                    <div className="wf-field">
                        <label className="wf-label" style={{ color: !projectId ? '#9CA3AF' : undefined }}>Semana con horas aprobadas *</label>
                        <div className="workers-select-wrapper">
                            <select className="wf-select" value={weekIdx} onChange={e => setWeekIdx(e.target.value)} disabled={!projectId}>
                                <option value="">
                                    {loadingWeeks ? 'Cargando semanas...' : weeks.length === 0 && projectId ? 'Sin semanas disponibles' : 'Selecciona semana...'}
                                </option>
                                {weeks.map((w, i) => <option key={i} value={i}>{w.label}</option>)}
                            </select>
                            <ChevronDown size={13} className="workers-select__arrow" />
                        </div>
                    </div>

                    {/* Mensaje: sin semanas aprobadas */}
                    {projectId && !loadingWeeks && weeks.length === 0 && (
                        <div className="inv-gen-no-weeks">
                            <AlertCircle size={15} />
                            <span>No hay semanas con horas aprobadas para este proyecto. Aprueba las horas primero en <strong>Registro de Horas</strong>.</span>
                        </div>
                    )}

                    {/* Preview en vivo al seleccionar semana */}
                    {selectedWeek && (
                        <div className="inv-gen-preview">
                            <p className="inv-gen-preview__title">📋 Preview de la factura</p>
                            <div className="inv-gen-preview__week">
                                <Calendar size={13} />
                                <strong>{selectedWeek.label}</strong>
                            </div>
                            {selectedWeek.workers && selectedWeek.workers.length > 0 ? (
                                <>
                                    <div className="inv-gen-preview__lines">
                                        {selectedWeek.workers.map((w, i) => (
                                            <div key={i} className="inv-gen-preview__line">
                                                <span className="inv-gen-preview__worker">{w.name || w.full_name || `Worker ${i + 1}`}</span>
                                                <span className="inv-gen-preview__hrs">
                                                    {w.regular_hours?.toFixed(1) || '—'}h reg
                                                    {w.overtime_hours > 0 ? ` + ${w.overtime_hours.toFixed(1)}h OT` : ''}
                                                </span>
                                                {w.estimated_total && (
                                                    <span className="inv-gen-preview__amt">{fmt$(w.estimated_total)}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {selectedWeek.estimated_subtotal && (
                                        <div className="inv-gen-preview__total">
                                            <span>Subtotal estimado:</span>
                                            <strong>{fmt$(selectedWeek.estimated_subtotal)}</strong>
                                        </div>
                                    )}
                                    {selectedWeek.per_diem_total > 0 && (
                                        <div className="inv-gen-preview__perdiem">
                                            <span>Per Diem (passthrough):</span>
                                            <span>{fmt$(selectedWeek.per_diem_total)}</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                                    ✅ El sistema calculará tarifas automáticamente desde <em>client_rates</em> al generar.
                                </p>
                            )}
                        </div>
                    )}
                </div>
                <div className="workers-modal__footer">
                    <button className="workers-btn-outline" onClick={onClose}>Cancelar</button>
                    <button className="workers-btn-primary" onClick={handleGenerate} disabled={generating || !clientId || !projectId || weekIdx === ''}>
                        {generating ? 'Generando...' : '⚡ Generar Factura →'}
                    </button>
                </div>
            </div>
        </div>
    );
}


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Invoices() {
    const { user } = useAuth();
    const api = useApi();
    const { get } = api;

    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [company, setCompany] = useState(null);
    const [stats, setStats] = useState({ total: 0, pending_amount: '0.00', sent_amount: '0.00', paid_this_month: '0.00' });
    const [loading, setLoading] = useState(false);
    const [filterClient, setFilterClient] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterMonth, setFilterMonth] = useState('');
    const [search, setSearch] = useState('');
    const [viewInvoice, setViewInvoice] = useState(null);
    const [showGenerate, setShowGenerate] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3800);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterClient && filterClient !== 'all') params.set('client_id', filterClient);
            if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
            if (filterMonth) params.set('month', filterMonth);

            const [invRes, statsRes] = await Promise.all([
                get(`/invoices?${params}`),
                get('/invoices/stats'),
            ]);
            setInvoices(invRes.data || invRes);
            setStats(statsRes.data?.data || statsRes.data || { total: 0, pending_amount: '0.00', sent_amount: '0.00', paid_this_month: '0.00' });
        } catch { showToast('Error al cargar facturas.', 'error'); }
        finally { setLoading(false); }
    }, [get, filterClient, filterStatus, filterMonth]);

    const fetchClients = useCallback(async () => {
        try { setClients(await get('/clients').then(r => r.data || r)); } catch { }
    }, [get]);

    const fetchCompany = useCallback(async () => {
        try { const r = await get('/invoices/company-settings'); setCompany(r.data?.data || r.data || r); } catch { }
    }, [get]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchClients(); fetchCompany(); }, [fetchClients, fetchCompany]);

    const displayInvoices = useMemo(() => {
        if (!search) return invoices;
        const q = search.toLowerCase();
        return invoices.filter(inv =>
            inv.invoice_number?.toLowerCase().includes(q) ||
            inv.client?.company_name?.toLowerCase().includes(q) ||
            inv.project?.name?.toLowerCase().includes(q)
        );
    }, [invoices, search]);

    const handleUpdated = upd => {
        setInvoices(prev => prev.map(i => i.id === upd.id ? upd : i));
        if (viewInvoice?.id === upd.id) setViewInvoice(upd);
        fetchData(); // refresh stats
    };
    const handleDeleted = id => {
        setInvoices(prev => prev.filter(i => i.id !== id));
        fetchData();
    };
    const handleGenerated = inv => {
        setInvoices(prev => [inv, ...prev]);
        setViewInvoice(inv);
        fetchData();
    };

    const STAT_CARDS = [
        { label: 'Total Facturas', value: stats.total, icon: <FileText size={18} />, color: '#2A6C95' },
        { label: 'Pendientes', value: fmt$(stats.pending_amount), icon: <Clock size={18} />, color: '#F59E0B' },
        { label: 'Enviadas', value: fmt$(stats.sent_amount), icon: <Send size={18} />, color: '#6366F1' },
        { label: 'Pagadas (mes)', value: fmt$(stats.paid_this_month), icon: <DollarSign size={18} />, color: '#10B981' },
    ];

    return (
        <div className="inv-page fade-in">
            {/* Toast */}
            {toast && (
                <div className={`workers-toast workers-toast--${toast.type}`}>
                    {toast.type === 'success' ? <CheckCircle size={15} /> : <X size={15} />} {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="ts-header">
                <div>
                    <h1 className="ts-title">Facturación</h1>
                    <p className="ts-subtitle">Genera y gestiona las facturas de tus clientes</p>
                </div>
                <button className="workers-btn-primary" onClick={() => setShowGenerate(true)}>
                    <Plus size={16} /> Generar Factura
                </button>
            </div>

            {/* Stat cards */}
            <div className="ts-stats-grid">
                {STAT_CARDS.map((s, i) => (
                    <div key={i} className="ts-stat-card">
                        <div className="ts-stat-card__icon" style={{ background: `${s.color}15`, color: s.color }}>{s.icon}</div>
                        <div>
                            <p className="ts-stat-card__value">{s.value}</p>
                            <p className="ts-stat-card__label">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="workers-toolbar" style={{ marginBottom: 16 }}>
                <div className="workers-search-box">
                    <Search size={14} className="workers-search-icon" />
                    <input className="workers-search" placeholder="Buscar por #, cliente, proyecto..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                        <option value="">Todos los Clientes</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="all">Todos los Status</option>
                        <option value="draft">Borrador</option>
                        <option value="pending_approval">Pen. Aprobación</option>
                        <option value="approved">Aprobada</option>
                        <option value="sent">Enviada</option>
                        <option value="paid">Pagada</option>
                        <option value="overdue">Vencida</option>
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <input type="month" className="workers-select" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ maxWidth: 160 }} />
                <button className="ts-month-btn" onClick={fetchData} title="Actualizar"><RefreshCw size={14} /></button>
                <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 4 }}>{displayInvoices.length} facturas</span>
            </div>

            {/* Invoices table */}
            {loading ? (
                <div className="workers-empty"><Clock size={40} /><p>Cargando facturas...</p></div>
            ) : displayInvoices.length === 0 ? (
                <div className="workers-empty">
                    <FileText size={44} />
                    <p>No se encontraron facturas</p>
                    <button className="workers-btn-primary" style={{ marginTop: 12 }} onClick={() => setShowGenerate(true)}>
                        <Plus size={14} /> Generar primera factura
                    </button>
                </div>
            ) : (
                <div className="inv-table-wrapper">
                    <table className="inv-list-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Cliente</th>
                                <th>Proyecto</th>
                                <th>Semana</th>
                                <th className="r">Total</th>
                                <th>Status</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayInvoices.map(inv => (
                                <tr key={inv.id} className="inv-list-row" onClick={() => setViewInvoice(inv)}>
                                    <td><span className="inv-number">#{inv.invoice_number}</span></td>
                                    <td>{inv.client?.company_name || '—'}</td>
                                    <td>{inv.project?.name || '—'}</td>
                                    <td className="inv-week">{fmtDateRange(inv.week_start_date, inv.week_end_date)}</td>
                                    <td className="r inv-total">{fmt$(inv.total)}</td>
                                    <td><StatusBadge status={inv.status} /></td>
                                    <td className="inv-date">{fmtDate(inv.invoice_date)}</td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <div className="inv-row-actions">
                                            <button className="inv-row-btn" onClick={() => setViewInvoice(inv)} title="Ver"><Eye size={14} /></button>
                                            <button className="inv-row-btn" title="PDF" onClick={() => {
                                                const base = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
                                                const tok = localStorage.getItem('token') || sessionStorage.getItem('token');
                                                window.open(`${base}/invoices/${inv.id}/html?token=${tok}`, '_blank');
                                            }}><Download size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Invoice Preview Modal */}
            {viewInvoice && (
                <InvoiceModal
                    invoice={viewInvoice}
                    company={company}
                    api={api}
                    showToast={showToast}
                    onClose={() => setViewInvoice(null)}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                />
            )}

            {/* Generate Modal */}
            {showGenerate && (
                <GenerateModal
                    clients={clients}
                    api={api}
                    showToast={showToast}
                    onGenerated={handleGenerated}
                    onClose={() => setShowGenerate(false)}
                />
            )}
        </div>
    );
}
