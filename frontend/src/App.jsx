import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AdminLayout from './components/layout/AdminLayout';
import ContractorLayout from './components/layout/ContractorLayout';
import ClientLayout from './components/layout/ClientLayout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import ClockPage from './pages/contractor/ClockPage';
import MyPayments from './pages/contractor/MyPayments';
import MyHours from './pages/contractor/MyHours';
import MyProfile from './pages/contractor/MyProfile';
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
import PerDiem from './pages/admin/PerDiem';
import Documents from './pages/admin/Documents';
import PerDiemContractor from './pages/contractor/PerDiemContractor';
import ContractorDashboard from './pages/contractor/ContractorDashboard';
import ShiftChanges from './pages/contractor/ShiftChanges';
import ShiftChangesAdmin from './pages/admin/ShiftChangesAdmin';
import MyAvailability from './pages/contractor/MyAvailability';
import Availability from './pages/admin/Availability';
import Matching from './pages/admin/Matching';
import AssignmentHistory from './pages/admin/AssignmentHistory';
import Performance from './pages/admin/Performance';
import WorkerDetail from './pages/admin/WorkerDetail';
import ClientDashboard from './pages/client/ClientDashboard';
import ClientProjects from './pages/client/ClientProjects';
import ClientInvoices from './pages/client/ClientInvoices';
import ClientWorkers from './pages/client/ClientWorkers';
import './styles/globals.css';
import './styles/modals.css';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { isAuthenticated, user, isLoading } = useAuth();
    if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>Cargando...</div>;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        const fallback = user?.role === 'admin'
            ? '/admin/dashboard'
            : user?.role === 'client'
            ? '/client/dashboard'
            : '/contractor/dashboard';
        return <Navigate to={fallback} replace />;
    }
    return children;
};

const AppRoutes = () => {
    const { isAuthenticated, user } = useAuth();

    return (
        <Routes>
            <Route path="/login" element={
                isAuthenticated
                    ? <Navigate to={
                        user?.role === 'admin' ? '/admin/dashboard'
                        : user?.role === 'client' ? '/client/dashboard'
                        : '/contractor/dashboard'
                    } replace />
                    : <Login />
            } />

            {/* Admin Routes */}
            <Route path="/admin/invoices/:id" element={
                <ProtectedRoute allowedRoles={['admin']}>
                    <InvoicePrint />
                </ProtectedRoute>
            } />
            <Route path="/admin/payroll/voucher/:id" element={
                <ProtectedRoute allowedRoles={['admin']}>
                    <VoucherPrint />
                </ProtectedRoute>
            } />

            <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                    <AdminLayout />
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="workers" element={<Workers />} />
                <Route path="workers/:id" element={<WorkerDetail />} />
                <Route path="clients" element={<Clients />} />
                <Route path="projects" element={<Projects />} />
                <Route path="time-entries" element={<Timesheets />} />
                <Route path="invoices" element={<Invoices />} />
                <Route path="payroll" element={<Payroll />} />
                <Route path="accounting" element={<Accounting />} />
                <Route path="reports" element={<Reports />} />
                <Route path="per-diem" element={<PerDiem />} />
                <Route path="documents" element={<Documents />} />
                <Route path="settings" element={<Settings />} />
                <Route path="shift-changes" element={<ShiftChangesAdmin />} />
                <Route path="availability" element={<Availability />} />
                <Route path="matching" element={<Matching />} />
                <Route path="assignments" element={<AssignmentHistory />} />
                <Route path="performance" element={<Performance />} />
            </Route>

            {/* Contractor Routes */}
            <Route path="/contractor" element={
                <ProtectedRoute allowedRoles={['contractor']}>
                    <ContractorLayout />
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ContractorDashboard />} />
                <Route path="clock" element={<ClockPage />} />
                <Route path="payments" element={<MyPayments />} />
                <Route path="hours" element={<MyHours />} />
                <Route path="per-diem" element={<PerDiemContractor />} />
                <Route path="shift-changes" element={<ShiftChanges />} />
                <Route path="availability" element={<MyAvailability />} />
                <Route path="profile" element={<MyProfile />} />
            </Route>

            {/* Client Routes */}
            <Route path="/client" element={
                <ProtectedRoute allowedRoles={['client']}>
                    <ClientLayout />
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<ClientDashboard />} />
                <Route path="projects" element={<ClientProjects />} />
                <Route path="invoices" element={<ClientInvoices />} />
                <Route path="workers" element={<ClientWorkers />} />
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
                    <ErrorBoundary>
                        <AppRoutes />
                    </ErrorBoundary>
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
};

export default App;
