/**
 * exportPDF.js — HMCS Report PDF Generator
 * Usa jsPDF + jspdf-autotable para generar reportes con plantilla corporativa.
 *
 * Colores corporativos:
 *   Primario:   #2A6C95 (azul HMCS)
 *   Secundario: #08543D (verde HMCS)
 *   Gris texto: #374151
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Constantes de diseño ─────────────────────────────────────────────────────
const PRIMARY   = [42, 108, 149];   // #2A6C95
const SECONDARY = [8, 84, 61];      // #08543D
const GRAY_DARK = [55, 65, 81];     // #374151
const GRAY_MID  = [107, 114, 128];  // #6B7280
const GRAY_LIGHT= [243, 244, 246];  // #F3F4F6
const WHITE     = [255, 255, 255];

const money = (n) =>
    `$${parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ─── Header corporativo ───────────────────────────────────────────────────────
function drawHeader(doc, title, period, companyName = 'HM Construction Staffing LLLP') {
    const W = doc.internal.pageSize.getWidth();

    // Banda azul superior
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 0, W, 28, 'F');

    // Nombre de la empresa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...WHITE);
    doc.text(companyName, 14, 12);

    // Título del reporte
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(title, 14, 20);

    // Período (derecha)
    doc.setFontSize(8);
    doc.text(period, W - 14, 20, { align: 'right' });

    // Línea verde bajo el header
    doc.setFillColor(...SECONDARY);
    doc.rect(0, 28, W, 2, 'F');

    return 36; // y después del header
}

// ─── KPI cards (fila de métricas) ────────────────────────────────────────────
function drawKpis(doc, y, kpis) {
    const W = doc.internal.pageSize.getWidth();
    const margin = 14;
    const gap = 6;
    const n = kpis.length;
    const cardW = (W - margin * 2 - gap * (n - 1)) / n;

    kpis.forEach((kpi, i) => {
        const x = margin + i * (cardW + gap);

        // Fondo tarjeta
        doc.setFillColor(...GRAY_LIGHT);
        doc.roundedRect(x, y, cardW, 20, 2, 2, 'F');

        // Valor
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...PRIMARY);
        doc.text(kpi.value, x + cardW / 2, y + 10, { align: 'center' });

        // Label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_MID);
        doc.text(kpi.label, x + cardW / 2, y + 17, { align: 'center' });
    });

    return y + 26;
}

// ─── Sección de tabla ─────────────────────────────────────────────────────────
function drawTable(doc, y, { label, head, body, foot }) {
    if (label) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...GRAY_DARK);
        doc.text(label, 14, y + 4);
        y += 8;
    }

    autoTable(doc, {
        startY: y,
        head: [head],
        body,
        foot: foot ? [foot] : undefined,
        margin: { left: 14, right: 14 },
        styles: {
            fontSize: 8,
            cellPadding: 3,
            textColor: GRAY_DARK,
            lineColor: [229, 231, 235],
            lineWidth: 0.1,
        },
        headStyles: {
            fillColor: PRIMARY,
            textColor: WHITE,
            fontStyle: 'bold',
            fontSize: 8,
        },
        footStyles: {
            fillColor: GRAY_LIGHT,
            textColor: GRAY_DARK,
            fontStyle: 'bold',
            fontSize: 8,
        },
        alternateRowStyles: {
            fillColor: [249, 250, 251],
        },
        columnStyles: {},
    });

    return doc.lastAutoTable.finalY + 8;
}

// ─── Footer en cada página ────────────────────────────────────────────────────
function addFooters(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(...GRAY_LIGHT);
        doc.rect(0, H - 10, W, 10, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...GRAY_MID);
        doc.text(
            `HM Construction Staffing LLLP — Generado el ${new Date().toLocaleDateString('en-US')}`,
            14, H - 3
        );
        doc.text(`Pág. ${i} / ${pageCount}`, W - 14, H - 3, { align: 'right' });
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Exportadores por tab
// ═════════════════════════════════════════════════════════════════════════════

// ─── Horas ───────────────────────────────────────────────────────────────────
export function exportHoursPDF({ from, to, rows, kpis }) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const period = `${formatDate(from)} — ${formatDate(to)}`;

    let y = drawHeader(doc, 'Reporte de Horas', period);
    y = drawKpis(doc, y, kpis);
    y += 4;

    drawTable(doc, y, {
        label: 'Detalle por Trabajador',
        head: ['Trabajador', 'Hrs Regulares', 'Hrs Overtime', 'Total'],
        body: rows.map(r => [r.name, `${r.regular}h`, `${r.overtime}h`, `${r.total}h`]),
        foot: [
            'TOTAL',
            `${rows.reduce((s, r) => s + r.regular, 0).toFixed(1)}h`,
            `${rows.reduce((s, r) => s + r.overtime, 0).toFixed(1)}h`,
            `${rows.reduce((s, r) => s + r.total, 0).toFixed(1)}h`,
        ],
    });

    addFooters(doc);
    doc.save(`reporte_horas_${from}_${to}.pdf`);
}

// ─── Facturación ──────────────────────────────────────────────────────────────
export function exportInvoicingPDF({ from, to, invoices, totals }) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const period = `${formatDate(from)} — ${formatDate(to)}`;

    const STATUS_LABELS = {
        draft: 'Borrador', pending_approval: 'Pend. Aprobación',
        approved: 'Aprobada', sent: 'Enviada', paid: 'Pagada', overdue: 'Vencida',
    };

    let y = drawHeader(doc, 'Reporte de Facturación', period);
    y = drawKpis(doc, y, [
        { label: 'TOTAL FACTURADO', value: money(totals.total) },
        { label: 'PAGADO',          value: money(totals.paid) },
        { label: 'PENDIENTE',       value: money(totals.pending) },
    ]);
    y += 4;

    drawTable(doc, y, {
        label: 'Detalle de Facturas',
        head: ['# Factura', 'Cliente', 'Proyecto', 'Total', 'Status', 'Fecha'],
        body: invoices.map(i => [
            i.invoice_number || '—',
            i.client?.company_name || '—',
            i.project?.name || '—',
            money(i.total),
            STATUS_LABELS[i.status] || i.status,
            i.invoice_date || '—',
        ]),
        foot: ['', '', 'TOTAL', money(totals.total), '', ''],
    });

    addFooters(doc);
    doc.save(`reporte_facturacion_${from}_${to}.pdf`);
}

// ─── Nómina ───────────────────────────────────────────────────────────────────
export function exportPayrollPDF({ from, to, rows, kpis }) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const period = `${formatDate(from)} — ${formatDate(to)}`;

    let y = drawHeader(doc, 'Reporte de Nómina', period);
    y = drawKpis(doc, y, kpis);
    y += 4;

    drawTable(doc, y, {
        label: 'Resumen de Nómina por Trabajador',
        head: ['Trabajador', 'Gross Pay', 'Deducciones', 'Per Diem', 'Net Pay', 'Semanas'],
        body: rows.map(r => [
            r.name,
            money(r.gross),
            money(r.deductions),
            money(r.perDiem),
            money(r.net),
            String(r.weeks),
        ]),
        foot: [
            'TOTAL',
            money(rows.reduce((s, r) => s + r.gross, 0)),
            money(rows.reduce((s, r) => s + r.deductions, 0)),
            money(rows.reduce((s, r) => s + r.perDiem, 0)),
            money(rows.reduce((s, r) => s + r.net, 0)),
            '—',
        ],
    });

    addFooters(doc);
    doc.save(`reporte_nomina_${from}_${to}.pdf`);
}

// ─── Márgenes ─────────────────────────────────────────────────────────────────
export function exportMarginsPDF({ from, to, data, kpi, groupBy }) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const period = `${formatDate(from)} — ${formatDate(to)}`;
    const margen = kpi.cobrado - kpi.costo;

    let y = drawHeader(doc, `Reporte de Márgenes — Por ${groupBy === 'worker' ? 'Worker' : 'Cliente'}`, period);
    y = drawKpis(doc, y, [
        { label: 'TOTAL COBRADO', value: money(kpi.cobrado) },
        { label: 'COSTO NÓMINA',  value: money(kpi.costo)   },
        { label: 'MARGEN NETO',   value: money(margen)      },
    ]);
    y += 4;

    drawTable(doc, y, {
        label: 'Detalle de Márgenes',
        head: [groupBy === 'worker' ? 'Worker' : 'Cliente', 'Cobrado', 'Pagado/Costo', 'Margen', 'Margen %'],
        body: data.map(d => [
            d.worker_name || d.client_name || '—',
            money(d.billed),
            money(d.paid || d.cost),
            money(d.margin),
            `${parseFloat(d.margin_pct || 0).toFixed(1)}%`,
        ]),
    });

    addFooters(doc);
    doc.save(`reporte_margenes_${groupBy}_${from}_${to}.pdf`);
}

// ─── P&L ──────────────────────────────────────────────────────────────────────
export function exportPnLPDF({ from, to, data }) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const period = `${formatDate(from)} — ${formatDate(to)}`;

    const incomeItems  = data?.income?.items  || {};
    const expenseItems = data?.expense?.items || {};
    const incomeTotal  = parseFloat(data?.income?.total  || 0);
    const expenseTotal = parseFloat(data?.expense?.total || 0);
    const net          = parseFloat(data?.net || 0);
    const perDiem      = parseFloat(data?.per_diem_passthrough || 0);

    let y = drawHeader(doc, 'Reporte P&L (Estado de Resultados)', period);
    y = drawKpis(doc, y, [
        { label: 'INGRESOS',        value: money(incomeTotal)  },
        { label: 'GASTOS',          value: money(expenseTotal) },
        { label: 'UTILIDAD NETA',   value: money(net)          },
        { label: 'PER DIEM (pass)', value: money(perDiem)      },
    ]);
    y += 4;

    // Tabla Ingresos
    y = drawTable(doc, y, {
        label: 'Ingresos por Categoría',
        head: ['Categoría', 'Monto'],
        body: Object.entries(incomeItems).map(([cat, amt]) => [cat, money(amt)]),
        foot: ['TOTAL INGRESOS', money(incomeTotal)],
    });

    // Tabla Gastos
    drawTable(doc, y, {
        label: 'Gastos por Categoría',
        head: ['Categoría', 'Monto'],
        body: Object.entries(expenseItems).map(([cat, amt]) => [cat, money(amt)]),
        foot: ['TOTAL GASTOS', money(expenseTotal)],
    });

    addFooters(doc);
    doc.save(`reporte_pnl_${from}_${to}.pdf`);
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
const scFmtTime = (dt) => dt ? new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
const scWName = (w) => w ? `${w.first_name} ${w.last_name}` : '—';

export function exportShiftChangesPDF({ from, to, rows, kpis }) {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const period = `${formatDate(from)} — ${formatDate(to)}`;

    let y = drawHeader(doc, 'Reporte de Cambios de Turno', period);
    y = drawKpis(doc, y, kpis);
    y += 4;

    drawTable(doc, y, {
        label: 'Solicitudes de Cambio de Turno',
        head: ['Fecha', 'Solicitante', 'Target', 'Turno Solicitante', 'Estado', 'Revisado por'],
        body: rows.map(c => [
            c.shift_date || '—',
            scWName(c.requester),
            scWName(c.target),
            c.requesterEntry
                ? `${scFmtTime(c.requesterEntry.clock_in)} → ${scFmtTime(c.requesterEntry.clock_out)}`
                : '—',
            SC_STATUS_LABEL[c.status] || c.status,
            c.reviewer?.email || '—',
        ]),
        foot: ['TOTAL', `${rows.length} solicitudes`, '', '', '', ''],
    });

    addFooters(doc);
    doc.save(`reporte_turnos_${from}_${to}.pdf`);
}
