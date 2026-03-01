import { useEffect, useState } from 'react';
import { Users, Clock, DollarSign, FileText } from 'lucide-react';
import StatCard from '../../components/dashboard/StatCard';
import EarningsChart from '../../components/dashboard/EarningsChart';
import useApi from '../../hooks/useApi';
import './Dashboard.css';

const Dashboard = () => {
    const { get } = useApi();
    const [stats, setStats] = useState({ workers: 0, hours: 0, revenue: 0, pendingInvoices: 0 });
    const [workers, setWorkers] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [wRes, iRes, tRes] = await Promise.all([
                    get('/workers'), get('/invoices'), get('/time-entries'),
                ]);
                const activeWorkers = wRes?.data || [];
                const invoices = iRes?.data || [];
                const entries = tRes?.data || [];

                const totalHours = entries.reduce((sum, e) => sum + parseFloat(e.total_hours || 0), 0);
                const revenue = invoices.reduce((sum, i) => sum + parseFloat(i.total || 0), 0);
                const pending = invoices.filter((i) => i.status !== 'paid' && i.status !== 'approved').length;

                setStats({
                    workers: activeWorkers.length,
                    hours: totalHours.toFixed(1),
                    revenue: revenue.toFixed(2),
                    pendingInvoices: pending,
                });
                setWorkers(activeWorkers.slice(0, 6));
            } catch {
                // silently handle — stats stay at 0
            }
        };
        load();
    }, []);

    return (
        <div className="dashboard fade-in">
            <div className="dashboard__header">
                <h1 className="dashboard__title">Dashboard</h1>
                <span className="dashboard__date">
                    {new Date().toLocaleDateString('es-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
            </div>

            <div className="dashboard__stats">
                <StatCard title="Trabajadores Activos" value={stats.workers} change={12} changeType="up" icon={Users} />
                <StatCard title="Horas Esta Semana" value={stats.hours} change={8} changeType="up" icon={Clock} />
                <StatCard title="Ingresos del Mes" value={`$${stats.revenue}`} change={5} changeType="up" icon={DollarSign} />
                <StatCard title="Facturas Pendientes" value={stats.pendingInvoices} changeType="neutral" icon={FileText} />
            </div>

            <div className="dashboard__grid">
                <EarningsChart />

                <div className="card">
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>
                        Trabajadores Activos
                    </h3>
                    <div className="dashboard__workers">
                        {workers.map((w) => (
                            <div key={w.id} className="dashboard__worker">
                                <div className="dashboard__worker-avatar">
                                    {w.first_name?.charAt(0)}{w.last_name?.charAt(0)}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{w.first_name} {w.last_name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.worker_code}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
