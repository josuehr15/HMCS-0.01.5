import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import useApi from '../../hooks/useApi';

const METHODS = [
  { id: 'zelle', label: 'Zelle', badgeClass: 'pum-badge-zelle', desc: 'Transfer via Zelle / Wells Fargo' },
  { id: 'cash',  label: 'Cash eWithdrawal', badgeClass: 'pum-badge-cash', desc: 'Wells Fargo cash withdrawal receipt' },
  { id: 'check', label: 'Check', badgeClass: 'pum-badge-check', desc: 'Physical check payment' },
];

const ZELLE_FIELDS  = ['sent_to', 'registered_as', 'from_account', 'confirmation_number', 'paid_at_datetime', 'bank'];
const CASH_FIELDS   = ['bank', 'account', 'branch_number', 'transaction_number', 'paid_at_datetime'];
const CHECK_FIELDS  = ['payable_to', 'check_number', 'bank', 'account', 'paid_at_datetime'];

const FIELD_LABELS = {
  sent_to: 'Sent to',
  registered_as: 'Registered as',
  from_account: 'From account',
  confirmation_number: 'Confirmation #',
  paid_at_datetime: 'Date & Time',
  bank: 'Bank',
  account: 'Account',
  branch_number: 'Branch #',
  transaction_number: 'Transaction #',
  payable_to: 'Payable to',
  check_number: 'Check #',
};

function getFieldsForMethod(method) {
  if (method === 'zelle') return ZELLE_FIELDS;
  if (method === 'cash')  return CASH_FIELDS;
  if (method === 'check') return CHECK_FIELDS;
  return [];
}

export default function PaymentUploadModal({ lineId, onClose, onSuccess }) {
  const api = useApi();
  const fileRef = useRef(null);

  // Steps: 0=method, 1=upload, 2=processing, 3=confirm
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [extracted, setExtracted] = useState({});
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a file first.'); return; }
    setError('');
    setStep(2); // processing

    try {
      const formData = new FormData();
      formData.append('screenshot', file);

      const fetchRes = await fetch(
        `http://localhost:5000/api/payroll/lines/${lineId}/upload-screenshot`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      );

      const json = await fetchRes.json();

      if (!fetchRes.ok) {
        throw new Error(json.message || json.error || `Server error ${fetchRes.status}`);
      }

      // FIX: Handle multiple possible response structures
      // Backend uses successResponse() which wraps in { success, data, message }
      const responseData = json.data ?? json;
      const extractedData = responseData.extracted_data ?? responseData.extractedData ?? {};
      const screenshotPath = responseData.screenshot_url ?? responseData.screenshotUrl ?? '';

      console.log('[PaymentUpload] Full response:', json);
      console.log('[PaymentUpload] extractedData:', extractedData);

      const safeExtracted = typeof extractedData === 'object' && extractedData !== null
        ? extractedData
        : {};

      setExtracted(safeExtracted);
      setScreenshotUrl(screenshotPath);

      const detectedType = safeExtracted.payment_type;
      if (detectedType && detectedType !== 'unknown') {
        setMethod(detectedType);
      }

      setStep(3);
    } catch (err) {
      console.error('[PaymentUpload] Upload error:', err);
      setError(`Error: ${err.message || 'Error desconocido'}`);
      setStep(1);
    }
  };

  const handleFieldChange = (key, val) => {
    setExtracted(prev => ({ ...prev, [key]: val }));
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/payroll/lines/${lineId}/confirm-payment-data`, {
        extracted_data: extracted,
        payment_method: method,
        screenshot_url: screenshotUrl,
      });
      onSuccess?.();
    } catch (err) {
      console.error('Confirm error:', err);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div className="pum-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pum-modal">
        {/* Header */}
        <div className="pum-header">
          <div>
            <div className="pum-title">
              {step === 0 && 'Select Payment Method'}
              {step === 1 && 'Upload Payment Screenshot'}
              {step === 2 && 'Analyzing with AI...'}
              {step === 3 && 'Confirm Payment Data'}
            </div>
            <div className="pum-step-dots">
              {[0,1,2,3].map(s => <span key={s} className={`pum-dot ${step === s ? 'active' : step > s ? 'done' : ''}`} />)}
            </div>
          </div>
          <button className="pum-close" onClick={onClose}>✕</button>
        </div>

        {/* STEP 0 — Method selector */}
        {step === 0 && (
          <div className="pum-body">
            <div className="pum-methods">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  className={`pum-method-card ${method === m.id ? 'selected' : ''}`}
                  onClick={() => setMethod(m.id)}
                >
                  <span className={`pum-badge ${m.badgeClass}`}>{m.label}</span>
                  <span className="pum-method-desc">{m.desc}</span>
                </button>
              ))}
            </div>
            <div className="pum-footer">
              <button className="pum-btn-ghost" onClick={onClose}>Cancel</button>
              <button className="pum-btn-primary" disabled={!method} onClick={() => setStep(1)}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STEP 1 — Upload */}
        {step === 1 && (
          <div className="pum-body">
            <div
              className="pum-dropzone"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="pum-preview" />
              ) : (
                <>
                  <svg width="40" height="40" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  <span className="pum-dz-text">Drag & drop or click to select</span>
                  <span className="pum-dz-sub">JPG or PNG, max 10 MB</span>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
            {file && <div className="pum-filename">📎 {file.name}</div>}
            {error && <div className="pum-error">{error}</div>}
            <div className="pum-footer">
              <button className="pum-btn-ghost" onClick={() => setStep(0)}>← Back</button>
              <button className="pum-btn-primary" disabled={!file} onClick={handleUpload}>
                Analyze with AI →
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — Processing */}
        {step === 2 && (
          <div className="pum-body pum-processing">
            <div className="pum-spinner" />
            <div className="pum-processing-text">Analizando con IA...</div>
            <div className="pum-processing-sub">Claude Vision está extrayendo los datos del comprobante</div>
          </div>
        )}

        {/* STEP 3 — Confirm */}
        {step === 3 && (
          <div className="pum-body">
            <div className="pum-confirm-grid">
              <div className="pum-confirm-fields">
                <div className="pum-confirm-method">
                  <span className={`pum-badge ${method === 'zelle' ? 'pum-badge-zelle' : method === 'cash' ? 'pum-badge-cash' : 'pum-badge-check'}`}>
                    {METHODS.find(m => m.id === method)?.label || method}
                  </span>
                  <span className="pum-confirm-hint">Review and edit if needed</span>
                </div>
                {getFieldsForMethod(method).map(key => (
                  <div key={key} className="pum-field">
                    <label className="pum-field-label">{FIELD_LABELS[key] || key}</label>
                    <input
                      className="pum-field-input"
                      value={extracted[key] || ''}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      placeholder={`Enter ${FIELD_LABELS[key] || key}`}
                    />
                  </div>
                ))}
                {extracted.amount && (
                  <div className="pum-field">
                    <label className="pum-field-label">Amount (AI extracted)</label>
                    <input className="pum-field-input" value={`$${extracted.amount}`} readOnly style={{ color: '#6b7280' }} />
                  </div>
                )}
              </div>
              <div className="pum-confirm-preview">
                {previewUrl && <img src={previewUrl} alt="Receipt" className="pum-confirm-img" />}
              </div>
            </div>
            {error && <div className="pum-error">{error}</div>}
            <div className="pum-footer">
              <button className="pum-btn-ghost" onClick={() => { setStep(1); setExtracted({}); }}>
                ↩ Reintentar
              </button>
              <button className="pum-btn-success" disabled={saving} onClick={handleConfirm}>
                {saving ? 'Saving...' : '✓ Confirmar y Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .pum-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; font-family: 'Inter', sans-serif;
        }
        .pum-modal {
          background: #ffffff; color: #111827; border-radius: 12px;
          width: 700px; max-width: 95vw; max-height: 90vh;
          overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          border: 1px solid #e5e7eb;
        }
        .pum-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 20px 24px 16px; border-bottom: 1px solid #e5e7eb;
        }
        .pum-title { font-size: 16px; font-weight: 600; color: #111827; }
        .pum-step-dots { display: flex; gap: 6px; margin-top: 8px; }
        .pum-dot {
          width: 8px; height: 8px; border-radius: 50%; background: #e5e7eb; transition: all 0.2s;
        }
        .pum-dot.active { background: #08543D; width: 20px; border-radius: 4px; }
        .pum-dot.done { background: #10b981; }
        .pum-close {
          background: none; border: none; color: #9ca3af; cursor: pointer;
          font-size: 18px; padding: 4px 8px; line-height: 1;
        }
        .pum-close:hover { color: #374151; }
        .pum-body { padding: 24px; }
        .pum-methods { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
        .pum-method-card {
          display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
          padding: 14px 16px; border: 1.5px solid #e5e7eb; border-radius: 8px;
          background: #fff; cursor: pointer; text-align: left; color: #111827;
          transition: border-color 0.15s, background 0.15s; width: 100%;
        }
        .pum-method-card:hover { border-color: #9ca3af; background: #f9fafb; }
        .pum-method-card.selected { border-color: #08543D; background: #f0fdf4; }
        .pum-method-desc { font-size: 12px; color: #6b7280; }
        .pum-badge {
          display: inline-flex; align-items: center; padding: 4px 12px;
          border-radius: 20px; font-size: 12px; font-weight: 600;
        }
        .pum-badge-zelle { background: #6D1ED4; color: #fff; }
        .pum-badge-cash  { background: #08543D; color: #fff; }
        .pum-badge-check { background: #2A6C95; color: #fff; }
        .pum-dropzone {
          border: 1.5px dashed #d1d5db; border-radius: 8px; min-height: 200px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 8px; cursor: pointer; transition: border-color 0.15s; padding: 20px;
          margin-bottom: 12px; background: #f9fafb;
        }
        .pum-dropzone:hover { border-color: #08543D; background: #f0fdf4; }
        .pum-dz-text { font-size: 14px; color: #374151; }
        .pum-dz-sub { font-size: 12px; color: #9ca3af; }
        .pum-preview { max-height: 200px; border-radius: 6px; object-fit: contain; }
        .pum-filename { font-size: 12px; color: #6b7280; margin-bottom: 12px; }
        .pum-processing {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; min-height: 220px; gap: 16px;
        }
        .pum-spinner {
          width: 44px; height: 44px; border: 3px solid #e5e7eb;
          border-top-color: #08543D; border-radius: 50%;
          animation: pum-spin 0.8s linear infinite;
        }
        @keyframes pum-spin { to { transform: rotate(360deg); } }
        .pum-processing-text { font-size: 16px; font-weight: 600; color: #111827; }
        .pum-processing-sub { font-size: 13px; color: #6b7280; text-align: center; }
        .pum-confirm-grid { display: grid; grid-template-columns: 1fr 240px; gap: 20px; }
        .pum-confirm-method { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .pum-confirm-hint { font-size: 12px; color: #9ca3af; }
        .pum-field { margin-bottom: 12px; }
        .pum-field-label { display: block; font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
        .pum-field-input {
          width: 100%; padding: 8px 12px; border: 1px solid #e5e7eb;
          border-radius: 6px; background: #fff; color: #111827;
          font-size: 13px; outline: none; font-family: 'Inter', sans-serif;
        }
        .pum-field-input:focus { border-color: #08543D; box-shadow: 0 0 0 2px rgba(8,84,61,0.08); }
        .pum-confirm-preview { display: flex; flex-direction: column; }
        .pum-confirm-img { width: 100%; border-radius: 6px; object-fit: cover; max-height: 320px; border: 1px solid #e5e7eb; }
        .pum-error { color: #dc2626; font-size: 13px; margin-bottom: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 12px; }
        .pum-footer {
          display: flex; justify-content: flex-end; gap: 10px;
          margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;
        }
        .pum-btn-ghost {
          background: none; border: 1px solid #e5e7eb; color: #6b7280;
          border-radius: 6px; padding: 9px 16px; cursor: pointer; font-size: 13px;
          font-family: 'Inter', sans-serif;
        }
        .pum-btn-ghost:hover { border-color: #9ca3af; color: #374151; }
        .pum-btn-primary {
          background: #08543D; color: #fff; border: none;
          border-radius: 6px; padding: 9px 18px; cursor: pointer;
          font-size: 13px; font-weight: 500; font-family: 'Inter', sans-serif;
        }
        .pum-btn-primary:hover:not(:disabled) { background: #065f46; }
        .pum-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .pum-btn-success {
          background: #10b981; color: #fff; border: none;
          border-radius: 6px; padding: 9px 18px; cursor: pointer;
          font-size: 13px; font-weight: 600; font-family: 'Inter', sans-serif;
        }
        .pum-btn-success:hover:not(:disabled) { background: #059669; }
        .pum-btn-success:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}
