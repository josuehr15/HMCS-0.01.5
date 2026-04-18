// ─── Tax Export Utilities ────────────────────────────────────────────────────
// Generates HTML preview documents for Tax Summary and 1099-NEC reports.
// The generated HTML is safe — all values are inserted as text (no user input).

export const generateTaxSummaryHtml = (taxData, year) => `
  <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 32px; color: #1a1a1a;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 2px solid #2A6C95; padding-bottom: 16px;">
      <div>
        <div style="font-size: 22px; font-weight: 700; color: #2A6C95;">HM Construction Staffing LLLP</div>
        <div style="font-size: 13px; color: #666; margin-top: 4px;">Savannah, Georgia</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 16px; font-weight: 600;">Resumen Fiscal</div>
        <div style="font-size: 13px; color: #666;">Año ${year}</div>
        <div style="font-size: 11px; color: #999; margin-top: 4px;">Generado: ${new Date().toLocaleDateString('es-US')}</div>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr style="background: #f0f9f4;">
        <td style="padding: 10px 14px; font-weight: 600; font-size: 13px; border: 0.5px solid #9FE1CB;">Ingresos Brutos</td>
        <td style="padding: 10px 14px; text-align: right; font-weight: 700; font-size: 15px; color: #3B6D11; border: 0.5px solid #9FE1CB;">$${(taxData.gross_income || 0).toFixed(2)}</td>
      </tr>
    </table>

    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #A32D2D; margin-bottom: 8px;">Gastos Deducibles</div>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      ${(taxData.deductible_by_category || []).map(c => `
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; border-bottom: 0.5px solid #eee;">${c.name_es}</td>
          <td style="padding: 8px 14px; text-align: right; font-size: 13px; color: #A32D2D; border-bottom: 0.5px solid #eee;">($${c.total.toFixed(2)})</td>
        </tr>
      `).join('')}
      <tr style="background: #fef5f5; border-top: 1px solid #f7c1c1;">
        <td style="padding: 10px 14px; font-weight: 600; font-size: 13px; border: 0.5px solid #f7c1c1;">Total Deducible</td>
        <td style="padding: 10px 14px; text-align: right; font-weight: 700; font-size: 15px; color: #A32D2D; border: 0.5px solid #f7c1c1;">($${(taxData.total_deductible || 0).toFixed(2)})</td>
      </tr>
    </table>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <tr style="background: #2A6C95; color: #fff;">
        <td style="padding: 12px 14px; font-weight: 700; font-size: 14px;">Ingreso Neto Gravable</td>
        <td style="padding: 12px 14px; text-align: right; font-weight: 700; font-size: 18px;">$${(taxData.net_taxable || 0).toFixed(2)}</td>
      </tr>
    </table>

    <div style="padding: 10px 14px; background: #f0f6fc; border: 0.5px solid #b5d4f4; border-radius: 6px; font-size: 11px; color: #185FA5;">
      Per Diem passthrough ($${(taxData.per_diem_total || 0).toFixed(2)}) — NO gravable. No incluido en el cálculo de ingresos ni deducciones.
    </div>

    <div style="margin-top: 40px; padding-top: 14px; border-top: 0.5px solid #ddd; font-size: 10px; color: #999; text-align: center;">
      HM Construction Staffing LLLP · Documento generado por HMCS · ${new Date().toLocaleDateString('es-US')}
    </div>
  </div>
`;

export const generate1099Html = (workers, year) => `
  <div style="font-family: Arial, sans-serif; max-width: 760px; margin: 0 auto; padding: 32px; color: #1a1a1a;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 2px solid #08543D; padding-bottom: 16px;">
      <div>
        <div style="font-size: 22px; font-weight: 700; color: #08543D;">HM Construction Staffing LLLP</div>
        <div style="font-size: 13px; color: #666; margin-top: 4px;">Savannah, Georgia</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 16px; font-weight: 600;">Reporte 1099-NEC</div>
        <div style="font-size: 13px; color: #666;">Año Fiscal ${year}</div>
        <div style="font-size: 11px; color: #999; margin-top: 4px;">Generado: ${new Date().toLocaleDateString('es-US')}</div>
      </div>
    </div>

    <div style="font-size: 11px; color: #666; margin-bottom: 14px;">
      Contratistas independientes que recibieron $600 o más en compensación no laboral durante el año fiscal ${year}.
    </div>

    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #08543D; color: #fff;">
          <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600;">Nombre Completo</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600;">Código</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600;">SSN</th>
          <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600;">Dirección</th>
          <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600;">Total Pagado</th>
          <th style="padding: 10px 12px; text-align: center; font-size: 11px; font-weight: 600;">1099</th>
        </tr>
      </thead>
      <tbody>
        ${(workers || []).map((w, i) => `
          <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9f9f9'}; border-bottom: 0.5px solid #eee;">
            <td style="padding: 10px 12px; font-size: 12px; font-weight: 500;">${w.first_name} ${w.last_name}</td>
            <td style="padding: 10px 12px; font-size: 11px; font-family: monospace; color: #666;">${w.worker_code}</td>
            <td style="padding: 10px 12px; font-size: 12px; font-family: monospace;">
              ${w.ssn ? w.ssn : '<span style="color:#A32D2D;font-size:11px;">Sin SSN</span>'}
            </td>
            <td style="padding: 10px 12px; font-size: 11px; color: #444;">
              ${w.address ? `${w.address}${w.city ? ', ' + w.city : ''}${w.state ? ', ' + w.state : ''}${w.zip_code ? ' ' + w.zip_code : ''}` : '<span style="color:#A32D2D;">Sin dirección</span>'}
            </td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 700; font-size: 13px;">
              $${w.total_paid.toFixed(2)}
            </td>
            <td style="padding: 10px 12px; text-align: center;">
              ${w.total_paid >= 600
                ? `<span style="background:#fff8ed;color:#6b4700;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">Sí</span>`
                : `<span style="background:#f5f5f5;color:#999;padding:2px 8px;border-radius:10px;font-size:11px;">No</span>`
              }
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div style="margin-top: 24px; padding: 12px 14px; background: #f0f9f4; border-left: 3px solid #08543D; font-size: 11px; color: #444;">
      <strong>Nota:</strong> El SSN completo está incluido en este reporte para uso exclusivo de la contadora.
    </div>

    <div style="margin-top: 32px; padding-top: 14px; border-top: 0.5px solid #ddd; font-size: 10px; color: #999; text-align: center;">
      HM Construction Staffing LLLP · Reporte 1099-NEC ${year} · HMCS · ${new Date().toLocaleDateString('es-US')}
    </div>
  </div>
`;
