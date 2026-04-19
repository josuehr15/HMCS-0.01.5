import React from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { useAuth } from './context/AuthContext';
import AdminLayout from './components/layout/AdminLayout';
import ContractorLayout from './components/layout/ContractorLayout';
import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import ClockPage from './pages/contractor/ClockPage';
import Workers from './pages/admin/Workers';
import Clients from './pages/admin/Clients';
import Projects from './pages/admin/Projects';
import Timesheets from './pages/admin/Timesheets';
import Invoices from './pages/admin/Invoices';
import InvoicePrint from './pages/admin/InvoicePrint';
import Payroll from './pages/admin/Payroll';
import VoucherPrint from './pages/admin/VoucherPrint';
import Accounting from './pages/admin/Accounting';
import Reports from './pages/admin/Reports';
import Settings from './pages/admin/Settings';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
    const { isAuthenticated, user, isLoading }: any = useAuth();
    if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>Cargando...</div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        return <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/contractor/clock'} replace />;
    }
    return <>{children}</>;
};

const ProtectedOutlet = ({ allowedRoles }: { allowedRoles?: string[] }) => {
    const { isAuthenticated, user, isLoading }: any = useAuth();
    if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>Cargando...</div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        return <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/contractor/clock'} replace />;
    }
    return <Outlet />;
};

const LoginRoute = () => {
    const { isAuthenticated, user }: any = useAuth();
    return isAuthenticated
        ? <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/contractor/clock'} replace />
        : <Login />;
};

export const router = createBrowserRouter([
    {
        path: "/login",
        element: <LoginRoute />,
    },
    {
        path: "/admin/invoices/:id",
        element: (
            <ProtectedRoute allowedRoles={['admin']}>
                <InvoicePrint />
            </ProtectedRoute>
        ),
    },
    {
        path: "/admin/payroll/voucher/:id",
        element: (
            <ProtectedRoute allowedRoles={['admin']}>
                <VoucherPrint />
            </ProtectedRoute>
        ),
    },
    {
        path: "/admin",
        element: (
            <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
            </ProtectedRoute>
        ),
        children: [
            { index: true, element: <Navigate to="dashboard" replace /> },
            { path: "dashboard", element: <Dashboard /> },
            { path: "workers", element: <Workers /> },
            { path: "clients", element: <Clients /> },
            { path: "projects", element: <Projects /> },
            { path: "time-entries", element: <Timesheets /> },
            { path: "invoices", element: <Invoices /> },
            { path: "payroll", element: <Payroll /> },
            { path: "accounting", element: <Accounting /> },
            { path: "reports", element: <Reports /> },
            { path: "settings", element: <Settings /> },
        ],
    },
    {
        path: "/contractor",
        element: (
            <ProtectedRoute allowedRoles={['contractor']}>
                <ContractorLayout />
            </ProtectedRoute>
        ),
        children: [
            { index: true, element: <Navigate to="clock" replace /> },
            { path: "clock", element: <ClockPage /> },
            { path: "hours", element: <div className="fade-in"><h2>Mis Horas</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div> },
            { path: "per-diem", element: <div className="fade-in"><h2>Per Diem</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div> },
            { path: "profile", element: <div className="fade-in"><h2>Mi Perfil</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div> },
        ],
    },
    {
        path: "*",
        element: <Navigate to="/login" replace />,
    },
]);