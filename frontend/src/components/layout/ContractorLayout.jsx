import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Clock, FileText, DollarSign, User, LogOut, Sun, Moon, Wallet } from 'lucide-react';
import './ContractorLayout.css';

const ContractorLayout = () => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

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
                <NavLink to="/contractor/profile" className={({ isActive }) => `contractor-nav-item ${isActive ? 'contractor-nav-item--active' : ''}`}>
                    <User size={20} />
                    <span>Perfil</span>
                </NavLink>
            </nav>
        </div>
    );
};

export default ContractorLayout;
