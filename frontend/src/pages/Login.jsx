import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader } from 'lucide-react';
import './Login.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) { setError('Por favor completa todos los campos.'); return; }

        setLoading(true);
        setError('');
        try {
            const user = await login(email, password);
            if (user.role === 'admin') navigate('/admin/dashboard');
            else if (user.role === 'contractor') navigate('/contractor/clock');
            else navigate('/');
        } catch (err) {
            const msg = err.response?.data?.message || 'Error de conexión';
            if (msg.includes('inactive') || msg.includes('suspended')) {
                setError('Tu acceso está suspendido. Contacta al administrador.');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card fade-in">
                <div className="login-brand">
                    <div className="login-brand__icon">HM</div>
                    <h1 className="login-brand__title">HM Construction Staffing</h1>
                    <p className="login-brand__subtitle">Sistema de Gestión de Personal</p>
                </div>

                {error && (
                    <div className="login-error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="login-field">
                        <Mail size={18} className="login-field__icon" />
                        <input
                            type="email" placeholder="Correo electrónico"
                            value={email} onChange={(e) => setEmail(e.target.value)}
                            className="login-field__input" autoComplete="email"
                        />
                    </div>

                    <div className="login-field">
                        <Lock size={18} className="login-field__icon" />
                        <input
                            type={showPass ? 'text' : 'password'} placeholder="Contraseña"
                            value={password} onChange={(e) => setPassword(e.target.value)}
                            className="login-field__input" autoComplete="current-password"
                        />
                        <button type="button" className="login-field__toggle" onClick={() => setShowPass(!showPass)}>
                            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <button type="submit" className="login-submit" disabled={loading}>
                        {loading ? <Loader size={20} className="spinner" /> : 'Iniciar Sesión'}
                    </button>
                </form>

                <div className="login-hint">
                    <p>Demo: admin@hmcs.com / admin123</p>
                </div>
            </div>
        </div>
    );
};

export default Login;
