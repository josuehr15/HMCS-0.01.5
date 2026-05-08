/**
 * exportXLSX.js — HMCS Report Excel Generator
 * Usa SheetJS (xlsx) para generar archivos .xlsx con formato corporativo.
 *
 * Estructura de cada hoja:
 *   Fila 1:  Empresa (HM Construction Staffing LLLP)
 *   Fila 2:  Título del reporte
 *   Fila 3:  Período
 *   Fila 4:  vacía
 *   Fila 5:  KPIs (label | valor | label | valor ...)
 *   Fila 6:  vacía
 *   Fila 7+: Headers + datos
 */
import * as XLSX from 'xlsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const money = (n) =>
    `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
    });
};

/**
 * Construye un workbook con una sola hoja.
 * @param {string} title      - Título del reporte
 * @param {string} period     - String del período (e.g. "May 1, 2026 — May 31, 2026")
 * @param {Array}  kpis       - [{label, value}, ...] — máx 4
 * @param {Array}  headers    - Columnas de la tabla
 * @param {Array}  rows       - Filas de datos (arrays de strings/numbers)
 * @param {Array}  footRow    - Fila de totales (optional)
 * @param {string} sheetName  - Nombre de la pestaña
 */
function buildWorkbook({ title, period, kpis, headers, rows, footRow, sheetName = 'Reporte' }) {
    const COMPANY = 'HM Construction Staffing LLLP';

    // ── Construir datos de la hoja ─────────────────────────────────────────
    const sheetData = [];

    // Bloque de encabezado
    sheetData.push([COMPANY]);
    sheetData.push([title]);
    sheetData.push([`Período: ${period}`]);
    sheetData.push([]);  // vacía

    // Fila de KPIs: label   valor   label   valor ...
    if (kpis && kpis.length > 0) {
        const kpiRow = [];
        kpis.forEach(k => { kpiRow.push(k.label, k.value); });
        sheetData.push(kpiRow);
        sheetData.push([]);  // vacía tras KPIs
    }

    // Headers de la tabla
    sheetData.push(headers);

    // Filas de datos
    rows.forEach(r => sheetData.push(r));

    // Fila de totales
    if (footRow) sheetData.push(footRow);

    // ── Crear worksheet ────────────────────────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Ancho de columnas automático basado en el contenido
    const colWidths = headers.map((h, colIdx) => {
        const maxLen = Math.max(
            String(h).length,
            ...rows.map(r => String(r[colIdx] ?? '').length),
            footRow ? String(footRow[colIdx] ?? '').length : 0,
        );
        return { wch: Math.min(Math.max(maxLen + 2, 12), 40) };
    });
    ws['!cols'] = colWidths;

    // Merge de las celdas de título/empresa/período (columna A, span completo)
    const totalCols = headers.length;
    const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },  // empresa
        { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },  // título
        { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } },  // período
    ];
    ws['!merges'] = merges;

    // ── Crear workbook ─────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return wb;
}

/**
 * Descarga el workbook como .xlsx
 */
function saveWorkbook(wb, filename) {
    XLSX.writeFile(wb, filename);
}

// ═════════════════════════════════════════════════════════════════════════════
// Exportadores por tab
// ═════════════════════════════════════════════════════════════════════════════

// ─── Horas ───────────────────────────────────────────────────────────────────
export function exportHoursXLSX({ from, to, rows, kpis }) {
    const period = `${formatDate(from)} — ${formatDate(to)}`;

    const totalReg = rows.reduce((s, r) => s + r.regular, 0);
    const totalOT  = rows.reduce((s, r) => s + r.overtime, 0);
    const totalAll = rows.reduce((s, r) => s + r.total, 0);

    const wb = buildWorkbook({
        title: 'Reporte de Horas',
        period,
        kpis,
        headers: ['Trabajador', 'Hrs Regulares', 'Hrs Overtime', 'Total Horas'],
        rows: rows.map(r => [r.name, `${r.regular}h`, `${r.overtime}h`, `${r.total}h`]),
        footRow: ['TOTAL', `${totalReg.toFixed(1)}h`, `${totalOT.toFixed(1)}h`, `${totalAll.toFixed(1)}h`],
        sheetName: 'Horas',
    });
    saveWorkbook(wb, `reporte_horas_${from}_${to}.xlsx`);
}

// ─── Facturación ──────────────────────────────────────────────────────────────
export function exportInvoicingXLSX({ from, to, invoices, totals }) {
    const period = `${formatDate(from)} — ${formatDate(to)}`;

    const STATUS_LABELS = {
        draft: 'Borrador', pending_approval: 'Pend. Aprobación',
        approved: 'Aprobada', sent: 'Enviada', paid: 'Pagada', overdue: 'Vencida',
    };

    const wb = buildWorkbook({
        title: 'Reporte de Facturación',
        period,
        kpis: [
            { label: 'TOTAL FACTURADO', value: money(totals.total) },
            { label: 'PAGADO',          value: money(totals.paid)  },
            { label: 'PENDIENTE',       value: money(totals.pending) },
        ],
        headers: ['# Factura', 'Cliente', 'Proyecto', 'Total', 'Status', 'Fecha'],
        rows: invoices.map(i => [
            i.invoice_number || '—',
            i.client?.company_name || '—',
            i.project?.name || '—',
            money(i.total),
            STATUS_LABELS[i.status] || i.status,
            i.invoice_date || '—',
        ]),
        footRow: ['', '', 'TOTAL', money(totals.total), '', ''],
        sheetName: 'Facturación',
    });
    saveWorkbook(wb, `reporte_facturacion_${from}_${to}.xlsx`);
}

// ─── Nómina ───────────────────────────────────────────────────────────────────
export function exportPayrollXLSX({ from, to, rows, kpis }) {
    const period = `${formatDate(from)} — ${formatDate(to)}`;

    const wb = buildWorkbook({
        title: 'Reporte de Nómina',
        period,
        kpis,
        headers: ['Trabajador', 'Gross Pay', 'Deducciones', 'Per Diem', 'Net Pay', 'Semanas'],
        rows: rows.map(r => [
            r.name,
            money(r.gross),
            money(r.deductions),
            money(r.perDiem),
            money(r.net),
            String(r.weeks),
        ]),
        footRow: [
            'TOTAL',
            money(rows.reduce((s, r) => s + r.gross, 0)),
            money(rows.reduce((s, r) => s + r.deductions, 0)),
            money(rows.reduce((s, r) => s + r.perDiem, 0)),
            money(rows.reduce((s, r) => s + r.net, 0)),
            '—',
        ],
        sheetName: 'Nómina',
    });
    saveWorkbook(wb, `reporte_nomina_${from}_${to}.xlsx`);
}

// ─── Márgenes ─────────────────────────────────────────────────────────────────
export function exportMarginsXLSX({ from, to, data, kpi, groupBy }) {
    const period = `${formatDate(from)} — ${formatDate(to)}`;
    const margen = kpi.cobrado - kpi.costo;
    const colLabel = groupBy === 'worker' ? 'Worker' : 'Cliente';

    const wb = buildWorkbook({
        title: `Reporte de Márgenes — Por ${colLabel}`,
        period,
        kpis: [
            { label: 'TOTAL COBRADO', value: money(kpi.cobrado) },
            { label: 'COSTO NÓMINA',  value: money(kpi.costo)   },
            { label: 'MARGEN NETO',   value: money(margen)      },
        ],
        headers: [colLabel, 'Cobrado', 'Pagado/Costo', 'Margen', 'Margen %'],
        rows: data.map(d => [
            d.worker_name || d.client_name || '—',
            money(d.billed),
            money(d.paid || d.cost),
            money(d.margin),
            `${parseFloat(d.margin_pct || 0).toFixed(1)}%`,
        ]),
        sheetName: 'Márgenes',
    });
    saveWorkbook(wb, `reporte_margenes_${groupBy}_${from}_${to}.xlsx`);
}

// ─── P&L ──────────────────────────────────────────────────────────────────────
export function exportPnLXLSX({ from, to, data }) {
    const period = `${formatDate(from)} — ${formatDate(to)}`;

    const incomeItems  = data?.income?.items  || {};
    const expenseItems = data?.expense?.items || {};
    const incomeTotal  = parseFloat(data?.income?.total  || 0);
    const expenseTotal = parseFloat(data?.expense?.total || 0);
    const net          = parseFloat(data?.net || 0);
    const perDiem      = parseFloat(data?.per_diem_passthrough || 0);

    // Combinar ingresos y gastos en una sola tabla con columna Tipo
    const rows = [
        ...Object.entries(incomeItems).map(([cat, amt]) => ['Ingreso', cat, money(amt)]),
        ...Object.entries(expenseItems).map(([cat, amt]) => ['Gasto',   cat, money(amt)]),
    ];

    const wb = buildWorkbook({
        title: 'Reporte P&L (Estado de Resultados)',
        period,
        kpis: [
            { label: 'INGRESOS',        value: money(incomeTotal)  },
            { label: 'GASTOS',          value: money(expenseTotal) },
            { label: 'UTILIDAD NETA',   value: money(net)          },
            { label: 'PER DIEM (pass)', value: money(perDiem)      },
        ],
        headers: ['Tipo', 'Categoría', 'Monto'],
        rows,
        footRow: ['', 'UTILIDAD NETA', money(net)],
        sheetName: 'P&L',
    });
    saveWorkbook(wb, `reporte_pnl_${from}_${to}.xlsx`);
}

// ─── Shift Changes ────────────────────────────────────────────────────────────
const SC_STATUS_LABEL = {
    pending_target:  'Pend. worker',
    accepted_target: 'Pend. admin',
    rejected_target: 'Rechazado worker',
    approved_admin:  'Aprobado',
    rejected_admin:  'Rechazado admin',
    cancelled:       'Cancelado',
};
const fmtTime = (dt) => dt ? new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
const wName = (w) => w ? `${w.first_name} ${w.last_name}` : '—';

export function exportShiftChangesXLSX({ from, to, rows, kpis }) {
    const period = `${formatDate(from)} — ${formatDate(to)}`;

    const wb = buildWorkbook({
        title: 'Reporte de Cambios de Turno',
        period,
        kpis,
        headers: ['Fecha Turno', 'Solicitante', 'Target', 'Turno Solicitante', 'Estado', 'Revisado por', 'Nota Admin'],
        rows: rows.map(c => [
            c.shift_date || '—',
            wName(c.requester),
            wName(c.target),
            c.requesterEntry
                ? `${fmtTime(c.requesterEntry.clock_in)} → ${fmtTime(c.requesterEntry.clock_out)}`
                : '—',
            SC_STATUS_LABEL[c.status] || c.status,
            c.reviewer?.email || '—',
            c.admin_note || '—',
        ]),
        footRow: ['TOTAL', `${rows.length} solicitudes`, '', '', '', '', ''],
        sheetName: 'Cambios de Turno',
    });
    saveWorkbook(wb, `reporte_turnos_${from}_${to}.xlsx`);
}
