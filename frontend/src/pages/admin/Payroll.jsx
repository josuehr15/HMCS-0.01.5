import { useState, useEffect, useCallback } from 'react';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
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

function PayrollDetail({ payroll, weekObj, api, onActionComplete, showToast, loadingDetail }) {
  const [loading, setLoading] = useState(false);

  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ payment_method: 'zelle', payment_reference: '', notes: '' });

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

  const openPayModal = (line) => {
    setPayModal(line);
    setPayForm({ payment_method: 'zelle', payment_reference: '', notes: '' });
  };

  const submitPayModal = async () => {
    if (!payModal) return;
    setLoading(true);
    try {
      const res = await api.patch(`/payroll/lines/${payModal.id}/pay`, payForm);
      onActionComplete('line_paid', res.data?.data || res.data || res);
      showToast('success', 'Pago registrado correctamente.');
      setPayModal(null);
    } catch (e) { 
      const msg = e.response?.data?.message || 'Error al registrar el pago.';
      showToast('error', msg); 
    }
    setLoading(false);
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
  const laborTotal  = payroll.lines.reduce((s, l) => s + parseFloat(l.gross_pay || 0), 0);
  const regularTotal = payroll.lines.reduce((s, l) => s + parseFloat(l.regular_pay || 0), 0);
  const otTotal     = payroll.lines.reduce((s, l) => s + parseFloat(l.overtime_pay || 0), 0);
  const pdTotal     = payroll.lines.reduce((s, l) => s + parseFloat(l.per_diem_amount || 0), 0);
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
            <div key={line.id} className="worker-row" style={{ gridTemplateColumns: 'minmax(180px, 1fr) 70px 70px 70px 80px 80px 90px 140px' }}>
              <div className="worker-info">
                <div className="worker-avatar">{initials}</div>
                <div>
                  <div className="worker-name" title={`${worker.first_name} ${worker.last_name}`}>
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
                  <>
                    <button className="btn-paid-done" disabled>Pagado ✓</button>
                    <a href={`/admin/payroll/voucher/${line.id}`} target="_blank" className="btn-voucher" title="Descargar Voucher">🖨️</a>
                  </>
                ) : (
                  <button className="btn-pay" onClick={() => openPayModal(line)}>
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

      {payModal && (
        <div className="payroll-modal-backdrop">
          <div className="payroll-modal fade-in-up">
            <h3>Registrar Pago</h3>
            <p className="pm-worker"><strong>{payModal.worker?.first_name} {payModal.worker?.last_name}</strong></p>
            <div className="pm-amount">
              Total a transferir: <span className="green">${parseFloat(payModal.total_to_transfer).toFixed(2)}</span>
            </div>
            
            <div className="pm-form">
              <div className="pm-field">
                <label>Método de Pago</label>
                <select value={payForm.payment_method} onChange={e => setPayForm({...payForm, payment_method: e.target.value})}>
                  <option value="zelle">Zelle</option>
                  <option value="cash">Efectivo</option>
                  <option value="check">Cheque bancario</option>
                </select>
              </div>

              {(payForm.payment_method !== 'cash') && (
                <div className="pm-field">
                  <label>Número de Confirmación / Cheque</label>
                  <input type="text" value={payForm.payment_reference} onChange={e => setPayForm({...payForm, payment_reference: e.target.value})} placeholder="Opcional..." />
                </div>
              )}

              <div className="pm-field">
                <label>Notas adicionals (Internas)</label>
                <input type="text" value={payForm.notes} onChange={e => setPayForm({...payForm, notes: e.target.value})} placeholder="Opcional..." />
              </div>
            </div>

            <div className="pm-actions">
               <button className="btn-outline" onClick={() => setPayModal(null)} disabled={loading}>Cancelar</button>
               <button className="btn-generate" onClick={submitPayModal} disabled={loading}>{loading ? 'Guardando...' : 'Confirmar Pago'}</button>
            </div>
          </div>
        </div>
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
  }, [api]);

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
  }, [selectedWeekObj?.id, selectedWeekObj?.payroll_id, api]);

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
        <MetricCard color="red"   label="Pendiente de pago"  value={`$${stats.pending}`}  hint={`${stats.pendingWorkers} workers sin pagar`} />
        <MetricCard color="green" label="Pagado esta semana" value={`$${stats.paidWeek}`} hint="pagos realizados" />
        <MetricCard color="blue"  label="Pagado este mes"    value={`$${stats.paidMonth}`} hint="acumulado del mes" />
        <MetricCard color="amber" label="Workers por pagar"  value={stats.workersDue}     hint="semana seleccionada" />
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
          showToast={showToast}
          loadingDetail={loadingDetail}
        />
      </div>

      {toast && (
        <div className={`payroll-toast payroll-toast--${toast.type}`}>
          <span className="payroll-toast__icon">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error'   && '✕'}
            {toast.type === 'warning' && '!'}
            {toast.type === 'info'    && 'i'}
          </span>
          <span className="payroll-toast__message">{toast.message}</span>
          <button className="payroll-toast__close" onClick={() => setToast(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
