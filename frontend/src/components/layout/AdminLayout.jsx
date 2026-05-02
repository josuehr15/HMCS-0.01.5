import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import api from '../../utils/api';
import {
    Bell, Search, X,
    AlertCircle, Clock, FileText, CheckCircle2,
    DollarSign, Tag, RefreshCw,
} from 'lucide-react';
import './AdminLayout.css';

// ─── Icono por tipo de notificación ────────────────────────────────────────
const NotifIcon = ({ type, size = 15 }) => {
    const icons = {
        overdue:    <AlertCircle size={size} />,
        payroll:    <Clock size={size} />,
        perdiem:    <DollarSign size={size} />,
        accounting: <Tag size={size} />,
        clockin:    <CheckCircle2 size={size} />,
        invoice:    <FileText size={size} />,
    };
    return icons[type] || <Bell size={size} />;
};

// ─── Intervalo de polling (ms) ──────────────────────────────────────────────
const POLL_INTERVAL = 60_000; // 1 minuto

const AdminLayout = () => {
    const [pinned, setPinned]                 = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications]   = useState([]);
    const [loading, setLoading]               = useState(false);
    const [dismissed, setDismissed]           = useState(() => {
        // IDs descartados se guardan en sessionStorage (se limpian al cerrar pestaña)
        try {
            return JSON.parse(sessionStorage.getItem('hmcs_notif_dismissed') || '[]');
        } catch { return []; }
    });

    const { user } = useAuth();
    const navigate = useNavigate();
    const panelRef = useRef(null);

    // ── Fetch desde la API ────────────────────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/notifications');
            if (res.data?.success) {
                setNotifications(res.data.data || []);
            }
        } catch {
            // silencioso — la campana no debe interrumpir la app
        } finally {
            setLoading(false);
        }
    }, []);

    // Carga inicial + polling cada minuto
    useEffect(() => {
        fetchNotifications();
        const timer = setInterval(fetchNotifications, POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchNotifications]);

    // Cierra el panel al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
        };
        if (showNotifications) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showNotifications]);

    // ── Notificaciones visibles (sin las descartadas) ─────────────────────
    const visible = notifications.filter(n => !dismissed.includes(n.id));
    const unreadCount = visible.length;

    // ── Descartar una notificación ────────────────────────────────────────
    const dismiss = (id, e) => {
        e.stopPropagation();
        const next = [...dismissed, id];
        setDismissed(next);
        try { sessionStorage.setItem('hmcs_notif_dismissed', JSON.stringify(next)); } catch {}
    };

    // ── Marcar todas como leídas ──────────────────────────────────────────
    const dismissAll = () => {
        const allIds = notifications.map(n => n.id);
        setDismissed(allIds);
        try { sessionStorage.setItem('hmcs_notif_dismissed', JSON.stringify(allIds)); } catch {}
        setShowNotifications(false);
    };

    // ── Navegar a la ruta de la notificación ──────────────────────────────
    const handleNotifClick = (notif) => {
        navigate(notif.route);
        setShowNotifications(false);
    };

    return (
        <div className="admin-layout">
            {/* ── Global Header ─────────────────────────────────────────── */}
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

                    {/* Campana de notificaciones */}
                    <div className="notif-wrapper" ref={panelRef}>
                        <button
                            className={`admin-header__icon-btn ${unreadCount > 0 ? 'admin-header__icon-btn--has-notif' : ''}`}
                            title="Notificaciones"
                            onClick={() => setShowNotifications(prev => !prev)}
                        >
                            <Bell size={18} />
                            {unreadCount > 0 && (
                                <span className="admin-header__badge">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>

                        {/* Panel dropdown */}
                        {showNotifications && (
                            <div className="notif-panel">
                                <div className="notif-panel__header">
                                    <h3 className="notif-panel__title">
                                        Notificaciones
                                        {unreadCount > 0 && (
                                            <span className="notif-panel__count">{unreadCount}</span>
                                        )}
                                    </h3>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <button
                                            className="notif-panel__refresh"
                                            onClick={fetchNotifications}
                                            title="Actualizar"
                                        >
                                            <RefreshCw size={13} className={loading ? 'notif-spinning' : ''} />
                                        </button>
                                        <button
                                            className="notif-panel__close"
                                            onClick={() => setShowNotifications(false)}
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                </div>

                                <div className="notif-panel__list">
                                    {loading && visible.length === 0 ? (
                                        <div className="notif-empty">
                                            <RefreshCw size={20} className="notif-spinning" style={{ color: 'var(--text-muted)' }} />
                                            <p>Cargando...</p>
                                        </div>
                                    ) : visible.length === 0 ? (
                                        <div className="notif-empty">
                                            <CheckCircle2 size={28} style={{ color: '#10B981' }} />
                                            <p>Todo al día</p>
                                            <span>No hay notificaciones pendientes</span>
                                        </div>
                                    ) : (
                                        visible.map(n => (
                                            <div
                                                key={n.id}
                                                className="notif-item"
                                                onClick={() => handleNotifClick(n)}
                                            >
                                                <div
                                                    className="notif-item__icon"
                                                    style={{ background: `${n.color}18`, color: n.color }}
                                                >
                                                    <NotifIcon type={n.type} size={15} />
                                                </div>
                                                <div className="notif-item__body">
                                                    <div className="notif-item__title">{n.title}</div>
                                                    <div className="notif-item__desc">{n.desc}</div>
                                                    <div className="notif-item__time">{n.time}</div>
                                                </div>
                                                <button
                                                    className="notif-item__dismiss"
                                                    onClick={(e) => dismiss(n.id, e)}
                                                    title="Descartar"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {visible.length > 0 && (
                                    <div className="notif-panel__footer">
                                        <button className="notif-panel__clear" onClick={dismissAll}>
                                            Marcar todas como leídas
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

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

            {/* ── Body: Sidebar + Content ───────────────────────────────── */}
            <div className="admin-body">
                <Sidebar pinned={pinned} onPinToggle={() => setPinned(!pinned)} />
                <main className={`admin-layout__main ${pinned ? 'admin-layout__main--expanded' : ''}`}>
                    <div className="admin-content">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
