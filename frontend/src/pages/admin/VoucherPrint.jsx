import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import PaymentUploadModal from '../../components/admin/PaymentUploadModal';
import './VoucherPrint.css';

const fmt = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

const fmtDate = (d) => {
  if (!d) return '';
  const s = (d + '').split('T')[0];
  const [y, m, day] = s.split('-');
  return `${m}/${day}/${y}`;
};

const getWeekNumber = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
};

const issueDate = (() => {
  const t = new Date();
  return `${String(t.getMonth() + 1).padStart(2, '0')}/${String(t.getDate()).padStart(2, '0')}/${t.getFullYear()}`;
})();

function PaymentPanel({ method, payData, workerName, workerCode, weekNum, total, paidAt }) {
  const paidAtStr = payData?.paid_at_datetime
    ? fmtDate(payData.paid_at_datetime.split('T')[0])
    : fmtDate(paidAt);

  if (method === 'zelle') return (
    <>
      <span className="vp-badge vp-badge-zelle">✓ PAID VIA ZELLE</span>
      <div className="vp-pay-row"><span className="vp-pay-label">Sent to</span><span>{payData?.sent_to || workerName}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Registered as</span><span>{payData?.registered_as || '—'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">From account</span><span>{payData?.from_account || '—'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Confirmation #</span><span>{payData?.confirmation_number || '—'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Date &amp; Time</span><span>{paidAtStr || '—'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Bank</span><span>{payData?.bank || 'Wells Fargo'}</span></div>
      <div className="vp-pay-divider vp-pay-divider-zelle">
        <div className="vp-net-label">NET TRANSFER</div>
        <div className="vp-net-amt vp-net-zelle">{fmt(total)}</div>
      </div>
    </>
  );

  if (method === 'cash') return (
    <>
      <span className="vp-badge vp-badge-cash">✓ CASH EWITHDRAWAL</span>
      <div className="vp-pay-row"><span className="vp-pay-label">Bank</span><span>{payData?.bank || 'Wells Fargo Bank'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Account</span><span>{payData?.account || '—'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Branch #</span><span>{payData?.branch_number || '—'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Transaction #</span><span>{payData?.transaction_number || '—'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Date &amp; Time</span><span>{paidAtStr || '—'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Type</span><span>Cash Paid to Customer</span></div>
      <div className="vp-pay-divider vp-pay-divider-cash">
        <div className="vp-net-label">CASH PAID</div>
        <div className="vp-net-amt vp-net-cash">{fmt(total)}</div>
      </div>
    </>
  );

  if (method === 'check') return (
    <>
      <span className="vp-badge vp-badge-check">✓ CHECK</span>
      <div className="vp-pay-row"><span className="vp-pay-label">Payable to</span><span>{payData?.payable_to || workerName}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Check #</span><span>{payData?.check_number || '—'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Bank</span><span>{payData?.bank || 'Wells Fargo Bank'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Account</span><span>{payData?.account || '—'}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Issue Date</span><span>{paidAtStr || issueDate}</span></div>
      <div className="vp-pay-row"><span className="vp-pay-label">Memo</span><span>Week {weekNum} · {workerCode}</span></div>
      <div className="vp-pay-divider vp-pay-divider-check">
        <div className="vp-net-label">CHECK AMOUNT</div>
        <div className="vp-net-amt vp-net-check">{fmt(total)}</div>
      </div>
    </>
  );

  return <div className="vp-no-payment">No payment information recorded yet.</div>;
}

function VoucherPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchLine = async () => {
      try {
        const res = await api.get(`/payroll/lines/${id}`);
        if (!cancelled) setData(res.data?.data || res.data);
      } catch (e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLine();
    return () => { cancelled = true; };
  }, [id]); // id from URL param — re-fetch if ID changes

  if (loading) return <div className="vp-loading">Loading voucher...</div>;
  if (!data) return <div className="vp-loading">Voucher not found</div>;

  const w = data.worker || {};
  const payroll = data.payroll || {};
  const project = data.project || {};
  const client = project.client || {};
  const payData = data.payment_data || {};
  const method = (data.payment_method || '').toLowerCase();
  const deductions = Array.isArray(data.deductions_detail) ? data.deductions_detail : [];

  const ssnLast4 = w.ssn_encrypted ? w.ssn_encrypted.replace(/\D/g, '').slice(-4) : '----';
  const workerName = `${w.first_name || ''} ${w.last_name || ''}`.trim();
  const weekNum = getWeekNumber(payroll.week_start_date);
  const weekYear = payroll.week_start_date ? new Date(payroll.week_start_date + 'T00:00:00').getFullYear() : '';

  const pdAmount = parseFloat(data.per_diem_amount || 0);
  const pdDays = 5;
  const pdRate = pdAmount > 0 ? (pdAmount / pdDays).toFixed(2) : '0.00';

  // YTD — not returned by basic getPayrollLineById, show placeholder
  // Full YTD is available in the /voucher-view HTML endpoint
  const ytdRegular = data.ytd_regular_pay ?? null;
  const ytdOvertime = data.ytd_overtime_pay ?? null;
  const ytdPerDiem = data.ytd_per_diem ?? null;

  const screenshotUrl = data.payment_screenshot_url;
  const methodLabel = method === 'zelle' ? 'Zelle' : method === 'cash' ? 'Cash' : method === 'check' ? 'Check' : null;

  return (
    <div className="vp-page-wrapper">
      {/* Action bar — hidden on print */}
      <div className="vp-actions no-print">
        <button className="vp-btn-back" onClick={() => navigate('/admin/payroll')}>← Volver a Nómina</button>
        <div className="vp-actions-right">
          <button className="vp-btn-upload" onClick={() => setShowUploadModal(true)}>
            📷 Subir Comprobante
          </button>
          <button className="vp-btn-print" onClick={() => window.print()}>
            🖨️ Imprimir / PDF
          </button>
        </div>
      </div>

      {/* VOUCHER */}
      <div className="vp-voucher">

        {/* HEADER */}
        <div className="vp-header">
          <div className="vp-header-left">
            <div className="vp-label-sm">Earnings Statement</div>
            <h1 className="vp-company">HM Construction Staffing LLLP</h1>
            <div className="vp-addr">
              500 Lucas Dr, Savannah, GA<br />
              hmcs@hmconstructionlllp.com
            </div>
          </div>
          <div className="vp-header-right">
            <img src="/images/logo%20cuadrado.JPG" alt="HMCS" className="vp-logo" onError={(e) => { e.target.style.display = 'none'; }} />
            <div className="vp-header-meta">
              <div className="vp-meta-block">
                <div className="vp-label-sm">Statement #</div>
                <div className="vp-meta-val">{data.voucher_number || 'DRAFT'}</div>
              </div>
              <div className="vp-meta-sep" />
              <div className="vp-meta-block">
                <div className="vp-label-sm">Issue Date</div>
                <div className="vp-meta-val">{issueDate}</div>
              </div>
            </div>
          </div>
        </div>

        {/* INFO ROW */}
        <div className="vp-info-row">
          <div className="vp-info-cell">
            <div className="vp-cell-label">Worker</div>
            <div className="vp-cell-val">{workerName}</div>
            <div className="vp-cell-sub">{w.worker_code}</div>
          </div>
          <div className="vp-info-cell">
            <div className="vp-cell-label">Address</div>
            <div className="vp-cell-val">{w.address || '—'}</div>
          </div>
          <div className="vp-info-cell">
            <div className="vp-cell-label">SSN (Last 4)</div>
            <div className="vp-cell-val">XXX-XX-{ssnLast4}</div>
          </div>
          <div className="vp-info-cell">
            <div className="vp-cell-label">Pay Period</div>
            <div className="vp-cell-val">
              {fmtDate(payroll.week_start_date)} – {fmtDate(payroll.week_end_date)}
            </div>
            <div className="vp-cell-sub">{weekYear} · Week {weekNum}</div>
          </div>
          <div className="vp-info-cell">
            <div className="vp-cell-label">Project / Client</div>
            <div className="vp-cell-val">{client.company_name || '—'}</div>
            <div className="vp-cell-sub">
              {project.name || '—'}{w.trade?.name ? ` · ${w.trade.name}` : ''}
            </div>
          </div>
        </div>

        {/* DEDUCTIONS + EARNINGS */}
        <div className="vp-two-col">
          <div className="vp-col">
            <div className="vp-col-title">Deductions</div>
            <table className="vp-table">
              <thead>
                <tr><th>Description</th><th className="r">Amount</th><th className="r">YTD</th></tr>
              </thead>
              <tbody>
                {deductions.length === 0 ? (
                  <tr><td colSpan={3} className="vp-empty-row">No deductions</td></tr>
                ) : deductions.map((d, i) => (
                  <tr key={i}>
                    <td>{d.description || d.type || 'Deduction'}</td>
                    <td className="r vp-ded">– {fmt(d.amount)}</td>
                    <td className="r vp-ytd">– {fmt(d.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total Deductions</td>
                  <td className="r vp-ded">– {fmt(data.deductions)}</td>
                  <td className="r vp-ytd">– {fmt(data.deductions)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="vp-col vp-col-right">
            <div className="vp-col-title">Earnings</div>
            <table className="vp-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="r">Hrs</th>
                  <th className="r">Rate</th>
                  <th className="r">Amt</th>
                  <th className="r">YTD</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Regular Time</td>
                  <td className="r">{parseFloat(data.regular_hours).toFixed(1)}</td>
                  <td className="r">{fmt(data.regular_rate)}</td>
                  <td className="r">{fmt(data.regular_pay)}</td>
                  <td className="r vp-ytd">{ytdRegular !== null ? fmt(ytdRegular) : '—'}</td>
                </tr>
                {parseFloat(data.overtime_hours || 0) > 0 && (
                  <tr>
                    <td>Overtime 1.5x</td>
                    <td className="r">{parseFloat(data.overtime_hours).toFixed(1)}</td>
                    <td className="r">{fmt(data.overtime_rate)}</td>
                    <td className="r">{fmt(data.overtime_pay)}</td>
                    <td className="r vp-ytd">{ytdOvertime !== null ? fmt(ytdOvertime) : '—'}</td>
                  </tr>
                )}
                {pdAmount > 0 && (
                  <tr>
                    <td>Per Diem</td>
                    <td className="r">{pdDays}d</td>
                    <td className="r">${pdRate}</td>
                    <td className="r">{fmt(pdAmount)}</td>
                    <td className="r vp-ytd">{ytdPerDiem !== null ? fmt(ytdPerDiem) : '—'}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Gross Earnings</td>
                  <td className="r">{fmt(data.gross_pay)}</td>
                  <td className="r vp-ytd">{ytdRegular !== null ? fmt(parseFloat(ytdRegular) + parseFloat(ytdOvertime || 0)) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* PAYMENT INFO + SCREENSHOT */}
        <div className="vp-two-col">
          <div className="vp-col">
            <PaymentPanel
              method={method}
              payData={payData}
              workerName={workerName}
              workerCode={w.worker_code}
              weekNum={weekNum}
              total={data.total_to_transfer}
              paidAt={data.paid_at}
            />
          </div>
          <div className="vp-col vp-col-right">
            <div className="vp-col-title">
              {method === 'check' ? 'Check / Receipt Photo' : 'Payment Screenshot'}
            </div>
            {screenshotUrl ? (
              <div className="vp-screenshot-filled">
                <img src={`http://localhost:5000${screenshotUrl}`} alt="Payment proof" className="vp-screenshot-img" />
                {methodLabel && <div className="vp-screenshot-tag">{methodLabel} · Wells Fargo</div>}
              </div>
            ) : (
              <div className="vp-screenshot-empty no-print" onClick={() => setShowUploadModal(true)}>
                <svg width="36" height="36" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Subir captura de Zelle o recibo</span>
                <span className="vp-screenshot-sub">La IA extrae automáticamente<br />monto · confirmación · fecha</span>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="vp-footer">
          <div className="vp-footer-left">
            HM Construction Staffing LLLP — Independent Contractor (1099)<br />
            No se retienen impuestos federales ni estatales.
          </div>
          <div className="vp-paid-badge">● Pagado · {fmtDate(data.paid_at?.split?.('T')?.[0] || data.paid_at)}</div>
        </div>

      </div>

      {showUploadModal && (
        <PaymentUploadModal
          lineId={id}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => { setShowUploadModal(false); fetchLine(); }}
        />
      )}
    </div>
  );
}

export default VoucherPrint;
