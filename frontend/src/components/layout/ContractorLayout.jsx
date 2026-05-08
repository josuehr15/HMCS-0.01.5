import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Clock, FileText, User, LogOut, Sun, Moon, Wallet, LayoutDashboard, ArrowLeftRight, CalendarCheck } from 'lucide-react';
import api from '../../utils/api';
import './ContractorLayout.css';

// ─── Hook: badge de turnos pendientes ────────────────────────────────────────
const useShiftBadge = () => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const fetch = async () => {
            try {
                const res = await api.get('/shift-changes/pending-count');
                if (!cancelled) setCount(res.data?.data?.count ?? 0);
            } catch { /* silencioso */ }
        };
        fetch();
        const timer = setInterval(fetch, 60_000); // cada 60s
        return () => { cancelled = true; clearInterval(timer); };
    }, []);

    return count;
};

const ContractorLayout = () => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const shiftPending = useShiftBadge();

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <div className="contractor-layout">
            <header className="contractor-header">
                <div className="contractor-header__left">
                    <div className="contractor-header__avatar">
                        {user?.email?.charAt(0).toUpperCase()}
                    </div>
                    <span className="contractor-header__name">HMCS</span>
                </div>
                <div className="contractor-header__actions">
                    <button className="contractor-header__btn" onClick={toggleTheme}>
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <button className="contractor-header__btn" onClick={handleLogout}>
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            <main className="contractor-content">
                <Outlet />
            </main>

            <nav className="contractor-bottom-nav">
                <NavLink to="/contractor/dashboard" className={({ isActive }) => `contractor-nav-item ${isActive ? 'contractor-nav-item--active' : ''}`}>
                    <LayoutDashboard size={20} />
                    <span>Inicio</span>
                </NavLink>
                <NavLink to="/contractor/clock" className={({ isActive }) => `contractor-nav-item ${isActive ? 'contractor-nav-item--active' : ''}`}>
                    <Clock size={20} />
                    <span>Reloj</span>
                </NavLink>
                <NavLink to="/contractor/hours" className={({ isActive }) => `contractor-nav-item ${isActive ? 'contractor-nav-item--active' : ''}`}>
                    <FileText size={20} />
                    <span>Mis Horas</span>
                </NavLink>
                <NavLink to="/contractor/payments" className={({ isActive }) => `contractor-nav-item ${isActive ? 'contractor-nav-item--active' : ''}`}>
                    <Wallet size={20} />
                    <span>Mis Pagos</span>
                </NavLink>
                <NavLink to="/contractor/shift-changes" className={({ isActive }) => `contractor-nav-item ${isActive ? 'contractor-nav-item--active' : ''}`}>
                    <div className="contractor-nav-item__icon-wrap">
                        <ArrowLeftRight size={20} />
                        {shiftPending > 0 && (
                            <span className="contractor-nav-badge">{shiftPending > 9 ? '9+' : shiftPending}</span>
                        )}
                    </div>
                    <span>Turnos</span>
                </NavLink>
                <NavLink to="/contractor/availability" className={({ isActive }) => `contractor-nav-item ${isActive ? 'contractor-nav-item--active' : ''}`}>
                    <CalendarCheck size={20} />
                    <span>Horario</span>
                </NavLink>
                <NavLink to="/contractor/profile" className={({ isActive }) => `contractor-nav-item ${isActive ? 'contractor-nav-item--active' : ''}`}>
                    <User size={20} />
                    <span>Perfil</span>
                </NavLink>
            </nav>
        </div>
    );
};

export default ContractorLayout;
