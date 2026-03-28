import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
import Payroll from './pages/admin/Payroll';
import Accounting from './pages/admin/Accounting';
import Reports from './pages/admin/Reports';
import Settings from './pages/admin/Settings';
import './styles/globals.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { isAuthenticated, user, isLoading } = useAuth();
    if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>Cargando...</div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        return <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/contractor/clock'} replace />;
    }
    return children;
};

const AppRoutes = () => {
    const { isAuthenticated, user } = useAuth();

    return (
        <Routes>
            <Route path="/login" element={
                isAuthenticated
                    ? <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/contractor/clock'} replace />
                    : <Login />
            } />

            {/* Admin Routes */}
            <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                    <AdminLayout />
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="workers" element={<Workers />} />
                <Route path="clients" element={<Clients />} />
                <Route path="projects" element={<Projects />} />
                <Route path="time-entries" element={<Timesheets />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="payroll" element={<Payroll />} />
                <Route path="accounting" element={<Accounting />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
            </Route>

            {/* Contractor Routes */}
            <Route path="/contractor" element={
                <ProtectedRoute allowedRoles={['contractor']}>
                    <ContractorLayout />
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="clock" replace />} />
                <Route path="clock" element={<ClockPage />} />
                <Route path="hours" element={<div className="fade-in"><h2>Mis Horas</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div>} />
                <Route path="per-diem" element={<div className="fade-in"><h2>Per Diem</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div>} />
                <Route path="profile" element={<div className="fade-in"><h2>Mi Perfil</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div>} />
            </Route>

            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
};

const App = () => {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
};

export default App;
