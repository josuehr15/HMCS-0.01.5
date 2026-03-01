import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
    LayoutDashboard, Users, Building2, Briefcase, Clock,
    FileText, DollarSign, Settings, LogOut, Sun, Moon,
    ChevronLeft, Menu, FolderKanban, Utensils,
} from 'lucide-react';
import './Sidebar.css';

const adminMenu = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/workers', label: 'Trabajadores', icon: Users },
    { path: '/admin/clients', label: 'Clientes', icon: Building2 },
    { path: '/admin/projects', label: 'Proyectos', icon: FolderKanban },
    { path: '/admin/assignments', label: 'Asignaciones', icon: Briefcase },
    { path: '/admin/time-entries', label: 'Registro de Horas', icon: Clock },
    { path: '/admin/invoices', label: 'Facturas', icon: FileText },
    { path: '/admin/payroll', label: 'Nómina', icon: DollarSign },
    { path: '/admin/per-diem', label: 'Per Diem', icon: Utensils },
];

const Sidebar = ({ collapsed, onToggle }) => {
    const { logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
            <div className="sidebar__header">
                <div className="sidebar__logo">
                    <div className="sidebar__logo-icon">HM</div>
                    {!collapsed && <span className="sidebar__logo-text">HMCS</span>}
                </div>
                <button className="sidebar__toggle" onClick={onToggle}>
                    {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>

            <nav className="sidebar__nav">
                {adminMenu.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                        }
                        title={collapsed ? item.label : undefined}
                    >
                        <item.icon size={20} />
                        {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            <div className="sidebar__footer">
                <button className="sidebar__link" onClick={toggleTheme} title={collapsed ? 'Cambiar tema' : undefined}>
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    {!collapsed && <span>{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</span>}
                </button>
                <button className="sidebar__link sidebar__link--danger" onClick={handleLogout} title={collapsed ? 'Cerrar sesión' : undefined}>
                    <LogOut size={20} />
                    {!collapsed && <span>Cerrar Sesión</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
