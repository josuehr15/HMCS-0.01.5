import { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { X, CheckCircle, Send, DollarSign, Printer } from 'lucide-react';
import useApi from '../../hooks/useApi';
import './InvoicePrint.css';

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    draft:            { label: 'Borrador',         color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
    pending_approval: { label: 'Pend. Aprobación', color: '#D97706', bg: 'rgba(245,158,11,0.1)'  },
    approved:         { label: 'Aprobada',          color: '#059669', bg: 'rgba(16,185,129,0.1)'  },
    sent:             { label: 'Enviada',           color: '#2A6C95', bg: 'rgba(42,108,149,0.1)'  },
    paid:             { label: 'Pagada',            color: '#08543D', bg: 'rgba(8,84,61,0.1)'     },
    overdue:          { label: 'Vencida',           color: '#DC2626', bg: 'rgba(239,68,68,0.1)'   },
};

const fmt$ = v => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Pay Modal ────────────────────────────────────────────────────────────────
function PayModal({ invoice, onClose, onPaid }) {
    const api = useApi();
    const [form, setForm] = useState({
        payment_method: 'check',
        payment_reference: '',
        payment_notes: '',
        payment_terms: 'net_14',
    });
    const [loading, setLoading] = useState(false);

    const handlePay = async () => {
        setLoading(true);
        try {
            await api.put(`/invoices/${invoice.id}/paid`, form);
            onPaid();
            onClose();
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    return ReactDOM.createPortal(
        <div className="ip-pay-overlay no-print" onClick={onClose}>
            <div className="ip-pay-modal" onClick={e => e.stopPropagation()}>
                <div className="ip-pay-modal__header">
                    <div>
                        <h3>Registrar Pago</h3>
                        <p>Factura #{invoice?.invoice_number} — {fmt$(invoice?.total)}</p>
                    </div>
                    <button className="ip-pay-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="ip-pay-modal__body">
                    <div className="ip-field">
                        <label>Términos de pago</label>
                        <select value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })}>
                            <option value="net_14">Net 14 days</option>
                            <option value="net_30">Net 30 days</option>
                            <option value="net_60">Net 60 days</option>
                            <option value="due_on_receipt">Due on receipt</option>
                        </select>
                    </div>
                    <div className="ip-field">
                        <label>Método de pago</label>
                        <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}>
                            <option value="">Seleccionar...</option>
                            <option value="check">Check</option>
                            <option value="ach">ACH / Transfer</option>
                            <option value="zelle">Zelle</option>
                            <option value="cash">Cash</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div className="ip-field">
                        <label>Referencia / # de cheque</label>
                        <input type="text" placeholder="Ej: Check #1042" value={form.payment_reference} onChange={e => setForm({ ...form, payment_reference: e.target.value })} />
                    </div>
                    <div className="ip-field">
                        <label>Notas de pago (opcional)</label>
                        <textarea placeholder="Ej: Depositado en cuenta Wells Fargo..." value={form.payment_notes} onChange={e => setForm({ ...form, payment_notes: e.target.value })} rows={2} />
                    </div>
                </div>
                <div className="ip-pay-modal__footer">
                    <button className="ip-btn-cancel" onClick={onClose}>Cancelar</button>
                    <button className="ip-btn-pay" onClick={handlePay} disabled={loading}>
                        {loading ? 'Procesando...' : '✓ Confirmar Pago'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Email Modal ──────────────────────────────────────────────────────────────
function EmailModal({ invoice, onClose, onSent }) {
    const api = useApi();
    const defaultEmail = invoice?.client?.email || '';
    const [to, setTo] = useState(defaultEmail);
    const [subject, setSubject] = useState(`HMCS Invoice #${invoice?.invoice_number}`);
    const [body, setBody] = useState(`Hello ${invoice?.client?.contact_person || 'Client'},\n\nPlease find attached the invoice #${invoice?.invoice_number} for the amount of ${fmt$(invoice?.total)}.\n\nThank you for your business!\n\nBest regards,\nHM Construction Staffing LLLP`);
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
        
        setLoading(true);
        try {
            await api.patch(`/invoices/${invoice.id}/status`, { status: 'sent' });
            onSent();
            onClose();
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    return ReactDOM.createPortal(
        <div className="ip-pay-overlay no-print" onClick={onClose}>
            <div className="ip-pay-modal" onClick={e => e.stopPropagation()}>
                <div className="ip-pay-modal__header">
                    <div>
                        <h3>Enviar Factura por Email</h3>
                    </div>
                    <button className="ip-pay-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="ip-pay-modal__body">
                    <div className="ip-field">
                        <label>Para:</label>
                        <input type="email" value={to} onChange={e => setTo(e.target.value)} />
                    </div>
                    <div className="ip-field">
                        <label>Asunto:</label>
                        <input type="text" value={subject} onChange={e => setSubject(e.target.value)} />
                    </div>
                    <div className="ip-field">
                        <label>Mensaje:</label>
                        <textarea rows={6} value={body} onChange={e => setBody(e.target.value)} />
                    </div>
                </div>
                <div className="ip-pay-modal__footer">
                    <button className="ip-btn-cancel" onClick={onClose}>Cancelar</button>
                    <button className="ip-btn-pay" onClick={handleSend} disabled={loading || !to}>
                        <Send size={14} style={{ marginRight: 6 }} /> 
                        {loading ? 'Procesando...' : 'Abrir en Correo y Marcar Enviada'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Main Print Page ──────────────────────────────────────────────────────────
export default function InvoicePrint() {
    const { id } = useParams();
    const navigate = useNavigate();
    const api = useApi();
    const printRef = useRef(null);

    const [invoice, setInvoice] = useState(null);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showPayModal, setShowPayModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const loadInvoice = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/invoices/${id}`);
            setInvoice(res.data?.data || res.data || res);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadInvoice(); }, [id]);

    const doAction = async (endpoint) => {
        setActionLoading(true);
        try {
            const res = await api.put(`/invoices/${id}/${endpoint}`);
            setInvoice(res.data?.data || res.data || res);
        } catch (e) { console.error(e); }
        finally { setActionLoading(false); }
    };

    // Agrupar líneas por worker_id para tener 1 fila por contractor
    const groupedLines = useMemo(() => {
        const g = {};
        invoice?.lines?.forEach(line => {
            const wId = line.worker?.id || line.worker_id;
            if (!g[wId]) {
                g[wId] = {
                    worker_id: wId,
                    worker: line.worker,
                    trade: line.trade,
                    regular_hours: 0,
                    overtime_hours: 0,
                    rate: parseFloat(line.rate || 0),
                    overtime_rate: parseFloat(line.overtime_rate || 0),
                    amount: 0,
                };
            }
            g[wId].regular_hours += parseFloat(line.regular_hours || 0);
            g[wId].overtime_hours += parseFloat(line.overtime_hours || 0);
            g[wId].amount += parseFloat(line.amount || line.line_total || 0);
        });

        // Add perDiem details to each grouped line
        return Object.values(g).map(line => {
            const pd = invoice?.perDiemLines?.find(p => p.worker_id === line.worker_id);
            const pdRate = pd ? parseFloat(pd.per_diem_amount || 0) : null;
            const pdDays = pd ? parseInt(pd.per_diem_days || 0, 10) : null;
            const pdAmount = pd ? (pdRate * pdDays) : 0;
            return {
                ...line,
                pdRate,
                pdDays,
                pdAmount,
                totalAmount: line.amount + pdAmount
            };
        });
    }, [invoice?.lines, invoice?.perDiemLines]);

    const hasPerDiem = useMemo(() => {
        return invoice?.perDiemLines && invoice.perDiemLines.length > 0;
    }, [invoice?.perDiemLines]);

    const totals = useMemo(() => {
        const laborSubtotal = groupedLines.reduce((s, l) => s + l.amount, 0);
        const perDiemTotal = invoice?.perDiemLines?.reduce((s, pd) => s + (parseFloat(pd.per_diem_amount||0) * parseInt(pd.per_diem_days||0, 10)), 0) || 0;
        return {
            laborSubtotal,
            perDiemTotal,
            total: laborSubtotal + perDiemTotal
        };
    }, [groupedLines, invoice?.perDiemLines]);

    // Tracker logic
    // Fake logic: if groupedLines has data, assume they worked Mon-Fri for purely visual representation
    const workedDays = invoice?.lines?.length > 0 ? ['Mon','Tue','Wed','Thu','Fri'] : [];
    
    const weekDays = useMemo(() => {
        if (!invoice?.week_start_date) return [];
        let start = new Date(invoice.week_start_date + 'T00:00:00');
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek); // Shift start date to previous Sunday

        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            return d;
        });
    }, [invoice?.week_start_date]);

    // Derive day names directly from computed dates so they always match perfectly:
    const dayNames = useMemo(() => {
        return weekDays.map(d => d.toLocaleDateString('en-US', { weekday: 'short' }));
    }, [weekDays]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, color: '#64748B' }}>
                <span className="ip-pulse-loader" />
                Cargando factura...
            </div>
        );
    }

    if (!invoice) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, color: '#64748B' }}>
                <p>Factura no encontrada.</p>
                <button onClick={() => navigate('/admin/invoices')} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer' }}>← Volver</button>
            </div>
        );
    }

    const st = invoice?.status;
    const statusCfg = STATUS_CONFIG[st] || STATUS_CONFIG.draft;

    return (
        <div className="ip-page">
            {/* ── Toolbar (hidden on print) ── */}
            <div className="ip-toolbar no-print">
                <button className="ip-back-btn" onClick={() => navigate('/admin/invoices')}>
                    ← Volver a Facturas
                </button>
                <div className="ip-toolbar-right">
                    <div className="ip-status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.label}
                    </div>

                    {st === 'pending_approval' && (
                        <button className="ip-btn ip-btn--approve" onClick={() => doAction('approve')} disabled={actionLoading}>
                            <CheckCircle size={14} /> Aprobar Factura
                        </button>
                    )}
                    {st === 'approved' && (
                        <button className="ip-btn ip-btn--send" onClick={() => doAction('send')} disabled={actionLoading}>
                            <Send size={14} /> Marcar como Enviada
                        </button>
                    )}
                    {st === 'sent' && (
                        <button className="ip-btn ip-btn--pay" onClick={() => setShowPayModal(true)} disabled={actionLoading}>
                            <DollarSign size={14} /> Registrar Pago
                        </button>
                    )}
                    <button className="ip-btn ip-btn--pay" onClick={() => setShowEmailModal(true)}>
                        <Send size={14} /> Enviar por Email
                    </button>
                    <button className="ip-btn ip-btn--print" onClick={() => window.print()}>
                        <Printer size={14} /> Descargar PDF
                    </button>
                </div>
            </div>

            {/* ══ PRINTABLE DOCUMENT ══ */}
            <div className="invoice-print-wrapper" ref={printRef}>

                {st === 'paid' && (
                    <div className="ip-doc__paid-stamp">
                        <div className="ip-doc__paid-label">PAID</div>
                        {invoice.paid_at && (
                            <div className="ip-doc__paid-date">
                                {new Date(invoice.paid_at).toLocaleDateString('en-US')}
                            </div>
                        )}
                    </div>
                )}

                {/* SECCIÓN 1 — Header */}
                <div className="ip-doc__header">
                    <div className="ip-doc__header-left">
                        <div className="invoice-title">INVOICE</div>
                        <div className="company-name">HM Construction Staffing LLLP</div>
                        <div className="body-text">500 Lucas Dr, Savannah, GA 31406-9435</div>
                        <div className="body-text">hmconstruction.staffing@gmail.com</div>

                        <div className="bill-to-section">
                            <div className="bill-to-label">BILL TO</div>
                            <div className="company-name">{invoice?.client?.company_name}</div>
                            {invoice?.client?.address && <div className="bill-to-value">{invoice.client.address}</div>}
                            <div className="bill-to-value">
                                {[invoice?.client?.city, invoice?.client?.state, invoice?.client?.zip_code].filter(Boolean).join(', ')}
                            </div>
                            {invoice?.client?.country && <div className="bill-to-value">{invoice.client.country}</div>}
                        </div>
                    </div>
                    
                    <div className="ip-doc__header-right">
                        <img 
                            src="/images/logo%20cuadrado.JPG" 
                            alt="HM Construction Staffing LLLP" 
                            className="invoice-logo" 
                        />
                        <div className="ip-doc__invoice-meta">
                            <div className="ip-doc__meta-row">
                                <span>Invoice no.</span>
                                <strong>{invoice?.invoice_number}</strong>
                            </div>
                            <div className="ip-doc__meta-row">
                                <span>Invoice date</span>
                                <strong>{invoice?.invoice_date ? new Date(invoice.invoice_date + 'T00:00:00').toLocaleDateString('en-US', {month: 'numeric', day: 'numeric', year: 'numeric'}) : '—'}</strong>
                            </div>
                            <div className="ip-doc__meta-row">
                                <span>Due date</span>
                                <strong>{invoice?.due_date ? new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-US', {month: 'numeric', day: 'numeric', year: 'numeric'}) : '—'}</strong>
                            </div>
                            <div className="ip-doc__meta-row">
                                <span>Project</span>
                                <strong>{invoice?.project?.name}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 2 — Línea divisora */}
                <div className="ip-doc__divider" />

                {/* SECCIÓN 3 — Tabla */}
                <div className="ip-doc__table-container">
                    <table className="ip-doc__table">
                        <thead>
                            <tr className="group-header">
                                <th></th>
                                <th></th>
                                <th colSpan={4} className="text-center border-left">LABOR</th>
                                {hasPerDiem && <th colSpan={2} className="text-center border-left">PER DIEM</th>}
                                <th></th>
                            </tr>
                            <tr className="column-header">
                                <th className="text-left">Contractor</th>
                                <th className="text-left">Trade</th>
                                <th className="text-right border-left">Reg hrs</th>
                                <th className="text-right">OT hrs</th>
                                <th className="text-right">Rate</th>
                                <th className="text-right">OT rate</th>
                                {hasPerDiem && (
                                    <>
                                        <th className="text-right border-left">Rate/day</th>
                                        <th className="text-right">Days</th>
                                    </>
                                )}
                                <th className="text-right border-left">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedLines.map((line, i) => (
                                <tr key={i}>
                                    <td className="text-left contractor-name">
                                        {line.worker?.first_name} {line.worker?.last_name}
                                    </td>
                                    <td className="text-left muted-text">{line.trade?.name || '—'}</td>
                                    
                                    <td className="text-right border-left">{parseFloat(line.regular_hours).toFixed(1)}</td>
                                    <td className={`text-right ${line.overtime_hours > 0 ? '' : 'muted-text'}`}>
                                        {line.overtime_hours > 0 ? parseFloat(line.overtime_hours).toFixed(1) : '—'}
                                    </td>
                                    <td className="text-right">${line.rate.toFixed(2)}</td>
                                    <td className={`text-right ${line.overtime_hours > 0 ? '' : 'muted-text'}`}>
                                        {line.overtime_hours > 0 ? `$${line.overtime_rate.toFixed(2)}` : '—'}
                                    </td>

                                    {hasPerDiem && (
                                        <>
                                            <td className="text-right border-left">
                                                {line.pdRate > 0 ? `$${line.pdRate.toFixed(2)}` : '—'}
                                            </td>
                                            <td className="text-right">
                                                {line.pdDays > 0 ? line.pdDays : '—'}
                                            </td>
                                        </>
                                    )}

                                    <td className="text-right border-left amount-cell">
                                        {fmt$(line.totalAmount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* SECCIÓN 4 — Totales */}
                <div className="ip-doc__totals">
                    <div className="ip-doc__total-row">
                        <span>Subtotal (labor):</span>
                        <span>{fmt$(totals.laborSubtotal)}</span>
                    </div>
                    {hasPerDiem && (
                        <div className="ip-doc__total-row">
                            <span>Per Diem (passthrough):</span>
                            <span>{fmt$(totals.perDiemTotal)}</span>
                        </div>
                    )}
                    <div className="ip-doc__total-row grand-total">
                        <span>TOTAL:</span>
                        <span>{fmt$(totals.total)}</span>
                    </div>
                </div>

                <div className="ip-doc__divider" />

                {/* SECCIÓN 5 — Footer / Week Tracker */}
                <div className="ip-doc__footer">
                    <div className="week-worked-label">
                        Week worked from {invoice?.week_start_date ? new Date(invoice.week_start_date + 'T00:00:00').toLocaleDateString('en-US', {month: 'numeric', day: 'numeric', year: 'numeric'}) : ''} to {invoice?.week_end_date ? new Date(invoice.week_end_date + 'T00:00:00').toLocaleDateString('en-US', {month: 'numeric', day: 'numeric', year: 'numeric'}) : ''}
                    </div>

                    <div style={{ maxWidth: 400 }}>
                        <div className="tracker-row">
                            {dayNames.map(d => (
                                <div key={d} className={`tracker-pill ${workedDays.includes(d) ? 'active' : ''}`}>{d}</div>
                            ))}
                        </div>
                        <div className="tracker-dates">
                            {weekDays.map((date, i) => (
                                <div key={i} className={`tracker-date ${workedDays.includes(dayNames[i]) ? 'active' : ''}`}>
                                    <strong>{date.getDate()}</strong>
                                    {date.toLocaleString('en-US', { month: 'short' })}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="payment-terms-text">
                        Payment terms: {invoice?.payment_terms === 'due_on_receipt' ? 'Due on receipt' : invoice?.payment_terms === 'net_30' ? 'Net 30 days' : invoice?.payment_terms === 'net_60' ? 'Net 60 days' : 'Net 14 days'}
                    </div>
                </div>

                {/* PAYMENT INFO (if paid) */}
                {st === 'paid' && invoice?.payment_method && (
                    <div className="ip-doc__paid-info" style={{marginTop: 20}}>
                        <strong>Payment received</strong> via {invoice.payment_method}
                        {invoice.payment_reference && ` — ${invoice.payment_reference}`}
                        {invoice.paid_at && ` on ${new Date(invoice.paid_at).toLocaleDateString('en-US')}`}
                    </div>
                )}

            </div>

            {/* Pay Modal */}
            {showPayModal && (
                <PayModal
                    invoice={invoice}
                    onClose={() => setShowPayModal(false)}
                    onPaid={() => loadInvoice()}
                />
            )}
            
            {/* Email Modal */}
            {showEmailModal && (
                <EmailModal
                    invoice={invoice}
                    onClose={() => setShowEmailModal(false)}
                    onSent={() => loadInvoice()}
                />
            )}
        </div>
    );
}
