import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Sidebar from './Sidebar';
import { Menu, Bell, Search } from 'lucide-react';
import './AdminLayout.css';

const AdminLayout = () => {
    const [collapsed, setCollapsed] = useState(false);
    const { user } = useAuth();

    return (
        <div className="admin-layout">
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

            <div className={`admin-layout__main ${collapsed ? 'admin-layout__main--expanded' : ''}`}>
                <header className="admin-header">
                    <button className="admin-header__menu-btn" onClick={() => setCollapsed(!collapsed)}>
                        <Menu size={20} />
                    </button>

                    <div className="admin-header__search">
                        <Search size={16} />
                        <input type="text" placeholder="Buscar..." className="admin-header__search-input" />
                    </div>

                    <div className="admin-header__actions">
                        <button className="admin-header__icon-btn">
                            <Bell size={20} />
                        </button>
                        <div className="admin-header__avatar">
                            {user?.email?.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                <main className="admin-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
