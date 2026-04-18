import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    Plus, X, Search, ChevronDown, CheckCircle, Clock,
    DollarSign, Send, FileText, Eye, Trash2, Edit2,
    AlertCircle, RotateCcw, Building2, Calendar, RefreshCw,
    Printer, ExternalLink
} from 'lucide-react';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import './Invoices.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt$ = v => `$${parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';
const fmtDateRange = (s, e) => {
    if (!s || !e) return '—';
    const ds = new Date(s + 'T00:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    const de = new Date(e + 'T00:00:00').toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${ds} – ${de}`;
};

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    draft:            { label: 'Borrador',         color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
    pending_approval: { label: 'Pend. Aprobación', color: '#D97706', bg: 'rgba(245,158,11,0.1)'  },
    approved:         { label: 'Aprobada',          color: '#059669', bg: 'rgba(16,185,129,0.1)'  },
    sent:             { label: 'Enviada',           color: '#2A6C95', bg: 'rgba(42,108,149,0.1)'  },
    paid:             { label: 'Pagada',            color: '#08543D', bg: 'rgba(8,84,61,0.1)'     },
    overdue:          { label: 'Vencida',           color: '#DC2626', bg: 'rgba(239,68,68,0.1)'   },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || { label: status, color: '#64748B', bg: 'rgba(100,116,139,0.1)' };
    return (
        <span className="inv-status-badge" style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.label}
        </span>
    );
}

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
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return ReactDOM.createPortal(
        <div className="inv-pay-overlay" onClick={onClose}>
            <div className="inv-pay-modal" onClick={e => e.stopPropagation()}>
                <div className="inv-pay-modal__header">
                    <div>
                        <h3>Registrar Pago</h3>
                        <p>Factura #{invoice?.invoice_number}</p>
                    </div>
                    <button className="inv-pay-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="inv-pay-modal__body">
                    <div className="inv-pay-modal__amount">
                        <span>Total a cobrar</span>
                        <strong>{fmt$(invoice?.total)}</strong>
                    </div>
                    <div className="inv-field">
                        <label>Términos de pago</label>
                        <select value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })}>
                            <option value="net_14">Net 14 days</option>
                            <option value="net_30">Net 30 days</option>
                            <option value="net_60">Net 60 days</option>
                            <option value="due_on_receipt">Due on receipt</option>
                        </select>
                    </div>
                    <div className="inv-field">
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
                    <div className="inv-field">
                        <label>Referencia / # de cheque</label>
                        <input type="text" placeholder="Ej: Check #1042" value={form.payment_reference} onChange={e => setForm({ ...form, payment_reference: e.target.value })} />
                    </div>
                    <div className="inv-field">
                        <label>Notas de pago (opcional)</label>
                        <textarea placeholder="Ej: Depositado en cuenta Wells Fargo..." value={form.payment_notes} onChange={e => setForm({ ...form, payment_notes: e.target.value })} rows={2} />
                    </div>
                </div>
                <div className="inv-pay-modal__footer">
                    <button className="inv-btn-cancel" onClick={onClose}>Cancelar</button>
                    <button className="inv-btn-pay" onClick={handlePay} disabled={loading}>
                        {loading ? 'Procesando...' : '✓ Confirmar Pago'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Edit Invoice Modal ───────────────────────────────────────────────────────
function EditModal({ invoice: initInv, onClose, onSaved, showToast }) {
    const api = useApi();
    const [form, setForm] = useState({
        notes: initInv.notes || '',
        adjustments: initInv.adjustments || 0,
        per_diem_total: initInv.per_diem_total || 0,
        payment_terms: initInv.payment_terms || 'net_14',
        invoice_date: initInv.invoice_date ? initInv.invoice_date.split('T')[0] : '',
        due_date: initInv.due_date ? initInv.due_date.split('T')[0] : '',
        week_start_date: initInv.week_start_date || '',
        week_end_date: initInv.week_end_date || '',
    });
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await api.put(`/invoices/${initInv.id}`, form);
            const upd = res.data?.data || res.data || res;
            onSaved(upd);
            showToast('Factura actualizada correctamente.');
            onClose();
        } catch (err) {
            console.error('Error updating invoice:', err);
            showToast('Error al actualizar la factura.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const estTotal = parseFloat(initInv.subtotal || 0) + parseFloat(form.per_diem_total || 0) + parseFloat(form.adjustments || 0);

    return ReactDOM.createPortal(
        <div className="inv-edit-overlay" onClick={onClose}>
            <div className="inv-edit-modal" onClick={e => e.stopPropagation()}>
                <div className="inv-edit-modal__header">
                    <div>
                        <h3 className="inv-edit-modal__title">Editar Factura</h3>
                        <p className="inv-edit-modal__sub">#{initInv.invoice_number}</p>
                    </div>
                    <button className="inv-edit-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="inv-edit-modal__body">
                    <div className="inv-edit-section">
                        <div className="inv-edit-section__title">FECHAS</div>
                        <div className="inv-edit-grid">
                            <div className="inv-field">
                                <label>Fecha de factura</label>
                                <input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} />
                            </div>
                            <div className="inv-field">
                                <label>Fecha de vencimiento</label>
                                <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                            </div>
                            <div className="inv-field">
                                <label>Semana inicio</label>
                                <input type="date" value={form.week_start_date} onChange={e => setForm({ ...form, week_start_date: e.target.value })} />
                            </div>
                            <div className="inv-field">
                                <label>Semana fin</label>
                                <input type="date" value={form.week_end_date} onChange={e => setForm({ ...form, week_end_date: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div className="inv-edit-section">
                        <div className="inv-edit-section__title">MONTOS</div>
                        <div className="inv-edit-grid">
                            <div className="inv-field">
                                <label>Per Diem ($)</label>
                                <input type="number" min="0" step="0.01" value={form.per_diem_total} onChange={e => setForm({ ...form, per_diem_total: e.target.value })} />
                                <span className="inv-field__hint">Passthrough — no afecta márgenes</span>
                            </div>
                            <div className="inv-field">
                                <label>Ajustes ($)</label>
                                <input type="number" step="0.01" value={form.adjustments} onChange={e => setForm({ ...form, adjustments: e.target.value })} />
                                <span className="inv-field__hint">Positivo = cargo extra, Negativo = descuento</span>
                            </div>
                        </div>
                        <div className="inv-edit-total-preview">
                            <span>Total estimado:</span>
                            <strong>${estTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                        </div>
                    </div>

                    <div className="inv-edit-section">
                        <div className="inv-edit-section__title">TÉRMINOS</div>
                        <div className="inv-field">
                            <label>Términos de pago</label>
                            <select value={form.payment_terms} onChange={e => setForm({ ...form, payment_terms: e.target.value })}>
                                <option value="net_14">Net 14 days</option>
                                <option value="net_30">Net 30 days</option>
                                <option value="net_60">Net 60 days</option>
                                <option value="due_on_receipt">Due on receipt</option>
                            </select>
                        </div>
                    </div>

                    <div className="inv-edit-section">
                        <div className="inv-edit-section__title">NOTAS AL CLIENTE</div>
                        <div className="inv-field">
                            <textarea rows={3} placeholder="Nota visible en la factura..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                        </div>
                    </div>
                </div>
                <div className="inv-edit-modal__footer">
                    <button className="inv-btn-cancel" onClick={onClose}>Cancelar</button>
                    <button className="inv-btn-save" onClick={handleSave} disabled={loading}>
                        {loading ? 'Guardando...' : '✓ Guardar cambios'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Invoice Detail Drawer ────────────────────────────────────────────────────
function InvoiceDrawer({ invoice: initInv, onClose, onRefresh, navigate, onEdit }) {
    const api = useApi();
    const [invoice, setInvoice] = useState(initInv);
    const [loading, setLoading] = useState(false);
    const [loadingFull, setLoadingFull] = useState(false);
    const [showPayModal, setShowPayModal] = useState(false);

    // Fetch full details with lines
    useEffect(() => {
        if (!initInv?.id) return;
        setLoadingFull(true);
        api.get(`/invoices/${initInv.id}`)
            .then(r => setInvoice(r.data?.data || r.data || r))
            .catch(() => {})
            .finally(() => setLoadingFull(false));
    }, [initInv?.id]);

    // Escape key
    useEffect(() => {
        const h = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const doAction = async (endpoint) => {
        setLoading(true);
        try {
            const r = await api.put(`/invoices/${invoice.id}/${endpoint}`);
            const upd = r.data?.data || r.data || r;
            setInvoice(upd);
            onRefresh();
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const [confirmDelete, setConfirmDelete] = useState(false);

    const handleDelete = async (invoiceId) => {
        setLoading(true);
        try {
            await api.del(`/invoices/${invoiceId}`);
            setConfirmDelete(false);
            onRefresh();
            onClose();
        } catch (err) {
            console.error('Error deleting invoice:', err);
            alert(err.response?.data?.message || 'Error al eliminar factura');
        } finally {
            setLoading(false);
        }
    };

    // Group lines by worker
    const groupedLines = useMemo(() => {
        const g = {};
        invoice?.lines?.forEach(line => {
            const wId = line.worker_id;
            if (!g[wId]) {
                g[wId] = {
                    worker: line.worker,
                    trade: line.trade,
                    regular_hours: 0,
                    overtime_hours: 0,
                    rate: line.rate,
                    overtime_rate: line.overtime_rate,
                    total: 0,
                };
            }
            g[wId].regular_hours += parseFloat(line.regular_hours || 0);
            g[wId].overtime_hours += parseFloat(line.overtime_hours || 0);
            g[wId].total += parseFloat(line.amount || line.line_total || 0);
        });
        return Object.values(g);
    }, [invoice?.lines]);

    const st = invoice?.status;

    return ReactDOM.createPortal(
        <>
            <div className="inv-overlay fade-in" onClick={onClose} />
            <div className="inv-drawer slide-in-right">
                {/* Drawer Header */}
                <div className="inv-drawer__header">
                    <div className="inv-drawer__header-info">
                        <div className="inv-drawer__number">#{invoice?.invoice_number}</div>
                        <StatusBadge status={st} />
                    </div>
                    <button className="inv-drawer__close" onClick={onClose}><X size={20} /></button>
                </div>

                <div className="inv-drawer__body">
                    {loadingFull ? (
                        <div className="inv-drawer__loading">
                            <span className="inv-pulse-loader" /> Cargando detalles...
                        </div>
                    ) : (
                        <>
                            {/* Status Section */}
                            <div className="inv-drawer-status-section">
                                <div className="inv-drawer-label">ESTADO</div>
                                <div className="inv-drawer-status-row">
                                    <span className="inv-status-badge"
                                        style={{
                                            background: STATUS_CONFIG[invoice?.status]?.bg,
                                            color: STATUS_CONFIG[invoice?.status]?.color,
                                        }}>
                                        {STATUS_CONFIG[invoice?.status]?.label}
                                    </span>
                                    <select
                                        className="inv-status-select"
                                        value={invoice?.status || ''}
                                        onChange={async (e) => {
                                            try {
                                                // Using patch mapped to updateInvoiceStatus
                                                await api.patch(`/invoices/${invoice.id}/status`, { status: e.target.value });
                                                onRefresh();
                                                const res = await api.get(`/invoices/${invoice.id}`);
                                                setInvoice(res.data?.data || res.data || res);
                                            } catch (err) {
                                                console.error(err);
                                            }
                                        }}>
                                        <option value="draft">Borrador</option>
                                        <option value="pending_approval">Pend. Aprobación</option>
                                        <option value="approved">Aprobada</option>
                                        <option value="sent">Enviada</option>
                                        <option value="paid">Pagada</option>
                                        <option value="overdue">Vencida</option>
                                    </select>
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="inv-drawer__section">
                                <div className="inv-drawer__section-title">Información</div>
                                <div className="inv-drawer__info-grid">
                                    <div className="inv-info-row">
                                        <span>Cliente</span>
                                        <strong>{invoice?.client?.company_name || '—'}</strong>
                                    </div>
                                    <div className="inv-info-row">
                                        <span>Proyecto</span>
                                        <strong>{invoice?.project?.name || '—'}</strong>
                                    </div>
                                    <div className="inv-info-row">
                                        <span>Período</span>
                                        <strong>{fmtDateRange(invoice?.week_start_date, invoice?.week_end_date)}</strong>
                                    </div>
                                    <div className="inv-info-row">
                                        <span>Fecha Factura</span>
                                        <strong>{fmtDate(invoice?.invoice_date)}</strong>
                                    </div>
                                    <div className="inv-info-row">
                                        <span>Vencimiento</span>
                                        <strong>{fmtDate(invoice?.due_date) || 'Net 14 days'}</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Lines Table */}
                            {groupedLines.length > 0 && (
                                <div className="inv-drawer__section">
                                    <div className="inv-drawer__section-title">Líneas de Factura</div>
                                    <div className="inv-lines-table-wrap">
                                        <table className="inv-lines-table">
                                            <thead>
                                                <tr>
                                                    <th>Trabajador</th>
                                                    <th>Reg h</th>
                                                    <th>OT h</th>
                                                    <th>Rate</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupedLines.map((line, i) => (
                                                    <tr key={i}>
                                                        <td>
                                                            <div className="inv-lines__name">{line.worker?.first_name} {line.worker?.last_name}</div>
                                                            <div className="inv-lines__trade">{line.trade?.name || '—'}</div>
                                                        </td>
                                                        <td>{parseFloat(line.regular_hours).toFixed(1)}</td>
                                                        <td>{parseFloat(line.overtime_hours) > 0 ? parseFloat(line.overtime_hours).toFixed(1) : '—'}</td>
                                                        <td>${parseFloat(line.rate || 0).toFixed(2)}</td>
                                                        <td className="inv-lines__total">{fmt$(line.total)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Totals */}
                            <div className="inv-drawer__section">
                                <div className="inv-drawer__section-title">Totales</div>
                                <div className="inv-totals">
                                    <div className="inv-total-row">
                                        <span>Subtotal (labor)</span>
                                        <span>{fmt$(invoice?.subtotal)}</span>
                                    </div>
                                    {parseFloat(invoice?.per_diem_total || 0) > 0 && (
                                        <div className="inv-total-row">
                                            <span>Per Diem</span>
                                            <span>{fmt$(invoice?.per_diem_total)}</span>
                                        </div>
                                    )}
                                    {parseFloat(invoice?.adjustments || 0) !== 0 && (
                                        <div className="inv-total-row">
                                            <span>Adjustments</span>
                                            <span>{fmt$(invoice?.adjustments)}</span>
                                        </div>
                                    )}
                                    <div className="inv-total-row inv-total-row--grand">
                                        <strong>TOTAL</strong>
                                        <strong className="inv-grand-total">{fmt$(invoice?.total)}</strong>
                                    </div>
                                </div>
                            </div>

                            {/* Payment info (if paid) */}
                            {st === 'paid' && invoice?.payment_method && (
                                <div className="inv-drawer__section">
                                    <div className="inv-drawer__section-title">Pago Registrado</div>
                                    <div className="inv-drawer__info-grid">
                                        <div className="inv-info-row">
                                            <span>Método</span>
                                            <strong>{{ check: 'Cheque', wire: 'Transferencia', cash: 'Efectivo', ach: 'ACH', other: 'Otro' }[invoice.payment_method] || invoice.payment_method}</strong>
                                        </div>
                                        {invoice.payment_reference && (
                                            <div className="inv-info-row">
                                                <span>Referencia</span>
                                                <strong>{invoice.payment_reference}</strong>
                                            </div>
                                        )}
                                        {invoice.paid_at && (
                                            <div className="inv-info-row">
                                                <span>Fecha Pago</span>
                                                <strong>{new Date(invoice.paid_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong>
                                            </div>
                                        )}
                                        {invoice.payment_notes && (
                                            <div className="inv-info-row">
                                                <span>Notas</span>
                                                <strong>{invoice.payment_notes}</strong>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="inv-drawer__section">
                                <div className="inv-drawer__section-title">Acciones</div>
                                <div className="inv-drawer__actions">
                                    {/* View full PDF page */}
                                    <button className="inv-drawer-btn inv-drawer-btn--ghost" onClick={() => navigate(`/admin/invoices/${invoice.id}`)}>
                                        <ExternalLink size={14} /> Ver / Imprimir PDF
                                    </button>

                                    {/* Edit button - always visible */}
                                    <button className="inv-drawer-btn inv-drawer-action-btn--edit" onClick={() => onEdit(invoice)}>
                                        <Edit2 size={14} /> Editar Factura
                                    </button>

                                    {st === 'draft' && (
                                        <>
                                            <button className="inv-drawer-btn inv-drawer-btn--accent" onClick={() => doAction('approve')} disabled={loading}>
                                                <Send size={14} /> Enviar a Aprobación
                                            </button>
                                        </>
                                    )}
                                    {st === 'pending_approval' && (
                                        <>
                                            <button className="inv-drawer-btn inv-drawer-btn--success" onClick={() => doAction('approve')} disabled={loading}>
                                                <CheckCircle size={14} /> Aprobar
                                            </button>
                                            <button className="inv-drawer-btn inv-drawer-btn--danger" onClick={() => doAction('draft')} disabled={loading}>
                                                <RotateCcw size={14} /> Rechazar
                                            </button>
                                        </>
                                    )}
                                    {st === 'approved' && (
                                        <>
                                            <button className="inv-drawer-btn inv-drawer-btn--accent" onClick={() => doAction('send')} disabled={loading}>
                                                <Send size={14} /> Marcar Enviada
                                            </button>
                                            <button className="inv-drawer-btn inv-drawer-btn--pay" onClick={() => setShowPayModal(true)} disabled={loading}>
                                                <DollarSign size={14} /> Marcar Pagada
                                            </button>
                                        </>
                                    )}
                                    {st === 'sent' && (
                                        <button className="inv-drawer-btn inv-drawer-btn--pay" onClick={() => setShowPayModal(true)} disabled={loading}>
                                            <DollarSign size={14} /> Registrar Pago
                                        </button>
                                    )}

                                    {/* Delete actions block */}
                                    <div style={{ marginTop: '16px' }}>
                                        {!confirmDelete ? (
                                            <button 
                                                className="inv-drawer-btn inv-drawer-btn--danger"
                                                onClick={() => setConfirmDelete(true)}>
                                                <Trash2 size={15} /> Eliminar Factura
                                            </button>
                                        ) : (
                                            <div className="inv-confirm-delete">
                                                <p>¿Confirmas eliminar esta factura?</p>
                                                <div className="inv-confirm-btns">
                                                    <button 
                                                        className="inv-confirm-cancel"
                                                        onClick={() => setConfirmDelete(false)}>
                                                        Cancelar
                                                    </button>
                                                    <button 
                                                        className="inv-confirm-yes"
                                                        onClick={() => handleDelete(invoice.id)}>
                                                        Sí, eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {showPayModal && (
                <PayModal
                    invoice={invoice}
                    onClose={() => setShowPayModal(false)}
                    onPaid={() => {
                        onRefresh();
                        // Re-fetch to update drawer
                        api.get(`/invoices/${invoice.id}`)
                            .then(r => setInvoice(r.data?.data || r.data || r))
                            .catch(() => {});
                    }}
                />
            )}
        </>,
        document.body
    );
}

// ─── Generate Invoice Modal ────────────────────────────────────────────────────
function GenerateModal({ clients, onClose, onGenerated, showToast }) {
    const api = useApi();
    const navigate = useNavigate();
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

    useEffect(() => {
        if (!clientId) { setProjects([]); setProjectId(''); setWeeks([]); setWeekIdx(''); return; }
        setLoadingProj(true);
        get(`/projects?client_id=${clientId}`)
            .then(r => setProjects(r.data?.data || r.data || r))
            .catch(() => setProjects([]))
            .finally(() => setLoadingProj(false));
    }, [clientId]);

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
            navigate(`/admin/invoices/${inv.id}`);
        } catch (err) {
            setError(err.response?.data?.message || 'Error al generar factura.');
        } finally { setGenerating(false); }
    };

    return ReactDOM.createPortal(
        <div className="inv-gen-overlay" onClick={onClose}>
            <div className="inv-gen-modal" onClick={e => e.stopPropagation()}>
                <div className="inv-gen-modal__header">
                    <div>
                        <h3 className="inv-modal-title">
                            <FileText size={20} />
                            Generar Factura
                        </h3>
                        <p>Selecciona cliente, proyecto y semana facturada</p>
                    </div>
                    <button className="inv-pay-modal__close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="inv-gen-modal__body">
                    {error && <div className="inv-error">{error}</div>}

                    <div className="inv-field">
                        <label>Cliente *</label>
                        <select value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(''); setWeekIdx(''); }}>
                            <option value="">Selecciona cliente...</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                        </select>
                    </div>

                    <div className="inv-field">
                        <label style={{ color: !clientId ? 'var(--text-muted)' : undefined }}>Proyecto *</label>
                        <select value={projectId} onChange={e => { setProjectId(e.target.value); setWeekIdx(''); }} disabled={!clientId}>
                            <option value="">{loadingProj ? 'Cargando...' : 'Selecciona proyecto...'}</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    <div className="inv-field">
                        <label style={{ color: !projectId ? 'var(--text-muted)' : undefined }}>Semana con horas aprobadas *</label>
                        <select value={weekIdx} onChange={e => setWeekIdx(e.target.value)} disabled={!projectId}>
                            <option value="">{loadingWeeks ? 'Cargando...' : weeks.length === 0 && projectId ? 'Sin semanas disponibles' : 'Selecciona semana...'}</option>
                            {weeks.map((w, i) => <option key={i} value={i}>{w.label}</option>)}
                        </select>
                    </div>

                    {projectId && !loadingWeeks && weeks.length === 0 && (
                        <div className="inv-no-weeks">
                            <AlertCircle size={15} />
                            <span>No hay semanas con horas aprobadas. Aprueba las horas primero en <strong>Registro de Horas</strong>.</span>
                        </div>
                    )}

                    {selectedWeek && (
                        <div className="inv-gen-preview">
                            <div className="inv-gen-preview__title">
                                <Calendar size={14} /> {selectedWeek.label}
                            </div>
                            {selectedWeek.workers?.length > 0 && (
                                <>
                                    {selectedWeek.workers.map((w, i) => (
                                        <div key={i} className="inv-gen-preview__row">
                                            <span>{w.name || w.full_name || `Worker ${i + 1}`}</span>
                                            <span>{w.regular_hours?.toFixed(1) || '—'}h{w.overtime_hours > 0 ? ` + ${w.overtime_hours.toFixed(1)}h OT` : ''}</span>
                                            {w.estimated_total && <span className="inv-gen-preview__amt">{fmt$(w.estimated_total)}</span>}
                                        </div>
                                    ))}
                                    {selectedWeek.estimated_subtotal && (
                                        <div className="inv-gen-preview__total">
                                            <span>Subtotal est.:</span>
                                            <strong>{fmt$(selectedWeek.estimated_subtotal)}</strong>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
                <div className="inv-gen-modal__footer">
                    <button className="inv-btn-cancel" onClick={onClose}>Cancelar</button>
                    <button className="inv-btn-pay" onClick={handleGenerate} disabled={generating || !clientId || !projectId || weekIdx === ''}>
                        {generating ? 'Generando...' : 'Generar Factura →'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Invoices() {
    const navigate = useNavigate();
    const api = useApi();
    const { get } = api;

    const [invoices, setInvoices] = useState([]);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showGenerate, setShowGenerate] = useState(false);
    const [filterClient, setFilterClient] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterStart, setFilterStart] = useState('');
    const [filterEnd, setFilterEnd] = useState('');
    const [searchText, setSearchText] = useState('');
    const [toast, setToast] = useState(null);
    const [showEdit, setShowEdit] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const loadInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterClient) params.client_id = filterClient;
            if (filterStatus) params.status = filterStatus;
            if (filterStart) params.start_date = filterStart;
            if (filterEnd) params.end_date = filterEnd;
            const qs = new URLSearchParams(params).toString();
            const res = await get(`/invoices${qs ? `?${qs}` : ''}`);
            setInvoices(res.data?.data || res.data || []);
        } catch (e) {
            console.error(e);
            showToast('Error al cargar facturas.', 'error');
        } finally {
            setLoading(false);
        }
    }, [get, filterClient, filterStatus, filterStart, filterEnd]);

    useEffect(() => { loadInvoices(); }, [loadInvoices]);
    useEffect(() => {
        get('/clients').then(r => setClients(r.data?.data || r.data || [])).catch(() => {});
    }, []);

    const displayInvoices = useMemo(() => {
        if (!searchText) return invoices;
        const q = searchText.toLowerCase();
        return invoices.filter(inv =>
            inv.invoice_number?.toLowerCase().includes(q) ||
            inv.client?.company_name?.toLowerCase().includes(q) ||
            inv.project?.name?.toLowerCase().includes(q)
        );
    }, [invoices, searchText]);

    // KPI stats
    const stats = useMemo(() => {
        const now = new Date();
        let totalCount = invoices.length;
        let pendingAmt = 0, sentAmt = 0, paidMonth = 0;
        invoices.forEach(inv => {
            const t = parseFloat(inv.total || 0);
            if (inv.status === 'pending_approval') pendingAmt += t;
            if (inv.status === 'sent') sentAmt += t;
            if (inv.status === 'paid' && inv.paid_at) {
                const pd = new Date(inv.paid_at);
                if (pd.getMonth() === now.getMonth() && pd.getFullYear() === now.getFullYear()) paidMonth += t;
            }
        });
        return { totalCount, pendingAmt, sentAmt, paidMonth };
    }, [invoices]);

    return (
        <div className="inv-page fade-in">
            {/* Toast */}
            {toast && ReactDOM.createPortal(
                <div className={`inv-toast inv-toast--${toast.type} fade-in-up`}>
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    <span>{toast.msg}</span>
                </div>,
                document.body
            )}

            {/* Header */}
            <div className="inv-header">
                <div className="inv-header__info">
                    <h1 className="inv-title">Facturación</h1>
                    <p className="inv-subtitle">Gestiona y genera facturas para tus clientes</p>
                </div>
                <button className="inv-btn-generate" onClick={() => setShowGenerate(true)}>
                    <Plus size={16} /> Generar Factura
                </button>
            </div>

            {/* KPI Cards */}
            <div className="inv-kpi-grid">
                <div className="inv-kpi">
                    <div className="inv-kpi__icon" style={{ background: 'rgba(42,108,149,0.1)', color: '#2A6C95' }}><FileText size={20} /></div>
                    <div>
                        <div className="inv-kpi__value">{stats.totalCount}</div>
                        <div className="inv-kpi__label">Total Facturas</div>
                    </div>
                </div>
                <div className="inv-kpi">
                    <div className="inv-kpi__icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#D97706' }}><Clock size={20} /></div>
                    <div>
                        <div className="inv-kpi__value">{fmt$(stats.pendingAmt)}</div>
                        <div className="inv-kpi__label">Pendientes</div>
                    </div>
                </div>
                <div className="inv-kpi">
                    <div className="inv-kpi__icon" style={{ background: 'rgba(42,108,149,0.1)', color: '#2A6C95' }}><Send size={20} /></div>
                    <div>
                        <div className="inv-kpi__value">{fmt$(stats.sentAmt)}</div>
                        <div className="inv-kpi__label">Enviadas</div>
                    </div>
                </div>
                <div className="inv-kpi">
                    <div className="inv-kpi__icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}><DollarSign size={20} /></div>
                    <div>
                        <div className="inv-kpi__value">{fmt$(stats.paidMonth)}</div>
                        <div className="inv-kpi__label">Pagadas (mes)</div>
                    </div>
                </div>
            </div>

            {/* Toolbar / Filters */}
            <div className="inv-toolbar">
                <div className="inv-search-box">
                    <Search size={14} />
                    <input
                        className="inv-search"
                        placeholder="Buscar por #, cliente, proyecto..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                    />
                </div>
                <select className="inv-select" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                    <option value="">Todos los Clientes</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
                <select className="inv-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="">Todos los Status</option>
                    <option value="draft">Borrador</option>
                    <option value="pending_approval">Pend. Aprobación</option>
                    <option value="approved">Aprobada</option>
                    <option value="sent">Enviada</option>
                    <option value="paid">Pagada</option>
                    <option value="overdue">Vencida</option>
                </select>
                <input type="date" className="inv-select" value={filterStart} onChange={e => setFilterStart(e.target.value)} title="Desde" />
                <input type="date" className="inv-select" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} title="Hasta" />
                <button className="inv-refresh-btn" onClick={loadInvoices} title="Actualizar">
                    <RefreshCw size={14} />
                </button>
                <span className="inv-count">{displayInvoices.length} facturas</span>
            </div>

            {/* Table */}
            <div className="inv-table-wrap">
                {loading ? (
                    <div className="inv-empty-state">
                        <span className="inv-pulse-loader" /> Cargando facturas...
                    </div>
                ) : displayInvoices.length === 0 ? (
                    <div className="inv-empty-state">
                        <FileText size={48} style={{ opacity: 0.3 }} />
                        <p>No se encontraron facturas</p>
                        <button className="inv-btn-generate" style={{ marginTop: 12 }} onClick={() => setShowGenerate(true)}>
                            <Plus size={14} /> Generar primera factura
                        </button>
                    </div>
                ) : (
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Cliente</th>
                                <th>Proyecto</th>
                                <th>Semana</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th>Status</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayInvoices.map(inv => (
                                <tr key={inv.id} onClick={() => setSelectedInvoice(inv)}>
                                    <td>
                                        <button 
                                            className="inv-number-link" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/admin/invoices/${inv.id}`);
                                            }}
                                            title="Ver PDF"
                                        >
                                            #{inv.invoice_number}
                                        </button>
                                    </td>
                                    <td>{inv.client?.company_name || '—'}</td>
                                    <td>{inv.project?.name || '—'}</td>
                                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtDateRange(inv.week_start_date, inv.week_end_date)}</td>
                                    <td style={{ textAlign: 'right' }}><span className="inv-total">{fmt$(inv.total)}</span></td>
                                    <td><StatusBadge status={inv.status} /></td>
                                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtDate(inv.invoice_date)}</td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <div className="inv-row-actions">
                                            <button className="inv-action-btn" title="Editar" onClick={() => setShowEdit(inv)}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="inv-action-btn" title="Ver detalles" onClick={() => setSelectedInvoice(inv)}>
                                                <Eye size={14} />
                                            </button>
                                            <button className="inv-action-btn" title="Abrir PDF" onClick={() => navigate(`/admin/invoices/${inv.id}`)}>
                                                <Printer size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Drawer */}
            {selectedInvoice && (
                <InvoiceDrawer
                    invoice={selectedInvoice}
                    onClose={() => setSelectedInvoice(null)}
                    onRefresh={() => { loadInvoices(); }}
                    navigate={navigate}
                    onEdit={inv => setShowEdit(inv)}
                />
            )}

            {/* Edit Modal */}
            {showEdit && (
                <EditModal
                    invoice={showEdit}
                    onClose={() => setShowEdit(null)}
                    onSaved={upd => {
                        loadInvoices();
                        if (selectedInvoice?.id === upd.id) setSelectedInvoice(upd);
                    }}
                    showToast={showToast}
                />
            )}

            {/* Generate Modal */}
            {showGenerate && (
                <GenerateModal
                    clients={clients}
                    onClose={() => setShowGenerate(false)}
                    onGenerated={inv => { setInvoices(prev => [inv, ...prev]); setSelectedInvoice(inv); }}
                    showToast={showToast}
                />
            )}
        </div>
    );
}
