import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Users, FileText, DollarSign, ArrowRight, AlertCircle } from 'lucide-react';
import useApi from '../../hooks/useApi';
import './ClientDashboard.css';

const fmt$ = (v) => {
    const n = parseFloat(v || 0);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
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

const ClientDashboard = () => {
    const { get, loading, error } = useApi();
    const [data, setData] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        get('/client/dashboard').then(res => {
            if (!cancelled && res?.success) setData(res.data);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) return (
        <div className="client-loading">
            <div className="client-spinner" />
            <span>Loading dashboard...</span>
        </div>
    );

    if (error) return (
        <div className="client-error">
            <AlertCircle size={20} />
            <span>{error}</span>
        </div>
    );

    const { client, kpis, recentInvoices } = data || {};

    return (
        <div className="cdash">
            {/* Page header */}
            <div className="cdash__header">
                <div>
                    <h1 className="cdash__title">Dashboard</h1>
                    <p className="cdash__subtitle">Welcome back, {client?.contact_name || client?.company_name}</p>
                </div>
                <div className="cdash__company-badge">
                    <span>{client?.company_name}</span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="cdash__kpis">
                <div className="cdash__kpi cdash__kpi--blue" onClick={() => navigate('/client/projects')}>
                    <div className="cdash__kpi-icon cdash__kpi-icon--blue">
                        <FolderOpen size={20} />
                    </div>
                    <div className="cdash__kpi-body">
                        <span className="cdash__kpi-value">{kpis?.activeProjects ?? '—'}</span>
                        <span className="cdash__kpi-label">Active Projects</span>
                    </div>
                </div>

                <div className="cdash__kpi cdash__kpi--green" onClick={() => navigate('/client/workers')}>
                    <div className="cdash__kpi-icon cdash__kpi-icon--green">
                        <Users size={20} />
                    </div>
                    <div className="cdash__kpi-body">
                        <span className="cdash__kpi-value">{kpis?.workersToday ?? '—'}</span>
                        <span className="cdash__kpi-label">Workers On-Site Today</span>
                    </div>
                </div>

                <div className="cdash__kpi cdash__kpi--purple" onClick={() => navigate('/client/invoices')}>
                    <div className="cdash__kpi-icon cdash__kpi-icon--purple">
                        <FileText size={20} />
                    </div>
                    <div className="cdash__kpi-body">
                        <span className="cdash__kpi-value">{kpis?.openInvoiceCount ?? '—'}</span>
                        <span className="cdash__kpi-label">Open Invoices</span>
                    </div>
                </div>

                <div className="cdash__kpi cdash__kpi--amber" onClick={() => navigate('/client/invoices')}>
                    <div className="cdash__kpi-icon cdash__kpi-icon--amber">
                        <DollarSign size={20} />
                    </div>
                    <div className="cdash__kpi-body">
                        <span className="cdash__kpi-value">{fmt$(kpis?.openInvoiceTotal)}</span>
                        <span className="cdash__kpi-label">Outstanding Balance</span>
                    </div>
                </div>
            </div>

            {/* Recent Invoices */}
            <div className="cdash__section">
                <div className="cdash__section-header">
                    <h2 className="cdash__section-title">Recent Invoices</h2>
                    <button className="cdash__view-all" onClick={() => navigate('/client/invoices')}>
                        View All <ArrowRight size={14} />
                    </button>
                </div>

                {recentInvoices?.length === 0 ? (
                    <div className="cdash__empty">No invoices yet.</div>
                ) : (
                    <div className="cdash__invoices-table-wrap">
                        <table className="cdash__invoices-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Project</th>
                                    <th>Date</th>
                                    <th>Due</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentInvoices?.map(inv => {
                                    const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                                    return (
                                        <tr key={inv.id}
                                            className="cdash__invoice-row"
                                            onClick={() => navigate('/client/invoices')}
                                        >
                                            <td className="cdash__inv-num">#{inv.invoice_number}</td>
                                            <td>{inv.project?.name || '—'}</td>
                                            <td>{fmtDate(inv.invoice_date)}</td>
                                            <td>{fmtDate(inv.due_date)}</td>
                                            <td className="cdash__inv-total">{fmt$(inv.total)}</td>
                                            <td>
                                                <span className="cdash__status-badge"
                                                    style={{ background: cfg.bg, color: cfg.color }}>
                                                    {cfg.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientDashboard;
