import { useState, useEffect, useCallback } from 'react';
import {
    BarChart2, Clock, FileText, DollarSign, TrendingUp,
    Download, Calendar, ChevronDown, Users, Building2,
    AlertCircle, RefreshCw
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import useApi from '../../hooks/useApi';
import './Reports.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const today = new Date();
const fmt = (d) => d?.toISOString().split('T')[0] || '';
const firstOfMonth = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
const lastOfMonth = fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0));

function exportCSV(headers, rows, filename) {
    const lines = [headers.join(','), ...rows.map(r => r.map(v => `"${v ?? ''}"`).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ─── Tab: Hours ───────────────────────────────────────────────────────────────
function HoursTab({ from, to, workers, projects }) {
    const { get } = useApi();
    const [entries, setEntries] = useState([]);
    const [filterWorker, setFilterWorker] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetch = useCallback(async () => {
        setLoading(true); setError('');
        try {
            let url = `/time-entries?from=${from}&to=${to}&status=approved`;
            if (filterWorker) url += `&worker_id=${filterWorker}`;
            if (filterProject) url += `&project_id=${filterProject}`;
            const res = await get(url);
            const list = res.data || res;
            setEntries(Array.isArray(list) ? list : []);
        } catch { setError('Error al cargar horas.'); }
        finally { setLoading(false); }
    }, [get, from, to, filterWorker, filterProject]);

    useEffect(() => { fetch(); }, [fetch]);

    // Aggregate by worker
    const byWorker = {};
    entries.forEach(e => {
        const id = e.worker_id;
        const name = `${e.worker?.first_name || ''} ${e.worker?.last_name || ''}`.trim() || e.worker?.worker_code || `W${id}`;
        if (!byWorker[id]) byWorker[id] = { name, regular: 0, overtime: 0, total: 0 };
        const hrs = parseFloat(e.total_hours || 0);
        byWorker[id].total += hrs;
    });

    // Apply 40h/week OT rule per worker
    const rows = Object.values(byWorker).map(w => ({
        ...w,
        regular: parseFloat(Math.min(w.total, 40).toFixed(2)),
        overtime: parseFloat(Math.max(0, w.total - 40).toFixed(2)),
        total: parseFloat(w.total.toFixed(2)),
    }));

    const chartData = rows.slice(0, 12).map(r => ({ name: r.name.split(' ')[0], Regular: r.regular, OT: r.overtime }));

    const doExport = () => {
        exportCSV(
            ['Trabajador', 'Horas Regulares', 'Horas OT', 'Total Horas'],
            rows.map(r => [r.name, r.regular, r.overtime, r.total]),
            `horas_${from}_${to}.csv`
        );
    };

    return (
        <div className="rpt-tab-content">
            {/* Filters */}
            <div className="rpt-filters">
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterWorker} onChange={e => setFilterWorker(e.target.value)}>
                        <option value="">Todos los Workers</option>
                        {workers.map(w => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                        <option value="">Todos los Proyectos</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <button className="rpt-export-btn" onClick={doExport}><Download size={14} /> Exportar CSV</button>
            </div>

            {error && <div className="rpt-error"><AlertCircle size={14} /> {error}</div>}
            {loading && <div className="rpt-loading"><RefreshCw size={18} className="rpt-spin" /> Cargando...</div>}

            {!loading && rows.length > 0 && (
                <>
                    <div className="rpt-chart-box">
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="Regular" fill="#2A6C95" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="OT" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="rpt-table-wrap">
                        <table className="rpt-table">
                            <thead><tr><th>Trabajador</th><th>Hrs Regulares</th><th>Hrs OT</th><th>Total</th></tr></thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={i}>
                                        <td>{r.name}</td>
                                        <td>{r.regular}h</td>
                                        <td className={r.overtime > 0 ? 'rpt-ot' : ''}>{r.overtime}h</td>
                                        <td><strong>{r.total}h</strong></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
            {!loading && rows.length === 0 && !error && (
                <div className="rpt-empty"><BarChart2 size={40} /><p>Sin datos para el período seleccionado</p></div>
            )}
        </div>
    );
}

// ─── Tab: Invoicing ───────────────────────────────────────────────────────────
function InvoicingTab({ from, to, clients }) {
    const { get } = useApi();
    const [invoices, setInvoices] = useState([]);
    const [filterClient, setFilterClient] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetch = useCallback(async () => {
        setLoading(true); setError('');
        try {
            let url = `/invoices?from=${from}&to=${to}`;
            if (filterClient) url += `&client_id=${filterClient}`;
            const res = await get(url);
            const list = res.data || res;
            setInvoices(Array.isArray(list) ? list : []);
        } catch { setError('Error al cargar facturas.'); }
        finally { setLoading(false); }
    }, [get, from, to, filterClient]);

    useEffect(() => { fetch(); }, [fetch]);

    const totals = invoices.reduce((acc, inv) => {
        acc.total += parseFloat(inv.total || 0);
        if (inv.status === 'paid') acc.paid += parseFloat(inv.total || 0);
        else acc.pending += parseFloat(inv.total || 0);
        return acc;
    }, { total: 0, paid: 0, pending: 0 });

    // Chart: by month
    const byMonth = {};
    invoices.forEach(inv => {
        const m = inv.invoice_date?.slice(0, 7) || '—';
        byMonth[m] = (byMonth[m] || 0) + parseFloat(inv.total || 0);
    });
    const chartData = Object.entries(byMonth).sort().map(([k, v]) => ({ mes: k, Total: parseFloat(v.toFixed(2)) }));

    const doExport = () => {
        exportCSV(
            ['#Factura', 'Cliente', 'Proyecto', 'Total', 'Status', 'Fecha'],
            invoices.map(i => [i.invoice_number, i.client?.company_name, i.project?.name, i.total, i.status, i.invoice_date]),
            `facturas_${from}_${to}.csv`
        );
    };

    const STATUS_LABELS = { draft: 'Borrador', pending_approval: 'Pend. Aprobación', approved: 'Aprobada', sent: 'Enviada', paid: 'Pagada', overdue: 'Vencida' };

    return (
        <div className="rpt-tab-content">
            <div className="rpt-filters">
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                        <option value="">Todos los Clientes</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <button className="rpt-export-btn" onClick={doExport}><Download size={14} /> Exportar CSV</button>
            </div>

            {/* KPI Cards */}
            <div className="rpt-kpis">
                {[
                    { label: 'Total Facturado', value: `$${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: '#2A6C95' },
                    { label: 'Pagado', value: `$${totals.paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: '#10B981' },
                    { label: 'Pendiente', value: `$${totals.pending.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: '#F59E0B' },
                ].map(k => (
                    <div key={k.label} className="rpt-kpi" style={{ borderColor: k.color }}>
                        <p className="rpt-kpi__value" style={{ color: k.color }}>{k.value}</p>
                        <p className="rpt-kpi__label">{k.label}</p>
                    </div>
                ))}
            </div>

            {error && <div className="rpt-error"><AlertCircle size={14} /> {error}</div>}
            {loading && <div className="rpt-loading"><RefreshCw size={18} className="rpt-spin" /> Cargando...</div>}

            {!loading && chartData.length > 0 && (
                <div className="rpt-chart-box">
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={v => `$${parseFloat(v).toFixed(2)}`} />
                            <Bar dataKey="Total" fill="#2A6C95" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {!loading && invoices.length > 0 && (
                <div className="rpt-table-wrap">
                    <table className="rpt-table">
                        <thead><tr><th>#</th><th>Cliente</th><th>Proyecto</th><th>Total</th><th>Status</th><th>Fecha</th></tr></thead>
                        <tbody>
                            {invoices.map(inv => (
                                <tr key={inv.id}>
                                    <td><code>{inv.invoice_number}</code></td>
                                    <td>{inv.client?.company_name || '—'}</td>
                                    <td>{inv.project?.name || '—'}</td>
                                    <td><strong>${parseFloat(inv.total || 0).toFixed(2)}</strong></td>
                                    <td><span className={`rpt-status rpt-status--${inv.status}`}>{STATUS_LABELS[inv.status] || inv.status}</span></td>
                                    <td>{inv.invoice_date}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {!loading && invoices.length === 0 && !error && (
                <div className="rpt-empty"><FileText size={40} /><p>Sin facturas para el período seleccionado</p></div>
            )}
        </div>
    );
}

// ─── Tab: Payroll ─────────────────────────────────────────────────────────────
function PayrollTab({ from, to, workers }) {
    const { get } = useApi();
    const [payrolls, setPayrolls] = useState([]);
    const [filterWorker, setFilterWorker] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetch = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await get(`/payroll?from=${from}&to=${to}`);
            const list = res.data || res;
            setPayrolls(Array.isArray(list) ? list : []);
        } catch { setError('Error al cargar nómina.'); }
        finally { setLoading(false); }
    }, [get, from, to]);

    useEffect(() => { fetch(); }, [fetch]);

    // Aggregate lines by worker
    const byWorker = {};
    payrolls.forEach(p => {
        (p.lines || []).forEach(line => {
            if (filterWorker && String(line.worker_id) !== filterWorker) return;
            const wId = line.worker_id;
            const name = `${line.worker?.first_name || ''} ${line.worker?.last_name || ''}`.trim() || `W${wId}`;
            if (!byWorker[wId]) byWorker[wId] = { name, gross: 0, deductions: 0, perDiem: 0, net: 0, weeks: 0 };
            byWorker[wId].gross += parseFloat(line.gross_pay || 0);
            byWorker[wId].deductions += parseFloat(line.deductions || 0);
            byWorker[wId].perDiem += parseFloat(line.per_diem_total || 0);
            byWorker[wId].net += parseFloat(line.net_pay || 0);
            byWorker[wId].weeks += 1;
        });
    });

    const rows = Object.values(byWorker).map(r => ({
        ...r,
        gross: parseFloat(r.gross.toFixed(2)),
        deductions: parseFloat(r.deductions.toFixed(2)),
        perDiem: parseFloat(r.perDiem.toFixed(2)),
        net: parseFloat(r.net.toFixed(2)),
    }));

    const doExport = () => {
        exportCSV(
            ['Trabajador', 'Gross Pay', 'Deducciones', 'Per Diem', 'Net Pay', 'Semanas'],
            rows.map(r => [r.name, r.gross, r.deductions, r.perDiem, r.net, r.weeks]),
            `nomina_${from}_${to}.csv`
        );
    };

    return (
        <div className="rpt-tab-content">
            <div className="rpt-filters">
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterWorker} onChange={e => setFilterWorker(e.target.value)}>
                        <option value="">Todos los Workers</option>
                        {workers.map(w => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <button className="rpt-export-btn" onClick={doExport}><Download size={14} /> Exportar CSV</button>
            </div>

            {error && <div className="rpt-error"><AlertCircle size={14} /> {error}</div>}
            {loading && <div className="rpt-loading"><RefreshCw size={18} className="rpt-spin" /> Cargando...</div>}

            {!loading && rows.length > 0 && (
                <div className="rpt-table-wrap">
                    <table className="rpt-table">
                        <thead><tr><th>Trabajador</th><th>Gross Pay</th><th>Deducciones</th><th>Per Diem</th><th>Net Pay</th><th>Semanas</th></tr></thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={i}>
                                    <td>{r.name}</td>
                                    <td>${r.gross.toFixed(2)}</td>
                                    <td className="rpt-ded">${r.deductions.toFixed(2)}</td>
                                    <td className="rpt-perdiem">${r.perDiem.toFixed(2)}</td>
                                    <td><strong>${r.net.toFixed(2)}</strong></td>
                                    <td>{r.weeks}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td><strong>Total</strong></td>
                                <td><strong>${rows.reduce((s, r) => s + r.gross, 0).toFixed(2)}</strong></td>
                                <td><strong>${rows.reduce((s, r) => s + r.deductions, 0).toFixed(2)}</strong></td>
                                <td><strong>${rows.reduce((s, r) => s + r.perDiem, 0).toFixed(2)}</strong></td>
                                <td><strong>${rows.reduce((s, r) => s + r.net, 0).toFixed(2)}</strong></td>
                                <td>—</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
            {!loading && rows.length === 0 && !error && (
                <div className="rpt-empty"><DollarSign size={40} /><p>Sin datos de nómina para el período</p></div>
            )}
        </div>
    );
}

// ─── Tab: Margins ─────────────────────────────────────────────────────────────
function MarginsTab({ from, to }) {
    const { get } = useApi();
    const [groupBy, setGroupBy] = useState('worker');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetch = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const endpoint = groupBy === 'worker' ? '/accounting/margins/workers' : '/accounting/margins/clients';
            const res = await get(`${endpoint}?from=${from}&to=${to}`);
            const list = res.data || res;
            setData(Array.isArray(list) ? list : []);
        } catch { setError('Error al cargar márgenes.'); }
        finally { setLoading(false); }
    }, [get, from, to, groupBy]);

    useEffect(() => { fetch(); }, [fetch]);

    const chartData = data.slice(0, 10).map(d => ({
        name: (d.worker_name || d.client_name || '—').split(' ')[0],
        Cobrado: d.billed,
        Pagado: d.paid || d.cost,
        Margen: d.margin,
    }));

    const doExport = () => {
        exportCSV(
            [groupBy === 'worker' ? 'Worker' : 'Cliente', 'Cobrado', 'Pagado/Costo', 'Margen', '%'],
            data.map(d => [d.worker_name || d.client_name, d.billed, d.paid || d.cost, d.margin, d.margin_pct]),
            `margenes_${groupBy}_${from}_${to}.csv`
        );
    };

    return (
        <div className="rpt-tab-content">
            <div className="rpt-filters">
                <div className="rpt-toggle-group">
                    <button className={`rpt-toggle ${groupBy === 'worker' ? 'rpt-toggle--active' : ''}`} onClick={() => setGroupBy('worker')}>
                        <Users size={13} /> Por Worker
                    </button>
                    <button className={`rpt-toggle ${groupBy === 'client' ? 'rpt-toggle--active' : ''}`} onClick={() => setGroupBy('client')}>
                        <Building2 size={13} /> Por Cliente
                    </button>
                </div>
                <button className="rpt-export-btn" onClick={doExport}><Download size={14} /> Exportar CSV</button>
            </div>

            <div className="rpt-note"><TrendingUp size={13} /> Per Diem es passthrough — no se incluye en márgenes ni P&L</div>

            {error && <div className="rpt-error"><AlertCircle size={14} /> {error}</div>}
            {loading && <div className="rpt-loading"><RefreshCw size={18} className="rpt-spin" /> Cargando...</div>}

            {!loading && chartData.length > 0 && (
                <div className="rpt-chart-box">
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                            <Tooltip formatter={v => `$${parseFloat(v).toFixed(2)}`} />
                            <Legend />
                            <Bar dataKey="Cobrado" fill="#2A6C95" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Pagado" fill="#6B7280" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Margen" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {!loading && data.length > 0 && (
                <div className="rpt-table-wrap">
                    <table className="rpt-table">
                        <thead>
                            <tr>
                                <th>{groupBy === 'worker' ? 'Worker' : 'Cliente'}</th>
                                <th>Cobrado</th><th>Pagado/Costo</th><th>Margen</th><th>%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((d, i) => (
                                <tr key={i}>
                                    <td>{d.worker_name || d.client_name || '—'}</td>
                                    <td>${parseFloat(d.billed || 0).toFixed(2)}</td>
                                    <td>${parseFloat(d.paid || d.cost || 0).toFixed(2)}</td>
                                    <td className={d.margin >= 0 ? 'rpt-positive' : 'rpt-negative'}>
                                        ${parseFloat(d.margin || 0).toFixed(2)}
                                    </td>
                                    <td className={d.margin_pct >= 0 ? 'rpt-positive' : 'rpt-negative'}>
                                        {parseFloat(d.margin_pct || 0).toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {!loading && data.length === 0 && !error && (
                <div className="rpt-empty"><TrendingUp size={40} /><p>Sin datos de márgenes para el período</p></div>
            )}
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = [
    { id: 'hours', label: 'Horas', icon: Clock },
    { id: 'invoicing', label: 'Facturación', icon: FileText },
    { id: 'payroll', label: 'Nómina', icon: DollarSign },
    { id: 'margins', label: 'Márgenes', icon: TrendingUp },
];

export default function Reports() {
    const { get } = useApi();
    const [activeTab, setActiveTab] = useState('hours');
    const [from, setFrom] = useState(firstOfMonth);
    const [to, setTo] = useState(lastOfMonth);
    const [workers, setWorkers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [clients, setClients] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [w, p, c] = await Promise.all([
                    get('/workers').then(r => r.data || r),
                    get('/projects').then(r => r.data || r),
                    get('/clients').then(r => r.data || r),
                ]);
                setWorkers(Array.isArray(w) ? w : []);
                setProjects(Array.isArray(p) ? p : []);
                setClients(Array.isArray(c) ? c : []);
            } catch { /* ignore */ }
        };
        load();
    }, [get]);

    return (
        <div className="rpt-page fade-in">
            {/* Header */}
            <div className="rpt-header">
                <div>
                    <h1 className="rpt-title">Reportes</h1>
                    <p className="rpt-subtitle">Analiza el rendimiento operativo y financiero</p>
                </div>
            </div>

            {/* Period filters */}
            <div className="rpt-period-bar">
                <Calendar size={15} className="rpt-period__icon" />
                <span className="rpt-period__label">Período:</span>
                <div className="rpt-date-inputs">
                    <input type="date" className="rpt-date-input" value={from} onChange={e => setFrom(e.target.value)} />
                    <span>—</span>
                    <input type="date" className="rpt-date-input" value={to} onChange={e => setTo(e.target.value)} />
                </div>
            </div>

            {/* Tabs */}
            <div className="rpt-tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`rpt-tab ${activeTab === tab.id ? 'rpt-tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <tab.icon size={15} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="rpt-content-area">
                {activeTab === 'hours' && <HoursTab from={from} to={to} workers={workers} projects={projects} />}
                {activeTab === 'invoicing' && <InvoicingTab from={from} to={to} clients={clients} />}
                {activeTab === 'payroll' && <PayrollTab from={from} to={to} workers={workers} />}
                {activeTab === 'margins' && <MarginsTab from={from} to={to} />}
            </div>
        </div>
    );
}
