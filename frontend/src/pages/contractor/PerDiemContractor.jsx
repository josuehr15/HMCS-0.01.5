import { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import useApi from '../../hooks/useApi';
import './PerDiemContractor.css';

const fmtMoney = (n) => `$${parseFloat(n || 0).toFixed(2)}`;

const STATUS = {
  pending: { label: 'Pendiente', cls: 'pdc-badge--pending' },
  paid: { label: 'Pagado', cls: 'pdc-badge--paid' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status || '—', cls: 'pdc-badge--pending' };
  return <span className={`pdc-badge ${s.cls}`}>{s.label}</span>;
}

export default function PerDiemContractor() {
  const api = useApi();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/per-diem/my');
        const data = res?.data || res;
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // fetch only once on mount

  return (
    <div className="pdc-page fade-in">
      <div className="pdc-header">
        <div>
          <h2>Per Diem</h2>
          <p>Registro de viáticos (solo lectura)</p>
        </div>
      </div>

      <div className="pdc-note">
        El per diem es un pago de viáticos de tu cliente — no es parte de tu salario.
      </div>

      {loading ? (
        <div className="pdc-loading">Cargando per diem...</div>
      ) : items.length === 0 ? (
        <div className="pdc-empty">
          <Wallet size={44} />
          <p>No hay per diems registrados aún.</p>
        </div>
      ) : (
        <div className="pdc-list">
          {items.map((pd) => {
            const projectName = pd.assignment?.project?.name || '—';
            const week = `${pd.week_start_date || '—'} – ${pd.week_end_date || '—'}`;
            return (
              <div key={pd.id} className="pdc-card">
                <div className="pdc-card-top">
                  <div>
                    <div className="pdc-project">{projectName}</div>
                    <div className="pdc-week">{week}</div>
                  </div>
                  <StatusBadge status={pd.status} />
                </div>
                <div className="pdc-amount">{fmtMoney(pd.amount)}</div>
                {pd.description && <div className="pdc-desc">{pd.description}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

