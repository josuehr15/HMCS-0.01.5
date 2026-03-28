import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
    LayoutDashboard, Users, Building2, FolderKanban, Clock,
    FileText, DollarSign, LogOut, Sun, Moon, Pin,
    Calculator, BarChart2, Settings,
} from 'lucide-react';
import './Sidebar.css';

const MENU_SECTIONS = [
    {
        label: 'Operaciones',
        items: [
            { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/admin/workers', label: 'Trabajadores', icon: Users },
            { path: '/admin/clients', label: 'Clientes', icon: Building2 },
            { path: '/admin/projects', label: 'Proyectos', icon: FolderKanban },
            { path: '/admin/time-entries', label: 'Registro de Horas', icon: Clock },
            { path: '/admin/invoices', label: 'Facturas', icon: FileText },
            { path: '/admin/payroll', label: 'Nómina', icon: DollarSign },
        ],
    },
    {
        label: 'Finanzas',
        items: [
            { path: '/admin/accounting', label: 'Contabilidad', icon: Calculator },
            { path: '/admin/reports', label: 'Reportes', icon: BarChart2 },
        ],
    },
    {
        label: 'Sistema',
        items: [
            { path: '/admin/settings', label: 'Configuración', icon: Settings },
        ],
    },
];

const Sidebar = ({ pinned, onPinToggle }) => {
    const { logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [hovered, setHovered] = useState(false);
    const timeoutRef = useRef(null);

    const expanded = pinned || hovered;

    const handleMouseEnter = () => {
        clearTimeout(timeoutRef.current);
        setHovered(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setHovered(false), 300);
    };

    useEffect(() => () => clearTimeout(timeoutRef.current), []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside
            className={`sidebar ${expanded ? '' : 'sidebar--collapsed'}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="sidebar__header">
                {expanded && (
                    <button
                        className={`sidebar__pin ${pinned ? 'sidebar__pin--active' : ''}`}
                        onClick={onPinToggle}
                        title={pinned ? 'Desfijar sidebar' : 'Fijar sidebar'}
                    >
                        <Pin size={16} />
                    </button>
                )}
            </div>

            <nav className="sidebar__nav">
                {MENU_SECTIONS.map((section, si) => (
                    <div key={section.label} className="sidebar__section">
                        {/* Section divider — only show when expanded and not the first section */}
                        {expanded && si > 0 && <div className="sidebar__divider" />}
                        {expanded && <p className="sidebar__section-label">{section.label}</p>}
                        {!expanded && si > 0 && <div className="sidebar__divider sidebar__divider--sm" />}

                        {section.items.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                                }
                                title={!expanded ? item.label : undefined}
                            >
                                <item.icon size={20} />
                                {expanded && <span>{item.label}</span>}
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            <div className="sidebar__footer">
                <button className="sidebar__link" onClick={toggleTheme} title={!expanded ? 'Cambiar tema' : undefined}>
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    {expanded && <span>{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</span>}
                </button>
                <button className="sidebar__link sidebar__link--danger" onClick={handleLogout} title={!expanded ? 'Cerrar sesión' : undefined}>
                    <LogOut size={20} />
                    {expanded && <span>Cerrar Sesión</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
