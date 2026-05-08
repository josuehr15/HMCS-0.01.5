import { useState, useEffect, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend
} from 'recharts';
import { Download, ChevronDown, AlertCircle, RefreshCw, FileText, Clock, FileText as FileIcon, DollarSign, BarChart3, Calendar } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import useApi from '../../hooks/useApi';
import {
    exportHoursPDF,
    exportInvoicingPDF,
    exportPayrollPDF,
    exportMarginsPDF,
    exportPnLPDF,
} from '../../utils/exportPDF';
import {
    exportHoursXLSX,
    exportInvoicingXLSX,
    exportPayrollXLSX,
    exportMarginsXLSX,
    exportPnLXLSX,
} from '../../utils/exportXLSX';
import './Reports.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today = new Date();
const fmt = (d) => d?.toISOString().split('T')[0] || '';
const firstOfMonth = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
const lastOfMonth = fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0));
const money = (n) =>
    `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, valueColor, sub, subType }) {
    return (
        <div className="reports__kpi-card">
            <p className="reports__kpi-label">{label}</p>
            <p className="reports__kpi-value" style={valueColor ? { color: valueColor } : {}}>
                {value}
            </p>
            {sub && (
                <p className={`reports__kpi-sub${subType ? ` reports__kpi-sub--${subType}` : ''}`}>
                    {sub}
                </p>
            )}
        </div>
    );
}

// ─── Tab: Hours ───────────────────────────────────────────────────────────────
function HoursTab({ from, to, workers, projects }) {
    const { get } = useApi();
    const [entries, setEntries] = useState([]);
    const [filterWorker, setFilterWorker] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadData = useCallback(async () => {
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

    useEffect(() => { loadData(); }, [loadData]);

    // KPIs from raw time-entry fields
    const kpiTotal = entries.reduce((s, e) => s + parseFloat(e.total_hours || 0), 0);
    const kpiRegular = entries.reduce((s, e) => s + parseFloat(e.regular_hours || 0), 0);
    const kpiOT = entries.reduce((s, e) => s + parseFloat(e.overtime_hours || 0), 0);
    const uniqueWorkerCount = new Set(entries.map(e => e.worker_id)).size;
    const kpiAvg = uniqueWorkerCount > 0 ? kpiTotal / uniqueWorkerCount : 0;

    // Aggregate by worker for table/chart
    const byWorker = {};
    entries.forEach(e => {
        const id = e.worker_id;
        const name = `${e.worker?.first_name || ''} ${e.worker?.last_name || ''}`.trim()
            || e.worker?.worker_code || `W${id}`;
        if (!byWorker[id]) byWorker[id] = { name, regular: 0, overtime: 0, total: 0 };
        byWorker[id].regular += parseFloat(e.regular_hours || 0);
        byWorker[id].overtime += parseFloat(e.overtime_hours || 0);
        byWorker[id].total += parseFloat(e.total_hours || 0);
    });

    const rows = Object.values(byWorker).map(w => ({
        name: w.name,
        regular: parseFloat(w.regular.toFixed(2)),
        overtime: parseFloat(w.overtime.toFixed(2)),
        total: parseFloat(w.total.toFixed(2)),
    }));

    const chartData = rows.slice(0, 12).map(r => ({
        name: r.name.split(' ')[0],
        Regular: r.regular,
        OT: r.overtime,
    }));

    const doExportXLSX = () => exportHoursXLSX({
        from, to, rows,
        kpis: [
            { label: 'TOTAL HORAS',       value: `${kpiTotal.toFixed(1)}h`   },
            { label: 'HORAS REGULARES',   value: `${kpiRegular.toFixed(1)}h` },
            { label: 'HORAS OVERTIME',    value: `${kpiOT.toFixed(1)}h`      },
            { label: 'PROMEDIO / WORKER', value: `${kpiAvg.toFixed(1)}h`     },
        ],
    });

    const doExportPDF = () => exportHoursPDF({
        from, to, rows,
        kpis: [
            { label: 'TOTAL HORAS',       value: `${kpiTotal.toFixed(1)}h`   },
            { label: 'HORAS REGULARES',   value: `${kpiRegular.toFixed(1)}h` },
            { label: 'HORAS OVERTIME',    value: `${kpiOT.toFixed(1)}h`      },
            { label: 'PROMEDIO / WORKER', value: `${kpiAvg.toFixed(1)}h`     },
        ],
    });

    return (
        <div className="rpt-tab-content">
            <div className="reports__kpi-row reports__kpi-row--4">
                <KpiCard label="TOTAL HORAS" value={`${kpiTotal.toFixed(1)}h`} valueColor="#2A6C95" />
                <KpiCard label="HORAS REGULARES" value={`${kpiRegular.toFixed(1)}h`} />
                <KpiCard label="HORAS OVERTIME" value={`${kpiOT.toFixed(1)}h`} valueColor="#D97706" />
                <KpiCard
                    label="PROMEDIO / WORKER"
                    value={`${kpiAvg.toFixed(1)}h`}
                    sub={uniqueWorkerCount > 0 ? `${uniqueWorkerCount} workers en el período` : 'Sin datos'}
                />
            </div>

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
                <button className="rpt-export-btn" onClick={doExportXLSX} disabled={rows.length === 0}><Download size={14} /> Exportar Excel</button>
                <button className="rpt-export-btn rpt-export-btn--pdf" onClick={doExportPDF} disabled={rows.length === 0}><FileText size={14} /> Exportar PDF</button>
            </div>

            {error && <div className="rpt-error"><AlertCircle size={14} /> {error}</div>}
            {loading && <div className="rpt-loading"><RefreshCw size={18} className="rpt-spin" /> Cargando...</div>}

            {!loading && rows.length > 0 && (
                <>
                    <div className="reports__section-card">
                        <p className="reports__section-label">Horas por Trabajador</p>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="Regular" fill="#2A6C95" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="OT" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="reports__section-card reports__section-card--table">
                        <p className="reports__section-label">Detalle por Trabajador</p>
                        <div className="rpt-table-wrap">
                            <table className="rpt-table">
                                <thead>
                                    <tr>
                                        <th>Trabajador</th>
                                        <th>Hrs Regulares</th>
                                        <th>Hrs OT</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
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
                                <tfoot>
                                    <tr>
                                        <td><strong>Total</strong></td>
                                        <td><strong>{rows.reduce((s, r) => s + r.regular, 0).toFixed(1)}h</strong></td>
                                        <td><strong>{rows.reduce((s, r) => s + r.overtime, 0).toFixed(1)}h</strong></td>
                                        <td><strong>{rows.reduce((s, r) => s + r.total, 0).toFixed(1)}h</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </>
            )}
            {!loading && rows.length === 0 && !error && (
                <EmptyState icon={Clock} title="Sin datos de horas" description="No hay registros de horas para el período y filtros seleccionados" />
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

    const loadData = useCallback(async () => {
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

    useEffect(() => { loadData(); }, [loadData]);

    const totals = invoices.reduce((acc, inv) => {
        const t = parseFloat(inv.total || 0);
        acc.total += t;
        if (inv.status === 'paid') acc.paid += t;
        else acc.pending += t;
        return acc;
    }, { total: 0, paid: 0, pending: 0 });

    const byMonth = {};
    invoices.forEach(inv => {
        const m = inv.invoice_date?.slice(0, 7) || '—';
        byMonth[m] = (byMonth[m] || 0) + parseFloat(inv.total || 0);
    });
    const chartData = Object.entries(byMonth).sort()
        .map(([k, v]) => ({ mes: k, Total: parseFloat(v.toFixed(2)) }));

    const doExportXLSX = () => exportInvoicingXLSX({ from, to, invoices, totals });
    const doExportPDF  = () => exportInvoicingPDF({ from, to, invoices, totals });

    const STATUS_LABELS = {
        draft: 'Borrador', pending_approval: 'Pend. Aprobación',
        approved: 'Aprobada', sent: 'Enviada', paid: 'Pagada', overdue: 'Vencida',
    };

    return (
        <div className="rpt-tab-content">
            <div className="reports__kpi-row reports__kpi-row--3">
                <KpiCard label="TOTAL FACTURADO" value={money(totals.total)} valueColor="#2A6C95" />
                <KpiCard label="PAGADO" value={money(totals.paid)} valueColor="#08543D" />
                <KpiCard label="PENDIENTE" value={money(totals.pending)} valueColor="#D97706" />
            </div>

            <div className="rpt-filters">
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
                        <option value="">Todos los Clientes</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <button className="rpt-export-btn" onClick={doExportXLSX} disabled={invoices.length === 0}><Download size={14} /> Exportar Excel</button>
                <button className="rpt-export-btn rpt-export-btn--pdf" onClick={doExportPDF} disabled={invoices.length === 0}><FileText size={14} /> Exportar PDF</button>
            </div>

            {error && <div className="rpt-error"><AlertCircle size={14} /> {error}</div>}
            {loading && <div className="rpt-loading"><RefreshCw size={18} className="rpt-spin" /> Cargando...</div>}

            {!loading && chartData.length > 0 && (
                <div className="reports__section-card">
                    <p className="reports__section-label">Facturación por Mes</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={v => `$${parseFloat(v).toFixed(2)}`} />
                            <Bar dataKey="Total" fill="#2A6C95" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {!loading && invoices.length > 0 && (
                <div className="reports__section-card reports__section-card--table">
                    <p className="reports__section-label">Detalle de Facturas</p>
                    <div className="rpt-table-wrap">
                        <table className="rpt-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Cliente</th>
                                    <th>Proyecto</th>
                                    <th>Total</th>
                                    <th>Status</th>
                                    <th>Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map(inv => (
                                    <tr key={inv.id}>
                                        <td><code>{inv.invoice_number}</code></td>
                                        <td>{inv.client?.company_name || '—'}</td>
                                        <td>{inv.project?.name || '—'}</td>
                                        <td><strong>{money(inv.total)}</strong></td>
                                        <td>
                                            <span className={`rpt-status rpt-status--${inv.status}`}>
                                                {STATUS_LABELS[inv.status] || inv.status}
                                            </span>
                                        </td>
                                        <td>{inv.invoice_date}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3}><strong>Total</strong></td>
                                    <td><strong>{money(totals.total)}</strong></td>
                                    <td colSpan={2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
            {!loading && invoices.length === 0 && !error && (
                <EmptyState icon={FileIcon} title="Sin facturas" description="No hay facturas para el período y filtros seleccionados" />
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

    const loadData = useCallback(async () => {
        setLoading(true); setError('');
        try {
            // Use start_date/end_date — backend filters by week_start_date in range
            const res = await get(`/payroll?start_date=${from}&end_date=${to}`);
            const list = res.data || res;
            setPayrolls(Array.isArray(list) ? list : []);
        } catch { setError('Error al cargar nómina.'); }
        finally { setLoading(false); }
    }, [get, from, to]);

    useEffect(() => { loadData(); }, [loadData]);

    // Aggregate PayrollLines by worker
    const byWorker = {};
    payrolls.forEach(p => {
        (p.lines || []).forEach(line => {
            if (filterWorker && String(line.worker_id) !== filterWorker) return;
            const wId = line.worker_id;
            // BUG 1 FIX: use first_name / last_name — not name / full_name
            const name = `${line.worker?.first_name || ''} ${line.worker?.last_name || ''}`.trim()
                || `W${wId}`;
            if (!byWorker[wId]) byWorker[wId] = { name, gross: 0, deductions: 0, perDiem: 0, net: 0, weeks: 0 };
            byWorker[wId].gross += parseFloat(line.gross_pay || 0);
            byWorker[wId].deductions += parseFloat(line.deductions || 0);
            // BUG 2 FIX: per_diem_amount — not per_diem_total
            byWorker[wId].perDiem += parseFloat(line.per_diem_amount || 0);
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

    const kpiGross = rows.reduce((s, r) => s + r.gross, 0);
    const kpiDed = rows.reduce((s, r) => s + r.deductions, 0);
    const kpiPerDiem = rows.reduce((s, r) => s + r.perDiem, 0);
    const kpiNet = rows.reduce((s, r) => s + r.net, 0);

    const doExportXLSX = () => exportPayrollXLSX({
        from, to, rows,
        kpis: [
            { label: 'GROSS PAY TOTAL', value: money(kpiGross)   },
            { label: 'DEDUCCIONES',     value: money(kpiDed)     },
            { label: 'PER DIEM',        value: money(kpiPerDiem) },
            { label: 'NET PAY TOTAL',   value: money(kpiNet)     },
        ],
    });

    const doExportPDF = () => exportPayrollPDF({
        from, to, rows,
        kpis: [
            { label: 'GROSS PAY TOTAL', value: money(kpiGross)   },
            { label: 'DEDUCCIONES',     value: money(kpiDed)     },
            { label: 'PER DIEM',        value: money(kpiPerDiem) },
            { label: 'NET PAY TOTAL',   value: money(kpiNet)     },
        ],
    });

    return (
        <div className="rpt-tab-content">
            <div className="reports__kpi-row reports__kpi-row--4">
                <KpiCard label="GROSS PAY TOTAL" value={money(kpiGross)} valueColor="#2A6C95" />
                <KpiCard label="DEDUCCIONES" value={money(kpiDed)} />
                <KpiCard
                    label="PER DIEM"
                    value={money(kpiPerDiem)}
                    valueColor="#9CA3AF"
                    sub="passthrough — no afecta P&L"
                />
                <KpiCard label="NET PAY TOTAL" value={money(kpiNet)} valueColor="#08543D" />
            </div>

            <div className="rpt-filters">
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterWorker} onChange={e => setFilterWorker(e.target.value)}>
                        <option value="">Todos los Workers</option>
                        {workers.map(w => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <button className="rpt-export-btn" onClick={doExportXLSX} disabled={rows.length === 0}><Download size={14} /> Exportar Excel</button>
                <button className="rpt-export-btn rpt-export-btn--pdf" onClick={doExportPDF} disabled={rows.length === 0}><FileText size={14} /> Exportar PDF</button>
            </div>

            {error && <div className="rpt-error"><AlertCircle size={14} /> {error}</div>}
            {loading && <div className="rpt-loading"><RefreshCw size={18} className="rpt-spin" /> Cargando...</div>}

            {!loading && rows.length > 0 && (
                <div className="reports__section-card reports__section-card--table">
                    <p className="reports__section-label">Resumen de Nomina por Trabajador</p>
                    <div className="rpt-table-wrap">
                        <table className="rpt-table">
                            <thead>
                                <tr>
                                    <th>Trabajador</th>
                                    <th>Gross Pay</th>
                                    <th>Deducciones</th>
                                    <th>Per Diem</th>
                                    <th>Net Pay</th>
                                    <th>Semanas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={i}>
                                        <td>{r.name}</td>
                                        <td>{money(r.gross)}</td>
                                        <td className="rpt-ded">{money(r.deductions)}</td>
                                        <td className="rpt-perdiem">{money(r.perDiem)}</td>
                                        <td><strong>{money(r.net)}</strong></td>
                                        <td>{r.weeks}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td><strong>Total</strong></td>
                                    <td><strong>{money(kpiGross)}</strong></td>
                                    <td><strong>{money(kpiDed)}</strong></td>
                                    <td className="rpt-perdiem"><strong>{money(kpiPerDiem)}</strong></td>
                                    <td><strong>{money(kpiNet)}</strong></td>
                                    <td>—</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
            {!loading && rows.length === 0 && !error && (
                <EmptyState icon={DollarSign} title="Sin datos de nómina" description="No hay registros de nómina para el período seleccionado" />
            )}
        </div>
    );
}

// ─── Tab: Margins ─────────────────────────────────────────────────────────────
function MarginsTab({ from, to }) {
    const { get } = useApi();
    const [groupBy, setGroupBy] = useState('worker');
    const [data, setData] = useState([]);
    const [kpi, setKpi] = useState({ cobrado: 0, costo: 0, pending: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const endpoint = groupBy === 'worker'
                ? `/accounting/margins/workers`
                : `/accounting/margins/clients`;
            const [marginsRes, invRes, payRes] = await Promise.all([
                get(`${endpoint}?from=${from}&to=${to}`),
                get(`/invoices?from=${from}&to=${to}`),
                get(`/payroll?start_date=${from}&end_date=${to}`),
            ]);

            const list = Array.isArray(marginsRes.data || marginsRes)
                ? (marginsRes.data || marginsRes) : [];
            setData(list);

            const invList = Array.isArray(invRes.data || invRes) ? (invRes.data || invRes) : [];
            const payList = Array.isArray(payRes.data || payRes) ? (payRes.data || payRes) : [];

            const cobrado = invList
                .filter(i => i.status === 'paid')
                .reduce((s, i) => s + parseFloat(i.total || 0), 0);
            const pending = invList
                .filter(i => i.status !== 'paid')
                .reduce((s, i) => s + parseFloat(i.total || 0), 0);
            const costo = payList.reduce((s, p) =>
                s + (p.lines || []).reduce((ls, l) => ls
                    + parseFloat(l.gross_pay || 0)
                    + parseFloat(l.employer_taxes || 0)
                    + parseFloat(l.workers_comp || 0), 0), 0
            );
            setKpi({ cobrado, costo, pending });
        } catch { setError('Error al cargar márgenes.'); }
        finally { setLoading(false); }
    }, [get, from, to, groupBy]);

    useEffect(() => { loadData(); }, [loadData]);

    const margen = kpi.cobrado - kpi.costo;
    const siCobran = margen + kpi.pending;

    const chartData = data.slice(0, 10).map(d => ({
        name: (d.worker_name || d.client_name || '—').split(' ')[0],
        Cobrado: d.billed,
        Pagado: d.paid !== undefined && d.paid !== null ? d.paid : d.cost,
        Margen: d.margin,
    }));

    const doExportXLSX = () => exportMarginsXLSX({ from, to, data, kpi, groupBy });
    const doExportPDF  = () => exportMarginsPDF({ from, to, data, kpi, groupBy });

    return (
        <div className="rpt-tab-content">
            <div className="reports__kpi-row reports__kpi-row--4">
                <KpiCard
                    label="TOTAL COBRADO"
                    value={money(kpi.cobrado)}
                    valueColor="#2A6C95"
                    sub="Facturas pagadas"
                />
                <KpiCard
                    label="COSTO NOMINA"
                    value={money(kpi.costo)}
                    sub="Gross pay del período"
                />
                <KpiCard
                    label="MARGEN NETO"
                    value={money(margen)}
                    valueColor={margen >= 0 ? '#08543D' : '#DC2626'}
                    sub={margen >= 0 ? 'Positivo' : 'Negativo'}
                    subType={margen >= 0 ? 'up' : 'down'}
                />
                <KpiCard
                    label="SI COBRAN PENDIENTE"
                    value={money(siCobran)}
                    valueColor="#08543D"
                    sub="Proyectado con pendientes"
                />
            </div>

            <div className="rpt-filters">
                <div className="rpt-view-toggle">
                    <button
                        className={`reports__view-btn${groupBy === 'worker' ? ' reports__view-btn--active' : ''}`}
                        onClick={() => setGroupBy('worker')}
                    >
                        Por Worker
                    </button>
                    <button
                        className={`reports__view-btn${groupBy === 'client' ? ' reports__view-btn--active' : ''}`}
                        onClick={() => setGroupBy('client')}
                    >
                        Por Cliente
                    </button>
                </div>
                <button className="rpt-export-btn" onClick={doExportXLSX} disabled={data.length === 0}><Download size={14} /> Exportar Excel</button>
                <button className="rpt-export-btn rpt-export-btn--pdf" onClick={doExportPDF} disabled={data.length === 0}><FileText size={14} /> Exportar PDF</button>
            </div>

            <div className="reports__per-diem-notice">
                Per Diem es passthrough — no se incluye en márgenes ni P&L
            </div>

            {error && <div className="rpt-error"><AlertCircle size={14} /> {error}</div>}
            {loading && <div className="rpt-loading"><RefreshCw size={18} className="rpt-spin" /> Cargando...</div>}

            {!loading && chartData.length > 0 && (
                <div className="reports__section-card">
                    <p className="reports__section-label">
                        Márgenes por {groupBy === 'worker' ? 'Worker' : 'Cliente'}
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
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
                <div className="reports__section-card reports__section-card--table">
                    <p className="reports__section-label">Detalle de Márgenes</p>
                    <div className="rpt-table-wrap">
                        <table className="rpt-table">
                            <thead>
                                <tr>
                                    <th>{groupBy === 'worker' ? 'Worker' : 'Cliente'}</th>
                                    <th>Cobrado</th>
                                    <th>Pagado/Costo</th>
                                    <th>Margen</th>
                                    <th>%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((d, i) => (
                                    <tr key={i}>
                                        <td>{d.worker_name || d.client_name || '—'}</td>
                                        <td>{money(d.billed)}</td>
                                        <td>{money(d.paid || d.cost)}</td>
                                        <td className={d.margin >= 0 ? 'rpt-positive' : 'rpt-negative'}>
                                            {money(d.margin)}
                                        </td>
                                        <td className={d.margin_pct >= 0 ? 'rpt-positive' : 'rpt-negative'}>
                                            {parseFloat(d.margin_pct || 0).toFixed(1)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {!loading && data.length === 0 && !error && (
                <EmptyState icon={BarChart3} title="Sin datos de márgenes" description="No hay información de márgenes para el período seleccionado" />
            )}
        </div>
    );
}

// ─── Tab: P&L ────────────────────────────────────────────────────────────────
function PnLTab({ from, to }) {
    const { get } = useApi();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await get(`/accounting/pnl?start_date=${from}&end_date=${to}`);
            const d = res.data || res;
            setData(d || null);
        } catch {
            setError('Error al cargar P&L.');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [get, from, to]);

    useEffect(() => { loadData(); }, [loadData]);

    const incomeItems = data?.income?.items && typeof data.income.items === 'object' ? data.income.items : {};
    const expenseItems = data?.expense?.items && typeof data.expense.items === 'object' ? data.expense.items : {};
    const incomeTotal = parseFloat(data?.income?.total || 0);
    const expenseTotal = parseFloat(data?.expense?.total || 0);
    const net = parseFloat(data?.net || 0);
    const perDiemPass = parseFloat(data?.per_diem_passthrough || 0);

    const doExportXLSX = () => exportPnLXLSX({ from, to, data });
    const doExportPDF  = () => exportPnLPDF({ from, to, data });

    return (
        <div className="rpt-tab-content">
            <div className="reports__kpi-row reports__kpi-row--4">
                <KpiCard label="INGRESOS TOTALES" value={money(incomeTotal)} valueColor="#2A6C95" />
                <KpiCard label="GASTOS TOTALES" value={money(expenseTotal)} valueColor="#6B7280" />
                <KpiCard
                    label="UTILIDAD NETA"
                    value={money(net)}
                    valueColor={net >= 0 ? '#08543D' : '#DC2626'}
                    sub={net >= 0 ? 'Positiva' : 'Negativa'}
                    subType={net >= 0 ? 'up' : 'down'}
                />
                <KpiCard
                    label="PER DIEM (PASSTHROUGH)"
                    value={money(perDiemPass)}
                    valueColor="#9CA3AF"
                    sub="no afecta P&L"
                />
            </div>

            <div className="reports__per-diem-notice">
                Per Diem es passthrough — excluido del P&amp;L
            </div>

            <div className="rpt-filters">
                <button className="rpt-export-btn" onClick={doExportXLSX} disabled={!data}><Download size={14} /> Exportar Excel</button>
                <button className="rpt-export-btn rpt-export-btn--pdf" onClick={doExportPDF} disabled={!data}><FileText size={14} /> Exportar PDF</button>
            </div>

            {error && <div className="rpt-error"><AlertCircle size={14} /> {error}</div>}
            {loading && <div className="rpt-loading"><RefreshCw size={18} className="rpt-spin" /> Cargando...</div>}

            {!loading && !error && data && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="reports__section-card reports__section-card--table">
                        <p className="reports__section-label">Ingresos por categoría</p>
                        <div className="rpt-table-wrap">
                            <table className="rpt-table">
                                <thead>
                                    <tr>
                                        <th>Categoría</th>
                                        <th>Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(incomeItems).length === 0 ? (
                                        <tr><td colSpan={2} style={{ color: '#9CA3AF' }}>Sin ingresos</td></tr>
                                    ) : Object.entries(incomeItems).map(([cat, amt]) => (
                                        <tr key={cat}>
                                            <td>{cat}</td>
                                            <td><strong>{money(amt)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td><strong>Total</strong></td>
                                        <td><strong>{money(incomeTotal)}</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div className="reports__section-card reports__section-card--table">
                        <p className="reports__section-label">Gastos por categoría</p>
                        <div className="rpt-table-wrap">
                            <table className="rpt-table">
                                <thead>
                                    <tr>
                                        <th>Categoría</th>
                                        <th>Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(expenseItems).length === 0 ? (
                                        <tr><td colSpan={2} style={{ color: '#9CA3AF' }}>Sin gastos</td></tr>
                                    ) : Object.entries(expenseItems).map(([cat, amt]) => (
                                        <tr key={cat}>
                                            <td>{cat}</td>
                                            <td><strong>{money(amt)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td><strong>Total</strong></td>
                                        <td><strong>{money(expenseTotal)}</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {!loading && !error && !data && (
                <div className="rpt-empty"><p>Sin datos para el período seleccionado</p></div>
            )}
        </div>
    );
}

// ─── Tab: Shift Changes ───────────────────────────────────────────────────────
const SC_STATUS_LABEL = {
    pending_target:  'Pend. worker',
    accepted_target: 'Pend. admin',
    rejected_target: 'Rechazado worker',
    approved_admin:  'Aprobado',
    rejected_admin:  'Rechazado admin',
    cancelled:       'Cancelado',
};

function ShiftChangesTab({ from, to, workers }) {
    const { get } = useApi();
    const [changes, setChanges] = useState([]);
    const [filterWorker, setFilterWorker] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await get('/shift-changes');
            const all = Array.isArray(res?.data) ? res.data : res || [];
            // Filtrar por período (shift_date)
            setChanges(all.filter(c => {
                if (!c.shift_date) return true;
                return c.shift_date >= from && c.shift_date <= to;
            }));
        } catch { setError('Error al cargar cambios de turno.'); }
        finally { setLoading(false); }
    }, [get, from, to]);

    useEffect(() => { loadData(); }, [loadData]);

    // Aplicar filtros locales
    const filtered = changes.filter(c => {
        if (filterWorker && c.requester_worker_id !== parseInt(filterWorker) && c.target_worker_id !== parseInt(filterWorker)) return false;
        if (filterStatus && c.status !== filterStatus) return false;
        return true;
    });

    // KPIs
    const total      = filtered.length;
    const approved   = filtered.filter(c => c.status === 'approved_admin').length;
    const rejected   = filtered.filter(c => ['rejected_target', 'rejected_admin'].includes(c.status)).length;
    const pending    = filtered.filter(c => ['pending_target', 'accepted_target'].includes(c.status)).length;
    const approvalRate = total > 0 ? ((approved / total) * 100).toFixed(0) : 0;

    const fmtDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const fmtTime = (dt) => dt ? new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
    const wName = (w) => w ? `${w.first_name} ${w.last_name}` : '—';

    const doExportXLSX = () => {
        if (filtered.length === 0) return;
        import('../../utils/exportXLSX').then(({ exportShiftChangesXLSX }) => {
            exportShiftChangesXLSX({ from, to, rows: filtered, kpis: [
                { label: 'TOTAL SOLICITUDES', value: String(total) },
                { label: 'APROBADAS',         value: String(approved) },
                { label: 'RECHAZADAS',        value: String(rejected) },
                { label: 'TASA APROBACIÓN',   value: `${approvalRate}%` },
            ]});
        });
    };

    const doExportPDF = () => {
        if (filtered.length === 0) return;
        import('../../utils/exportPDF').then(({ exportShiftChangesPDF }) => {
            exportShiftChangesPDF({ from, to, rows: filtered, kpis: [
                { label: 'TOTAL SOLICITUDES', value: String(total) },
                { label: 'APROBADAS',         value: String(approved) },
                { label: 'RECHAZADAS',        value: String(rejected) },
                { label: 'TASA APROBACIÓN',   value: `${approvalRate}%` },
            ]});
        });
    };

    return (
        <div className="rpt-tab-content">
            <div className="reports__kpi-row reports__kpi-row--4">
                <KpiCard label="TOTAL SOLICITUDES" value={total} valueColor="#2A6C95" />
                <KpiCard label="APROBADAS" value={approved} valueColor="#10B981" />
                <KpiCard label="RECHAZADAS" value={rejected} valueColor="#EF4444" />
                <KpiCard label="TASA APROBACIÓN" value={`${approvalRate}%`}
                    sub={pending > 0 ? `${pending} pendiente${pending > 1 ? 's' : ''}` : 'Sin pendientes'}
                    subType={pending > 0 ? 'warning' : undefined}
                />
            </div>

            <div className="rpt-filters">
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterWorker} onChange={e => setFilterWorker(e.target.value)}>
                        <option value="">Todos los Workers</option>
                        {workers.map(w => <option key={w.id} value={w.id}>{w.first_name} {w.last_name}</option>)}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <div className="workers-select-wrapper">
                    <select className="workers-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="">Todos los estados</option>
                        {Object.entries(SC_STATUS_LABEL).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                        ))}
                    </select>
                    <ChevronDown size={13} className="workers-select__arrow" />
                </div>
                <button className="rpt-export-btn" onClick={doExportXLSX} disabled={filtered.length === 0}><Download size={14} /> Exportar Excel</button>
                <button className="rpt-export-btn rpt-export-btn--pdf" onClick={doExportPDF} disabled={filtered.length === 0}><FileText size={14} /> Exportar PDF</button>
            </div>

            {error && <div className="rpt-error"><AlertCircle size={14} /> {error}</div>}
            {loading && <div className="rpt-loading"><RefreshCw size={18} className="rpt-spin" /> Cargando...</div>}

            {!loading && filtered.length > 0 && (
                <div className="reports__section-card reports__section-card--table">
                    <p className="reports__section-label">Solicitudes de Cambio de Turno</p>
                    <div className="rpt-table-wrap">
                        <table className="rpt-table">
                            <thead>
                                <tr>
                                    <th>Fecha Turno</th>
                                    <th>Solicitante</th>
                                    <th>Target</th>
                                    <th>Turno Solicitante</th>
                                    <th>Estado</th>
                                    <th>Revisado por</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(c => (
                                    <tr key={c.id}>
                                        <td>{fmtDate(c.shift_date)}</td>
                                        <td>{wName(c.requester)}</td>
                                        <td>{wName(c.target)}</td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.77rem' }}>
                                            {c.requesterEntry
                                                ? `${fmtTime(c.requesterEntry.clock_in)} → ${fmtTime(c.requesterEntry.clock_out)}`
                                                : '—'}
                                        </td>
                                        <td>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.18rem 0.55rem',
                                                borderRadius: '12px',
                                                fontSize: '0.72rem',
                                                fontWeight: 600,
                                                background: c.status === 'approved_admin' ? 'rgba(16,185,129,0.1)'
                                                    : ['rejected_target','rejected_admin','cancelled'].includes(c.status) ? 'rgba(239,68,68,0.1)'
                                                    : 'rgba(245,158,11,0.1)',
                                                color: c.status === 'approved_admin' ? '#10B981'
                                                    : ['rejected_target','rejected_admin','cancelled'].includes(c.status) ? '#EF4444'
                                                    : '#D97706',
                                            }}>
                                                {SC_STATUS_LABEL[c.status] || c.status}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            {c.reviewer?.email || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={4}><strong>Total: {filtered.length} solicitudes</strong></td>
                                    <td colSpan={2}><strong>Aprobadas: {approved} · Rechazadas: {rejected}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {!loading && filtered.length === 0 && !error && (
                <EmptyState icon={Calendar} title="Sin cambios de turno" description="No hay solicitudes de cambio de turno para el período y filtros seleccionados" />
            )}
        </div>
    );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
    { id: 'hours',         label: 'Horas' },
    { id: 'invoicing',     label: 'Facturación' },
    { id: 'payroll',       label: 'Nómina' },
    { id: 'margins',       label: 'Márgenes' },
    { id: 'pnl',           label: 'P&L' },
    { id: 'shift-changes', label: 'Turnos' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
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
            <div className="rpt-header">
                <div>
                    <h1 className="reports__title">Reportes</h1>
                    <p className="reports__subtitle">Analiza el rendimiento operativo y financiero</p>
                </div>
            </div>

            <div className="rpt-period-bar">
                <span className="reports__period-label">Período</span>
                <input
                    type="date"
                    className="reports__period-input"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                />
                <span className="rpt-period-sep">—</span>
                <input
                    type="date"
                    className="reports__period-input"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                />
            </div>

            <div className="reports__tabs">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`reports__tab${activeTab === tab.id ? ' reports__tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="rpt-content-area">
                {activeTab === 'hours'         && <HoursTab from={from} to={to} workers={workers} projects={projects} />}
                {activeTab === 'invoicing'     && <InvoicingTab from={from} to={to} clients={clients} />}
                {activeTab === 'payroll'       && <PayrollTab from={from} to={to} workers={workers} />}
                {activeTab === 'margins'       && <MarginsTab from={from} to={to} />}
                {activeTab === 'pnl'           && <PnLTab from={from} to={to} />}
                {activeTab === 'shift-changes' && <ShiftChangesTab from={from} to={to} workers={workers} />}
            </div>
        </div>
    );
}
