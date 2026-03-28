import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import { Bell, Search } from 'lucide-react';
import './AdminLayout.css';

const AdminLayout = () => {
    const [pinned, setPinned] = useState(false);
    const { user } = useAuth();

    return (
        <div className="admin-layout">
            {/* ── Global Header (full width, above sidebar) ── */}
            <header className="admin-header">

                {/* LEFT — Logo */}
                <div className="admin-header__brand">
                    <img
                        src="/imagen/logo_cuadrado.jpg"
                        alt="HMCS"
                        className="admin-header__logo"
                    />
                </div>

                {/* CENTER — Search */}
                <div className="admin-header__search-wrap">
                    <div className="admin-header__search">
                        <Search size={15} className="admin-header__search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar trabajadores, proyectos, facturas..."
                            className="admin-header__search-input"
                        />
                        <span className="admin-header__search-kbd">⌘K</span>
                    </div>
                </div>

                {/* RIGHT — Actions */}
                <div className="admin-header__actions">

                    {/* Notifications */}
                    <button className="admin-header__icon-btn" title="Notificaciones">
                        <Bell size={18} />
                        <span className="admin-header__badge">3</span>
                    </button>

                    {/* Divider */}
                    <div className="admin-header__divider" />

                    {/* User info + Avatar */}
                    <div className="admin-header__user">
                        <div className="admin-header__user-info">
                            <span className="admin-header__user-name">
                                {user?.email?.split('@')[0] || 'Admin'}
                            </span>
                            <span className="admin-header__user-role">Administrador</span>
                        </div>
                        <div className="admin-header__avatar">
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </div>
                    </div>

                </div>
            </header>

            {/* ── Body: Sidebar + Content ── */}
            <div className="admin-body">
                <Sidebar pinned={pinned} onPinToggle={() => setPinned(!pinned)} />

                <main className={`admin-content ${!pinned ? 'admin-content--expanded' : ''}`}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
