import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import { Bell, Search, Clock, FileText, CheckCircle, X } from 'lucide-react';
import './AdminLayout.css';

const AdminLayout = () => {
    const [pinned, setPinned] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    const notifications = [
        { 
          id: 1, 
          icon: <Clock size={16} />, 
          title: 'Nómina pendiente', 
          desc: 'Hay nómina esperando aprobación',
          time: 'Hace 2h',
          color: '#F59E0B',
          route: '/admin/payroll'
        },
        { 
          id: 2, 
          icon: <FileText size={16} />, 
          title: 'Factura creada', 
          desc: 'Nueva factura por $450',
          time: 'Hace 3h',
          color: '#2A6C95',
          route: '/admin/invoices'
        },
        { 
          id: 3, 
          icon: <CheckCircle size={16} />, 
          title: 'Clock-in registrado', 
          desc: 'Brian N. marcó entrada',
          time: 'Hace 4h',
          color: '#10B981',
          route: '/admin/time-entries'
        },
    ];

    return (
        <div className="admin-layout">
            {/* ── Global Header (full width, above sidebar) ── */}
            <header className="admin-header">

                {/* LEFT — Logo */}
                <div className="admin-header__brand">
                    <div className="admin-header__logo-wrap">
                        <img
                            src="/images/logo cuadrado.JPG"
                            alt="HMCS Logo"
                            className="admin-header__logo"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement
                                    .querySelector('.admin-header__logo-fallback')
                                    .style.display = 'flex';
                            }}
                        />
                        <div className="admin-header__logo-fallback">HM</div>
                    </div>
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

                    </div>
                </div>

                {/* RIGHT — Actions */}
                <div className="admin-header__actions">

                    {/* Notifications */}
                    <button 
                        className="admin-header__icon-btn" 
                        title="Notificaciones"
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <Bell size={18} />
                        <span className="admin-header__badge">{notifications.length}</span>
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

                <main className={`admin-layout__main ${pinned ? 'admin-layout__main--expanded' : ''}`}>
                    {showNotifications && (
                        <div
                            className="notif-overlay"
                            onClick={() => setShowNotifications(false)}
                        >
                            <div
                                className="notif-panel"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="notif-panel__header">
                                    <h3 className="notif-panel__title">Notificaciones</h3>
                                    <button
                                        className="notif-panel__close"
                                        onClick={() => setShowNotifications(false)}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="notif-panel__list">
                                    {notifications.map(n => (
                                        <div
                                            key={n.id}
                                            className="notif-item"
                                            onClick={() => {
                                                navigate(n.route);
                                                setShowNotifications(false);
                                            }}
                                        >
                                            <div
                                                className="notif-item__icon"
                                                style={{
                                                    background: `${n.color}15`,
                                                    color: n.color
                                                }}
                                            >
                                                {n.icon}
                                            </div>
                                            <div className="notif-item__body">
                                                <div className="notif-item__title">{n.title}</div>
                                                <div className="notif-item__desc">{n.desc}</div>
                                                <div className="notif-item__time">{n.time}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="notif-panel__footer">
                                    <button
                                        className="notif-panel__clear"
                                        onClick={() => setShowNotifications(false)}
                                    >
                                        Marcar todas como leídas
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="admin-content">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
