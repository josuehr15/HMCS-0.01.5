import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { DollarSign, X } from 'lucide-react';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import PaymentUploadModal from '../../components/admin/PaymentUploadModal';
import './Payroll.css';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatWeekRange(start, end) {
  if (!start || !end) return '';
  const opts = { month: 'short', day: 'numeric' };
  const s = new Date(start + 'T12:00:00').toLocaleDateString('en-US', opts);
  const e = new Date(end + 'T12:00:00').toLocaleDateString('en-US', opts);
  const year = new Date(end + 'T12:00:00').getFullYear();
  return `${s} – ${e}, ${year}`;
}

function statusLabel(status) {
  const map = {
    pending_approval: 'Pendiente',
    pending: 'Pendiente',
    approved: 'Aprobada',
    paid: 'Pagada',
    draft: 'Borrador',
    partial: 'Parcial',
    ungenerated: 'Sin generar'
  };
  return map[status] || status;
}

// ─── COMPONENTE: MetricCard ───────────────────────────────────────────────────
function MetricCard({ color, label, value, hint }) {
  const dots = { red: '#E24B4A', green: '#08543D', blue: '#2A6C95', amber: '#BA7517' };
  return (
    <div className="metric-card">
      <div className="metric-label">
        <span className="metric-dot" style={{ background: dots[color] }} />
        {label}
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-hint">{hint}</div>
    </div>
  );
}

// ─── COMPONENTE: WeekSidebar ──────────────────────────────────────────────────
function WeekSidebar({ weeks, selected, onSelect }) {
  return (
    <div className="week-sidebar">
      <div className="sidebar-label">Semanas</div>
      {weeks.map(w => {
        // use w.id ideally, but ungenerated might not have an id, so fallback to week_start_date
        const keyId = w.id || w.week_start_date;
        const totalAmount = parseFloat(w.total_amount || 0).toFixed(2);

        // Count workers (lines length if available, fallback to worker_count)
        const workerCount = w.lines ? w.lines.length : (w.worker_count || 0);

        return (
          <div
            key={keyId}
            className={`week-card ${selected === keyId ? 'active' : ''}`}
            onClick={() => onSelect(keyId, w)}
          >
            <div className="week-card-top">
              <span className="week-dates">
                {formatWeekRange(w.week_start_date, w.week_end_date)}
              </span>
              <span className={`badge badge-${w.status || 'ungenerated'}`}>
                {statusLabel(w.status || 'ungenerated')}
              </span>
            </div>
            <div className="week-meta">
              <span>{workerCount} workers</span>
              {parseFloat(totalAmount) > 0 && <span>${totalAmount}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PayrollDetail({ payroll, weekObj, api, onActionComplete, onRefreshPayroll, showToast, loadingDetail }) {
  const [loading, setLoading] = useState(false);

  const [workerModal, setWorkerModal] = useState(null);
  const [wStep, setWStep] = useState(1);
  const [wDeductions, setWDeductions] = useState([]);
  const [wPayMethod, setWPayMethod] = useState('zelle');
  const [wPayRef, setWPayRef] = useState('');
  const [wFile, setWFile] = useState(null);
  const [wPreview, setWPreview] = useState(null);
  const [wScreenshotUrl, setWScreenshotUrl] = useState(null);
  const [wUploading, setWUploading] = useState(false);
  const [wDedFile, setWDedFile] = useState(null);
  const [wDedPreview, setWDedPreview] = useState(null);
  const [wIsEdit, setWIsEdit] = useState(false);
  const [uploadLine, setUploadLine] = useState(null);

  // If no week selected
  if (!weekObj) return (
    <div className="detail-empty">
      <div className="empty-icon">$</div>
      <p>Selecciona una semana del panel izquierdo</p>
    </div>
  );

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/payroll/generate', {
        week_start_date: weekObj.week_start_date,
        week_end_date: weekObj.week_end_date,
      });
      onActionComplete('generate', res.data?.data || res.data || res);
      showToast('success', 'Nómina generada correctamente para esta semana.');
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al generar la nómina. Intenta de nuevo.';
      showToast('error', msg);
    }
    setLoading(false);
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await api.patch(`/payroll/${payroll.id}/status`, { status: 'approved' });
      onActionComplete('approve', res.data?.data || res.data || res);
      showToast('success', 'Nómina aprobada correctamente.');
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al aprobar la nómina.';
      showToast('error', msg);
    }
    setLoading(false);
  };

  const openWorkerModal = (line) => {
    setWorkerModal(line);
    setWStep(1);
    setWIsEdit(line.status === 'paid');
    setWDeductions(
      Array.isArray(line.deductions_detail) && line.deductions_detail.length > 0
        ? line.deductions_detail
        : []
    );
    setWPayMethod('zelle');
    setWPayRef('');
    setWFile(null);
    setWPreview(null);
    setWScreenshotUrl(null);
    setWDedFile(null);
    setWDedPreview(null);
  };

  const closeWorkerModal = () => {
    setWorkerModal(null);
    setWStep(1);
    setWDeductions([]);
    setWFile(null);
    setWPreview(null);
    setWScreenshotUrl(null);
    setWDedFile(null);
    setWDedPreview(null);
    setWIsEdit(false);
  };

  const addDeduction = () => {
    setWDeductions(prev => [...prev, { type: 'other', description: '', amount: '' }]);
  };

  const updateDeduction = (idx, field, value) => {
    setWDeductions(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const removeDeduction = (idx) => {
    setWDeductions(prev => prev.filter((_, i) => i !== idx));
  };

  const totalDeductions = wDeductions.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
  const netToTransfer = workerModal
    ? parseFloat(workerModal.gross_pay || 0) - totalDeductions
    : 0;

  const handleFileSelect = (f) => {
    if (!f) return;
    setWFile(f);
    setWPreview(URL.createObjectURL(f));
  };

  const handleDedFileSelect = (f) => {
    if (!f) return;
    setWDedFile(f);
    setWDedPreview(URL.createObjectURL(f));
  };

  const uploadScreenshot = async () => {
    if (!wFile || !workerModal) return;
    setWUploading(true);
    try {
      const formData = new FormData();
      formData.append('screenshot', wFile);
      const res = await fetch(
        `http://localhost:5000/api/payroll/lines/${workerModal.id}/upload-screenshot`,
        { method: 'POST', credentials: 'include', body: formData }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Upload failed');
      const url = json.data?.screenshot_url || json.screenshot_url || '';
      setWScreenshotUrl(url);
      setWStep(3);
    } catch (err) {
      console.error('Upload error:', err);
      setWStep(3);
    } finally {
      setWUploading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!workerModal) return;
    setLoading(true);
    try {
      if (wDeductions.length > 0) {
        const validDeds = wDeductions.filter(d => parseFloat(d.amount || 0) > 0);
        if (validDeds.length > 0) {
          await api.put(`/payroll/lines/${workerModal.id}`, {
            deductions_detail: validDeds,
          });
        }
      }

      if (wScreenshotUrl) {
        await api.post(`/payroll/lines/${workerModal.id}/confirm-payment-data`, {
          extracted_data: { payment_type: wPayMethod },
          payment_method: wPayMethod,
          screenshot_url: wScreenshotUrl,
        });
      }

      if (wIsEdit) {
        if (wPayRef || wPayMethod) {
          await api.patch(`/payroll/lines/${workerModal.id}/pay`, {
            payment_method: wPayMethod,
            payment_reference: wPayRef,
            notes: '',
          }).catch(() => {});
        }
        onRefreshPayroll?.();
        showToast('success', 'Cambios guardados correctamente.');
      } else {
        const res = await api.patch(`/payroll/lines/${workerModal.id}/pay`, {
          payment_method: wPayMethod,
          payment_reference: wPayRef,
          notes: '',
        });
        onActionComplete('line_paid', res.data?.data || res.data || res);
        showToast('success', 'Pago registrado correctamente.');
      }
      closeWorkerModal();
    } catch (e) {
      const msg = e.response?.data?.message || 'Error al registrar el pago.';
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  if (loadingDetail) {
    return (
      <div className="detail-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <p style={{ color: '#888' }}>Cargando detalle...</p>
      </div>
    );
  }

  // ESTADO A — Sin nómina
  const hasLines = payroll?.lines && payroll.lines.length > 0;
  const hasWorkerData = hasLines && payroll.lines[0]?.worker;

  if (!hasWorkerData) {
    return (
      <div className="detail-card">
        <div className="detail-header">
          <div>
            <div className="detail-title">{formatWeekRange(weekObj.week_start_date, weekObj.week_end_date)}</div>
            <div className="detail-sub">Semana sin nómina generada</div>
          </div>
        </div>

        <div className="alert-warning">
          <div className="alert-icon">!</div>
          <div>
            <div className="alert-title">Nómina no generada</div>
            <div className="alert-desc">
              Hay entradas aprobadas listas para calcular. El sistema usará
              <code>hourly_rate</code> de cada worker + overtime 1.5x.
            </div>
          </div>
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <button className="btn-generate" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generando...' : '+ Generar nómina para esta semana'}
          </button>
        </div>
      </div>
    );
  }

  // ESTADO B — Con Nómina Geenrada
  const laborTotal = payroll.lines.reduce((s, l) => s + parseFloat(l.gross_pay || 0), 0);
  const regularTotal = payroll.lines.reduce((s, l) => s + parseFloat(l.regular_pay || 0), 0);
  const otTotal = payroll.lines.reduce((s, l) => s + parseFloat(l.overtime_pay || 0), 0);
  const pdTotal = payroll.lines.reduce((s, l) => s + parseFloat(l.per_diem_amount || 0), 0);
  const transferTotal = payroll.lines.reduce((s, l) => s + parseFloat(l.total_to_transfer || 0), 0);

  return (
    <div className="detail-card">
      <div className="detail-header">
        <div>
          <div className="detail-title">
            {formatWeekRange(payroll.week_start_date, payroll.week_end_date)}
          </div>
          <div className="detail-sub">
            {payroll.lines.length} workers · ${laborTotal.toFixed(2)} total bruto
          </div>
        </div>
        <div className="detail-actions">
          <span className={`badge badge-${payroll.status}`}>{statusLabel(payroll.status)}</span>
          {['pending', 'pending_approval'].includes(payroll.status) && (
            <button className="btn-approve" onClick={handleApprove} disabled={loading}>
              {loading ? 'Aprobando...' : 'Aprobar nómina'}
            </button>
          )}
        </div>
      </div>

      <div className="worker-table-wrap">
        <div className="worker-row thead" style={{ gridTemplateColumns: 'minmax(180px, 1fr) 70px 70px 70px 80px 80px 90px 140px' }}>
          <div className="th">Worker</div>
          <div className="th r">Reg hrs</div>
          <div className="th r">OT hrs</div>
          <div className="th r">Rate</div>
          <div className="th r">Gross</div>
          <div className="th r">P.Diem</div>
          <div className="th r">Total</div>
          <div className="th r">Acción</div>
        </div>

        {payroll.lines.map(line => {
          const worker = line.worker || {};
          const initials = `${worker.first_name?.[0] || ''}${worker.last_name?.[0] || ''}`.toUpperCase();
          const isPaid = line.status === 'paid';
          return (
            <div
              key={line.id}
              className="worker-row"
              style={{
                gridTemplateColumns: 'minmax(180px, 1fr) 70px 70px 70px 80px 80px 90px 140px',
                cursor: 'pointer',
              }}
              onClick={() => openWorkerModal(line)}
            >
              <div className="worker-info">
                <div className="worker-avatar">{initials}</div>
                <div>
                  <div className="worker-name">
                    {worker.first_name} {worker.last_name}
                  </div>
                  <div className="worker-trade" title={worker.trade?.name}>
                    {worker.trade?.name || '—'} · ${parseFloat(line.regular_rate || 0).toFixed(2)}/hr
                  </div>
                </div>
              </div>
              <div className="num">{parseFloat(line.regular_hours || 0).toFixed(1)}</div>
              <div className={parseFloat(line.overtime_hours || 0) > 0 ? 'num' : 'num-muted'}>
                {parseFloat(line.overtime_hours || 0) > 0 ? parseFloat(line.overtime_hours || 0).toFixed(1) : '—'}
              </div>
              <div className="num-muted">${parseFloat(line.regular_rate || 0).toFixed(2)}</div>
              <div className="num">${parseFloat(line.gross_pay || 0).toFixed(2)}</div>
              <div className={parseFloat(line.per_diem_amount || 0) > 0 ? 'num' : 'num-muted'}>
                {parseFloat(line.per_diem_amount || 0) > 0 ? `$${parseFloat(line.per_diem_amount || 0).toFixed(2)}` : '—'}
              </div>
              <div className="amount green">${parseFloat(line.total_to_transfer || 0).toFixed(2)}</div>
              <div className="pay-action">
                {isPaid ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn-paid-done" disabled>✓ Pagado</button>
                      <a href={`/admin/payroll/voucher/${line.id}`} target="_blank" rel="noreferrer" className="btn-voucher" title="Ver Voucher">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                          <polyline points="10 9 9 9 8 9"/>
                        </svg>
                      </a>
                    </div>
                    {line.voucher_number ? (
                      <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>{line.voucher_number}</span>
                    ) : (
                      <button
                        className="btn-voucher-upload"
                        onClick={(e) => { e.stopPropagation(); setUploadLine(line); }}
                        title="Subir comprobante de pago"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                        Comprobante
                      </button>
                    )}
                  </div>
                ) : (
                  <button className="btn-pay" onClick={(e) => { e.stopPropagation(); openWorkerModal(line); }}>
                    Marcar pagado
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="detail-footer">
        <div className="footer-note">
          Verifica el método de transferencia al registrar el pago.
        </div>
        <div className="footer-totals">
          <div className="ft-item">
            <div className="ft-label">Salario Bruto (Labor)</div>
            <div className="ft-value">${laborTotal.toFixed(2)}</div>
          </div>
          <div className="ft-item">
            <div className="ft-label">Total Per Diem</div>
            <div className="ft-value">${pdTotal.toFixed(2)}</div>
          </div>
          <div className="ft-item">
            <div className="ft-label">Total a Transferir</div>
            <div className="ft-value green" style={{ fontWeight: 700 }}>${transferTotal.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {uploadLine && (
        <PaymentUploadModal
          lineId={uploadLine.id}
          onClose={() => setUploadLine(null)}
          onSuccess={() => { setUploadLine(null); onRefreshPayroll?.(); }}
        />
      )}

      {workerModal && ReactDOM.createPortal(
        <div className="payroll-modal-backdrop" onClick={(e) => e.target === e.currentTarget && closeWorkerModal()}>
          <div className="payroll-modal fade-in-up" style={{ width: 580, maxWidth: '95vw' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 28px 18px', borderBottom: '1px solid var(--border)', margin: '0 -28px 20px', paddingLeft: 28, paddingRight: 28 }}>
              <div className="hmcs-modal-identity">
                <div className="hmcs-modal-identity__avatar-wrap">
                  <div className="hmcs-modal-identity__avatar">
                    {workerModal.worker?.first_name
                      ? `${workerModal.worker.first_name[0]}${workerModal.worker.last_name?.[0] || ''}`.toUpperCase()
                      : <DollarSign size={24} />
                    }
                  </div>
                </div>
                <div className="hmcs-modal-identity__text">
                  <h2 className="hmcs-modal-identity__name">
                    {workerModal.worker?.first_name} {workerModal.worker?.last_name}
                  </h2>
                  <div className="hmcs-modal-identity__meta">
                    <span className="hmcs-modal-identity__meta-code">
                      {wStep === 1 && (wIsEdit ? 'Editar Deducciones' : 'Deducciones')}
                      {wStep === 2 && (wIsEdit ? 'Editar Comprobante' : 'Comprobante de Pago')}
                      {wStep === 3 && (wIsEdit ? 'Confirmar Cambios' : 'Confirmar Pago')}
                    </span>
                    <span className="hmcs-modal-identity__dot">•</span>
                    <span>${parseFloat(workerModal.gross_pay || 0).toFixed(2)} bruto</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {[1,2,3].map(s => (
                    <div key={s} style={{
                      width: s === wStep ? 20 : 8, height: 8,
                      borderRadius: s === wStep ? 4 : '50%',
                      background: wStep > s ? '#10b981' : wStep === s ? '#08543D' : '#e5e7eb',
                      transition: 'all 0.2s'
                    }} />
                  ))}
                </div>
                <button className="workers-modal__close" onClick={closeWorkerModal}><X size={16} /></button>
              </div>
            </div>

            {wIsEdit && (
              <div style={{
                background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 6,
                padding: '8px 12px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span style={{ fontSize: 12, color: '#92400e', fontWeight: 500 }}>
                  Este pago ya fue procesado. Los cambios actualizarán el voucher existente.
                </span>
              </div>
            )}

            {/* ── PASO 1: DEDUCCIONES ── */}
            {wStep === 1 && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  {wDeductions.map((d, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 90px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                      <select
                        value={d.type}
                        onChange={e => updateDeduction(idx, 'type', e.target.value)}
                        style={{ padding: '7px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, background: '#fff' }}
                      >
                        <option value="tool_damage">Tool Damage</option>
                        <option value="advance">Pay Advance</option>
                        <option value="gas">Gas / Mileage</option>
                        <option value="other">Otro</option>
                      </select>
                      <input
                        placeholder="Descripción"
                        value={d.description}
                        onChange={e => updateDeduction(idx, 'description', e.target.value)}
                        style={{ padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                      />
                      <input
                        type="number"
                        placeholder="$0.00"
                        value={d.amount}
                        onChange={e => updateDeduction(idx, 'amount', e.target.value)}
                        style={{ padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13 }}
                      />
                      <button
                        onClick={() => removeDeduction(idx)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18, padding: 0 }}
                      >✕</button>
                    </div>
                  ))}
                  <button
                    onClick={addDeduction}
                    style={{ background: 'none', border: '1px dashed #d1d5db', borderRadius: 6, padding: '7px 14px', fontSize: 13, color: '#6b7280', cursor: 'pointer', width: '100%', marginTop: 4 }}
                  >+ Agregar deducción</button>
                </div>

                {/* Foto de recibo de deducción (opcional) */}
                <div style={{ marginTop: 12, marginBottom: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    Foto de recibo (opcional)
                  </div>
                  <div
                    onClick={() => document.getElementById('wded-file-input').click()}
                    onDrop={(e) => { e.preventDefault(); handleDedFileSelect(e.dataTransfer.files?.[0]); }}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      border: '1.5px dashed #d1d5db', borderRadius: 8,
                      minHeight: wDedPreview ? 'auto' : 80,
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 6, cursor: 'pointer',
                      background: '#f9fafb', padding: wDedPreview ? 0 : '12px 16px',
                      overflow: 'hidden'
                    }}
                  >
                    {wDedPreview ? (
                      <img src={wDedPreview} alt="Recibo" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6 }} />
                    ) : (
                      <>
                        <svg width="24" height="24" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>Click o arrastra foto del recibo de deducción</span>
                      </>
                    )}
                    <input id="wded-file-input" type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={e => handleDedFileSelect(e.target.files?.[0])} />
                  </div>
                  {wDedPreview && (
                    <button onClick={() => { setWDedFile(null); setWDedPreview(null); }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 11, cursor: 'pointer', marginTop: 4 }}>
                      Quitar foto
                    </button>
                  )}
                </div>

                {wDeductions.length > 0 && (
                  <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', marginBottom: 4 }}>
                      <span>Bruto</span><span>${parseFloat(workerModal.gross_pay || 0).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', marginBottom: 4 }}>
                      <span>Deducciones</span><span>– ${totalDeductions.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#08543D', borderTop: '1px solid #e5e7eb', paddingTop: 6 }}>
                      <span>Net Transfer</span><span>${netToTransfer.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                  <button className="btn-outline" onClick={closeWorkerModal}>Cancelar</button>
                  <button className="btn-generate" onClick={() => setWStep(2)}>Continuar → Comprobante</button>
                </div>
              </div>
            )}

            {/* ── PASO 2: COMPROBANTE ── */}
            {wStep === 2 && (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[
                    { id: 'zelle', label: 'Zelle', color: '#6D1ED4' },
                    { id: 'cash',  label: 'Cash',  color: '#08543D' },
                    { id: 'check', label: 'Check', color: '#2A6C95' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setWPayMethod(m.id)}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8,
                        border: `2px solid ${wPayMethod === m.id ? m.color : '#e5e7eb'}`,
                        background: wPayMethod === m.id ? m.color : '#fff',
                        color: wPayMethod === m.id ? '#fff' : '#374151',
                        fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >{m.label}</button>
                  ))}
                </div>

                {wPayMethod !== 'cash' && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                      {wPayMethod === 'zelle' ? 'Confirmation #' : 'Check #'}
                    </label>
                    <input
                      value={wPayRef}
                      onChange={e => setWPayRef(e.target.value)}
                      placeholder={wPayMethod === 'zelle' ? 'ej: WFCT0ZZ9FJ78' : 'ej: 1042'}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                <div
                  onClick={() => document.getElementById('wfile-input').click()}
                  onDrop={(e) => { e.preventDefault(); handleFileSelect(e.dataTransfer.files?.[0]); }}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    border: '1.5px dashed #d1d5db', borderRadius: 8, minHeight: 160,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, cursor: 'pointer', background: '#f9fafb', padding: 16, marginBottom: 14,
                    transition: 'border-color 0.15s'
                  }}
                >
                  {wPreview ? (
                    <img src={wPreview} alt="Preview" style={{ maxHeight: 160, borderRadius: 6, objectFit: 'contain' }} />
                  ) : (
                    <>
                      <svg width="36" height="36" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>Click o arrastra la foto del comprobante</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>JPG o PNG</span>
                    </>
                  )}
                  <input id="wfile-input" type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files?.[0])} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                  <button className="btn-outline" onClick={() => setWStep(1)}>← Atrás</button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-outline" onClick={() => setWStep(3)} style={{ color: '#6b7280' }}>Omitir foto</button>
                    <button className="btn-generate" disabled={!wFile || wUploading} onClick={uploadScreenshot}>
                      {wUploading ? 'Subiendo...' : 'Subir y continuar →'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── PASO 3: RESUMEN + CONFIRMAR ── */}
            {wStep === 3 && (
              <div>
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Resumen</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
                    <span>Worker</span>
                    <span style={{ fontWeight: 500, color: '#111' }}>{workerModal.worker?.first_name} {workerModal.worker?.last_name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
                    <span>Método</span>
                    <span style={{ fontWeight: 500, color: '#111', textTransform: 'capitalize' }}>{wPayMethod}</span>
                  </div>
                  {wPayRef && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
                      <span>{wPayMethod === 'zelle' ? 'Confirmation #' : 'Check #'}</span>
                      <span style={{ fontWeight: 500, color: '#111', fontFamily: 'monospace' }}>{wPayRef}</span>
                    </div>
                  )}
                  {wDeductions.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#ef4444', marginBottom: 6 }}>
                      <span>Deducciones</span>
                      <span style={{ fontWeight: 500 }}>– ${totalDeductions.toFixed(2)}</span>
                    </div>
                  )}
                  {wScreenshotUrl && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
                      <span>Comprobante</span>
                      <span style={{ color: '#10b981', fontWeight: 500 }}>✓ Foto adjunta</span>
                    </div>
                  )}
                  {wDedPreview && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
                      <span>Recibo deducción</span>
                      <span style={{ color: '#10b981', fontWeight: 500 }}>✓ Foto adjunta</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15, color: '#08543D', borderTop: '1px solid #e5e7eb', paddingTop: 10, marginTop: 8 }}>
                    <span>Net Transfer</span>
                    <span>${netToTransfer.toFixed(2)}</span>
                  </div>
                </div>

                {wPreview && (
                  <div style={{ marginBottom: 14 }}>
                    <img src={wPreview} alt="Comprobante" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', borderRadius: 8, border: '0.5px solid #e5e7eb' }} />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                  <button className="btn-outline" onClick={() => setWStep(2)}>← Atrás</button>
                  <button
                    className="btn-generate"
                    style={{ background: '#10b981', borderColor: '#10b981' }}
                    onClick={handleConfirmPayment}
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : wIsEdit ? '✓ Guardar Cambios' : '✓ Confirmar y Pagar'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function AdminPayroll() {
  const { user } = useAuth();
  const api = useApi();

  const [weeks, setWeeks] = useState([]);
  const [stats, setStats] = useState({ pending: '0.00', paidWeek: '0.00', paidMonth: '0.00', workersDue: 0, pendingWorkers: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [selectedWeekObj, setSelectedWeekObj] = useState(null);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchWeeksAndStats = useCallback(async () => {
    try {
      const [wRes, sRes] = await Promise.all([
        api.get('/payroll/pending-weeks'),
        api.get('/payroll/stats')
      ]);
      const dataWeeks = wRes.data?.data || wRes.data;
      const dataStats = sRes.data?.data || sRes.data;

      const mappedStats = {
        pending: parseFloat(dataStats.pending_amount || 0).toFixed(2),
        paidWeek: parseFloat(dataStats.paid_this_week || 0).toFixed(2),
        paidMonth: parseFloat(dataStats.paid_this_month || 0).toFixed(2),
        workersDue: dataStats.workers_pending || 0,
        pendingWorkers: dataStats.workers_pending || 0 // mapping to requested hint
      };

      setWeeks(Array.isArray(dataWeeks) ? dataWeeks : []);
      setStats(mappedStats);
    } catch (e) { console.error('Error fetching data'); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchWeeksAndStats();
  }, [fetchWeeksAndStats]);

  // Load detailed payroll whenever a week is selected
  useEffect(() => {
    if (!selectedWeekObj) {
      setSelectedPayroll(null);
      return;
    }

    // If it has a payroll_id, fetch deeply. Else, ungenerated.
    if (selectedWeekObj.payroll_id) {
      setLoadingDetail(true);
      api.get(`/payroll/${selectedWeekObj.payroll_id}`)
        .then(res => {
          setSelectedPayroll(res.data?.data || res.data);
        })
        .catch(err => {
          setSelectedPayroll(null);
        })
        .finally(() => setLoadingDetail(false));
    } else {
      // Keep week structure but no detailed payroll records
      setSelectedPayroll(null);
    }
  }, [selectedWeekObj?.id, selectedWeekObj?.payroll_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectWeek = (keyId, wObj) => {
    setSelectedId(keyId);
    setSelectedWeekObj(wObj);
  };

  const handleExport = () => {
    showToast('info', 'Funcionalidad de exportación no implementada en este layout');
  };

  const handleGlobalGenerate = () => {
    if (!weeks || weeks.length === 0) return;
    const firstUngenerated = weeks.find(w => !w.payroll_id);
    if (!firstUngenerated) {
      showToast('info', 'Todas las semanas visibles ya tienen nómina generada.');
      return;
    }
    handleSelectWeek(firstUngenerated.week_start_date, firstUngenerated);
  };

  const refreshSelectedPayroll = useCallback(() => {
    if (selectedWeekObj?.payroll_id) {
      setLoadingDetail(true);
      api.get(`/payroll/${selectedWeekObj.payroll_id}`)
        .then(res => setSelectedPayroll(res.data?.data || res.data))
        .catch(() => { })
        .finally(() => setLoadingDetail(false));
    }
  }, [selectedWeekObj?.payroll_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called from within PayrollDetail to refresh page state without Full Refetch logic breaks
  const handleActionComplete = (actionType, updatedData) => {
    if (actionType === 'generate' || actionType === 'approve') {
      // Deep refresh lists and select the updated payroll
      fetchWeeksAndStats().then(() => {
        const fakeKey = updatedData.id || updatedData.week_start_date;
        setSelectedId(fakeKey);
        setSelectedWeekObj({ ...updatedData, payroll_id: updatedData.id });
      });
    } else if (actionType === 'line_paid') {
      // Only patch the local detailed payroll
      setSelectedPayroll(prev => {
        if (!prev) return prev;
        const updatedLines = prev.lines.map(l => l.id === updatedData.id ? updatedData : l);

        const allPaid = updatedLines.every(x => x.status === 'paid');
        const somePaid = updatedLines.some(x => x.status === 'paid');
        const newStatus = allPaid ? 'paid' : somePaid ? 'partial' : prev.status;

        return { ...prev, lines: updatedLines, status: newStatus };
      });
      // Silently update stats so headers catch up
      fetchWeeksAndStats();
    }
  };

  return (
    <div className="payroll-page fade-in">
      {/* SECTION: Page Header */}
      <div className="payroll-header">
        <div>
          <h1>Nómina</h1>
          <p>Gestión de pagos semanales a workers</p>
        </div>
        <div className="payroll-header-actions">
          <button className="btn-outline" onClick={handleExport}>Exportar</button>
          <button className="btn-primary" onClick={handleGlobalGenerate}>+ Generar nómina</button>
        </div>
      </div>

      {/* SECTION: Metrics */}
      <div className="payroll-metrics">
        <MetricCard color="red" label="Pendiente de pago" value={`$${stats.pending}`} hint={`${stats.pendingWorkers} workers sin pagar`} />
        <MetricCard color="green" label="Pagado esta semana" value={`$${stats.paidWeek}`} hint="pagos realizados" />
        <MetricCard color="blue" label="Pagado este mes" value={`$${stats.paidMonth}`} hint="acumulado del mes" />
        <MetricCard color="amber" label="Workers por pagar" value={stats.workersDue} hint="semana seleccionada" />
      </div>

      {/* SECTION: Body Grid */}
      <div className="payroll-body">
        <WeekSidebar
          weeks={weeks}
          selected={selectedId}
          onSelect={handleSelectWeek}
        />
        <PayrollDetail
          payroll={selectedPayroll}
          weekObj={selectedWeekObj}
          api={api}
          onActionComplete={handleActionComplete}
          onRefreshPayroll={refreshSelectedPayroll}
          showToast={showToast}
          loadingDetail={loadingDetail}
        />
      </div>

      {toast && (
        <div className={`payroll-toast payroll-toast--${toast.type}`}>
          <span className="payroll-toast__icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✕'}
            {toast.type === 'warning' && '!'}
            {toast.type === 'info' && 'i'}
          </span>
          <span className="payroll-toast__message">{toast.message}</span>
          <button className="payroll-toast__close" onClick={() => setToast(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
