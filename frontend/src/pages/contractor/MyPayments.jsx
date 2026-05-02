import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import useApi from '../../hooks/useApi';
import rawApi from '../../utils/api';
import './MyPayments.css';

const fmt = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

const fmtDate = (d) => {
  if (!d) return '';
  const s = (d + '').split('T')[0];
  const [y, m, day] = s.split('-');
  return `${m}/${day}/${y}`;
};

const METHOD_BADGE = {
  zelle: { label: 'Zelle', cls: 'mp-badge-zelle' },
  cash:  { label: 'Cash', cls: 'mp-badge-cash' },
  check: { label: 'Check', cls: 'mp-badge-check' },
};

function VoucherModal({ lineId, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const urlRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Use raw axios instance so we get the full response (not useApi which strips to res.data)
        const res = await rawApi.get(`/payroll/lines/${lineId}/voucher-view`, {
          responseType: 'text',
        });
        if (cancelled) return;
        const html = res.data;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setBlobUrl(url);
      } catch (e) {
        if (!cancelled) {
          setError('No se pudo cargar el comprobante.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [lineId]);

  return ReactDOM.createPortal(
    <div className="mp-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mp-modal">
        <div className="mp-modal-header">
          <span className="mp-modal-title">Comprobante de Pago</span>
          <button className="mp-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="mp-modal-body">
          {loading && <div className="mp-modal-loading">Cargando comprobante...</div>}
          {error && <div className="mp-modal-error">{error}</div>}
          {blobUrl && (
            <iframe
              src={blobUrl}
              title="Comprobante de pago"
              className="mp-iframe"
              sandbox="allow-same-origin"
              onContextMenu={(e) => e.preventDefault()}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function MyPayments() {
  const api = useApi();
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voucherLineId, setVoucherLineId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/payroll/lines/my');
        if (cancelled) return;
        const data = res.data?.data || res.data;
        setLines(Array.isArray(data) ? data : []);
      } catch (e) {
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // empty array is correct: fetch only on mount

  if (loading) return <div className="mp-loading">Cargando pagos...</div>;

  return (
    <div className="mp-page fade-in">
      <div className="mp-page-header">
        <h2>Mis Pagos</h2>
        <p>Historial de nóminas y comprobantes</p>
      </div>

      {lines.length === 0 ? (
        <div className="mp-empty">
          <div className="mp-empty-icon">💰</div>
          <p>No hay pagos registrados aún.</p>
        </div>
      ) : (
        <div className="mp-list">
          {lines.map(line => {
            const payroll = line.payroll || {};
            const project = line.project || {};
            const client = project.client || {};
            const method = (line.payment_method || '').toLowerCase();
            const badge = METHOD_BADGE[method];
            const isPaid = line.status === 'paid';
            const hasVoucher = !!line.voucher_number;

            return (
              <div key={line.id} className="mp-card">
                <div className="mp-card-top">
                  <div className="mp-card-period">
                    <div className="mp-period-label">Período de pago</div>
                    <div className="mp-period-val">
                      {fmtDate(payroll.week_start_date)} – {fmtDate(payroll.week_end_date)}
                    </div>
                    {client.company_name && (
                      <div className="mp-project">{client.company_name} · {project.name}</div>
                    )}
                  </div>
                  <div className="mp-card-status">
                    {badge && <span className={`mp-badge ${badge.cls}`}>{badge.label}</span>}
                    <span className={`mp-status ${isPaid ? 'mp-status-paid' : 'mp-status-pending'}`}>
                      {isPaid ? '● Pagado' : '○ Pendiente'}
                    </span>
                  </div>
                </div>

                <div className="mp-card-body">
                  <div className="mp-money-row">
                    <div className="mp-money-item">
                      <div className="mp-money-label">Bruto</div>
                      <div className="mp-money-val">{fmt(line.gross_pay)}</div>
                    </div>
                    {parseFloat(line.deductions || 0) > 0 && (
                      <div className="mp-money-item">
                        <div className="mp-money-label">Deducciones</div>
                        <div className="mp-money-val mp-deduction">– {fmt(line.deductions)}</div>
                      </div>
                    )}
                    {parseFloat(line.per_diem_amount || 0) > 0 && (
                      <div className="mp-money-item">
                        <div className="mp-money-label">Per Diem</div>
                        <div className="mp-money-val">{fmt(line.per_diem_amount)}</div>
                      </div>
                    )}
                    <div className="mp-money-item mp-money-net">
                      <div className="mp-money-label">Neto</div>
                      <div className="mp-money-val mp-net">{fmt(line.total_to_transfer)}</div>
                    </div>
                  </div>

                  {isPaid && line.paid_at && (
                    <div className="mp-paid-at">Pagado el {fmtDate(line.paid_at?.split?.('T')?.[0])}</div>
                  )}
                </div>

                {hasVoucher && (
                  <div className="mp-card-footer">
                    <span className="mp-voucher-num">{line.voucher_number}</span>
                    <button
                      className="mp-btn-voucher"
                      onClick={() => setVoucherLineId(line.id)}
                    >
                      Ver Comprobante →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {voucherLineId && (
        <VoucherModal
          lineId={voucherLineId}
          onClose={() => setVoucherLineId(null)}
        />
      )}
    </div>
  );
}
