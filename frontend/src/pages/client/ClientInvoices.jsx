import { useState, useEffect } from 'react';
import { FileText, Download, AlertCircle, Filter } from 'lucide-react';
import useApi from '../../hooks/useApi';
import rawApi from '../../utils/api';
import './ClientInvoices.css';

const fmt$ = (v) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(v || 0));
};

const fmtDate = (d) => {
    if (!d) return '—';
    const [y, m, day] = (d + '').slice(0, 10).split('-');
    return `${m}/${day}/${y}`;
};

const STATUS_CONFIG = {
    draft:            { label: 'Draft',            color: '#64748B', bg: 'rgba(100,116,139,0.1)' },
    pending_approval: { label: 'Pending Approval', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
    approved:         { label: 'Approved',         color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
    sent:             { label: 'Sent',             color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
    paid:             { label: 'Paid',             color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    overdue:          { label: 'Overdue',          color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

const STATUS_FILTERS = [
    { value: '', label: 'All' },
    { value: 'sent', label: 'Sent' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'paid', label: 'Paid' },
    { value: 'approved', label: 'Approved' },
];

const ClientInvoices = () => {
    const { get, loading, error } = useApi();
    const [invoices, setInvoices] = useState([]);
    const [statusFilter, setStatusFilter] = useState('');
    const [expanded, setExpanded] = useState(null);
    const [pdfLoading, setPdfLoading] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const url = statusFilter ? `/client/invoices?status=${statusFilter}` : '/client/invoices';
        get(url).then(res => {
            if (!cancelled && res?.success) setInvoices(res.data);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleViewPdf = async (invId) => {
        try {
            setPdfLoading(invId);
            const res = await rawApi.get(`/client/invoices/${invId}/html`, { responseType: 'text' });
            const blob = new Blob([res.data], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch {
            alert('Could not load the invoice. Please try again.');
        } finally {
            setPdfLoading(null);
        }
    };

    const toggleExpand = (id) => setExpanded(prev => prev === id ? null : id);

    if (loading && invoices.length === 0) return (
        <div className="client-loading">
            <div className="client-spinner" />
            <span>Loading invoices...</span>
        </div>
    );

    if (error) return (
        <div className="client-error">
            <AlertCircle size={20} />
            <span>{error}</span>
        </div>
    );

    const totalOutstanding = invoices
        .filter(i => i.status === 'sent' || i.status === 'overdue')
        .reduce((s, i) => s + parseFloat(i.total || 0), 0);

    return (
        <div className="cinvoices">
            <div className="cinvoices__header">
                <div>
                    <h1 className="cinvoices__title">Invoices</h1>
                    {totalOutstanding > 0 && (
                        <p className="cinvoices__outstanding">
                            Outstanding balance: <strong>{fmt$(totalOutstanding)}</strong>
                        </p>
                    )}
                </div>
            </div>

            {/* Status filter pills */}
            <div className="cinvoices__filters">
                <Filter size={14} style={{ color: 'var(--text-muted)', marginRight: 4 }} />
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.value}
                        className={`cinvoices__filter-btn ${statusFilter === f.value ? 'cinvoices__filter-btn--active' : ''}`}
                        onClick={() => setStatusFilter(f.value)}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {invoices.length === 0 ? (
                <div className="cinvoices__empty">
                    <FileText size={40} />
                    <p>No invoices found.</p>
                </div>
            ) : (
                <div className="cinvoices__list">
                    {invoices.map(inv => {
                        const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                        const isExpanded = expanded === inv.id;

                        return (
                            <div key={inv.id} className={`cinv-row ${isExpanded ? 'cinv-row--expanded' : ''}`}>
                                {/* Main row */}
                                <div className="cinv-row__main" onClick={() => toggleExpand(inv.id)}>
                                    <div className="cinv-row__left">
                                        <div className="cinv-row__icon">
                                            <FileText size={16} />
                                        </div>
                                        <div>
                                            <div className="cinv-row__number">#{inv.invoice_number}</div>
                                            <div className="cinv-row__project">{inv.project?.name || '—'}</div>
                                        </div>
                                    </div>

                                    <div className="cinv-row__dates">
                                        <span className="cinv-row__date-label">Issued</span>
                                        <span className="cinv-row__date-val">{fmtDate(inv.invoice_date)}</span>
                                    </div>

                                    <div className="cinv-row__dates">
                                        <span className="cinv-row__date-label">Due</span>
                                        <span className="cinv-row__date-val"
                                            style={inv.status === 'overdue' ? { color: '#EF4444', fontWeight: 700 } : {}}>
                                            {fmtDate(inv.due_date)}
                                        </span>
                                    </div>

                                    <div className="cinv-row__total">{fmt$(inv.total)}</div>

                                    <span className="cinv-row__badge"
                                        style={{ background: cfg.bg, color: cfg.color }}>
                                        {cfg.label}
                                    </span>

                                    <button
                                        className="cinv-row__pdf-btn"
                                        title="View PDF"
                                        disabled={pdfLoading === inv.id}
                                        onClick={(e) => { e.stopPropagation(); handleViewPdf(inv.id); }}
                                    >
                                        {pdfLoading === inv.id
                                            ? <span className="cinv-spinner" />
                                            : <Download size={15} />
                                        }
                                    </button>
                                </div>

                                {/* Expanded detail */}
                                {isExpanded && (
                                    <div className="cinv-row__detail">
                                        <div className="cinv-detail-grid">
                                            <div className="cinv-detail-item">
                                                <span className="cinv-detail-label">Week</span>
                                                <span className="cinv-detail-val">
                                                    {fmtDate(inv.week_start_date)} – {fmtDate(inv.week_end_date)}
                                                </span>
                                            </div>
                                            <div className="cinv-detail-item">
                                                <span className="cinv-detail-label">Subtotal</span>
                                                <span className="cinv-detail-val">{fmt$(inv.subtotal)}</span>
                                            </div>
                                            <div className="cinv-detail-item">
                                                <span className="cinv-detail-label">Per Diem</span>
                                                <span className="cinv-detail-val">{fmt$(inv.per_diem_total)}</span>
                                            </div>
                                            <div className="cinv-detail-item">
                                                <span className="cinv-detail-label">Tax</span>
                                                <span className="cinv-detail-val">{fmt$(inv.tax_amount)}</span>
                                            </div>
                                            <div className="cinv-detail-item">
                                                <span className="cinv-detail-label">Adjustments</span>
                                                <span className="cinv-detail-val">{fmt$(inv.adjustments)}</span>
                                            </div>
                                            <div className="cinv-detail-item">
                                                <span className="cinv-detail-label">Total</span>
                                                <span className="cinv-detail-val cinv-detail-val--total">{fmt$(inv.total)}</span>
                                            </div>
                                            {inv.paid_at && (
                                                <div className="cinv-detail-item">
                                                    <span className="cinv-detail-label">Paid On</span>
                                                    <span className="cinv-detail-val">{fmtDate(inv.paid_at)}</span>
                                                </div>
                                            )}
                                            {inv.payment_method && (
                                                <div className="cinv-detail-item">
                                                    <span className="cinv-detail-label">Payment Method</span>
                                                    <span className="cinv-detail-val" style={{ textTransform: 'capitalize' }}>
                                                        {inv.payment_method}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {inv.notes && (
                                            <div className="cinv-detail-notes">
                                                <span className="cinv-detail-label">Notes</span>
                                                <p className="cinv-detail-notes-text">{inv.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ClientInvoices;
