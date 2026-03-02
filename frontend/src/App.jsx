import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AdminLayout from './components/layout/AdminLayout';
import ContractorLayout from './components/layout/ContractorLayout';
import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import ClockPage from './pages/contractor/ClockPage';
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
                <Route path="workers" element={<div className="fade-in"><h2>Trabajadores</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div>} />
                <Route path="clients" element={<div className="fade-in"><h2>Clientes</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div>} />
                <Route path="projects" element={<div className="fade-in"><h2>Proyectos</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div>} />
                <Route path="assignments" element={<div className="fade-in"><h2>Asignaciones</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div>} />
                <Route path="time-entries" element={<div className="fade-in"><h2>Registro de Horas</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div>} />
                <Route path="invoices" element={<div className="fade-in"><h2>Facturas</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div>} />
                <Route path="payroll" element={<div className="fade-in"><h2>Nómina</h2><p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Próximamente...</p></div>} />
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
