import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { LayoutDashboard, FolderOpen, FileText, Users, LogOut, Sun, Moon, Building2 } from 'lucide-react';
import './ClientLayout.css';

const NAV_ITEMS = [
    { to: '/client/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/client/projects',  label: 'Projects',  icon: FolderOpen },
    { to: '/client/invoices',  label: 'Invoices',  icon: FileText },
    { to: '/client/workers',   label: 'Workers',   icon: Users },
];

const ClientLayout = () => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleLogout = () => { logout(); navigate('/login'); };

    const initials = user?.email?.slice(0, 2).toUpperCase() || 'CL';

    return (
        <div className="client-layout">
            {/* ── Sidebar ─────────────────────────────── */}
            <aside className="client-sidebar">
                {/* Brand */}
                <div className="client-sidebar__brand">
                    <div className="client-sidebar__logo">
                        <Building2 size={22} />
                    </div>
                    <div className="client-sidebar__brand-text">
                        <span className="client-sidebar__brand-name">HMCS</span>
                        <span className="client-sidebar__brand-sub">Client Portal</span>
                    </div>
                </div>

                {/* Nav */}
                <nav className="client-sidebar__nav">
                    {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `client-nav-item ${isActive ? 'client-nav-item--active' : ''}`
                            }
                        >
                            <Icon size={18} />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="client-sidebar__footer">
                    <div className="client-sidebar__user">
                        <div className="client-sidebar__avatar">{initials}</div>
                        <div className="client-sidebar__user-info">
                            <span className="client-sidebar__user-email">{user?.email}</span>
                        </div>
                    </div>
                    <div className="client-sidebar__footer-actions">
                        <button className="client-sidebar__icon-btn" onClick={toggleTheme} title="Toggle theme">
                            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                        </button>
                        <button className="client-sidebar__icon-btn" onClick={handleLogout} title="Sign out">
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Main Content ─────────────────────────── */}
            <main className="client-main">
                <Outlet />
            </main>
        </div>
    );
};

export default ClientLayout;
