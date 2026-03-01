import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const EarningsChart = ({ data = [] }) => {
    const chartData = data.length > 0 ? data : [
        { day: 'Lun', amount: 0 }, { day: 'Mar', amount: 0 },
        { day: 'Mié', amount: 0 }, { day: 'Jue', amount: 0 },
        { day: 'Vie', amount: 0 }, { day: 'Sáb', amount: 0 },
        { day: 'Dom', amount: 0 },
    ];

    return (
        <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 16, color: 'var(--text)' }}>
                Ingresos de la Semana
            </h3>
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                        contentStyle={{
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: 8, fontSize: 13,
                        }}
                        formatter={(value) => [`$${value}`, 'Ingresos']}
                    />
                    <Bar dataKey="amount" fill="#2A6C95" radius={[6, 6, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default EarningsChart;
