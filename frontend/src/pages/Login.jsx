import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Loader } from 'lucide-react';
import './Login.css';

const LS_KEY = 'hmcs_remembered_email';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [remember, setRemember] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const canvasRef = useRef(null);

    // Pre-fill remembered email
    useEffect(() => {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) { setEmail(saved); setRemember(true); }
    }, []);

    // ── Dot-matrix particle canvas — Nexis Compute style ────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let width, height, particles = [], animId;
        let mouse = { x: -9999, y: -9999 };

        const DOT_SPACING = 28;
        const DOT_RADIUS  = 1.2;
        const DOT_COLOR   = 'rgba(42, 108, 149,';  // brand blue

        function resize() {
            width  = canvas.width  = canvas.offsetWidth;
            height = canvas.height = canvas.offsetHeight;
            buildGrid();
        }

        function buildGrid() {
            particles = [];
            const cols = Math.ceil(width  / DOT_SPACING) + 1;
            const rows = Math.ceil(height / DOT_SPACING) + 1;
            for (let c = 0; c < cols; c++) {
                for (let r = 0; r < rows; r++) {
                    particles.push({
                        x: c * DOT_SPACING,
                        y: r * DOT_SPACING,
                        baseAlpha: 0.12 + Math.random() * 0.18,
                        phase: Math.random() * Math.PI * 2,
                        speed: 0.003 + Math.random() * 0.004,
                    });
                }
            }
        }

        function draw(t) {
            ctx.clearRect(0, 0, width, height);
            particles.forEach(p => {
                // Breathing pulse
                const pulse = 0.5 + 0.5 * Math.sin(t * p.speed + p.phase);
                // Pointer proximity brightening
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const proximity = Math.max(0, 1 - dist / 120);
                const alpha = p.baseAlpha * pulse + proximity * 0.35;

                ctx.beginPath();
                ctx.arc(p.x, p.y, DOT_RADIUS + proximity * 1.2, 0, Math.PI * 2);
                ctx.fillStyle = `${DOT_COLOR} ${Math.min(alpha, 0.85)})`;
                ctx.fill();
            });
            animId = requestAnimationFrame(draw);
        }

        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });
        canvas.addEventListener('mouseleave', () => {
            mouse.x = -9999; mouse.y = -9999;
        });

        resize();
        window.addEventListener('resize', resize);
        animId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) { setError('Por favor completa todos los campos.'); return; }
        setLoading(true);
        setError('');
        try {
            if (remember) localStorage.setItem(LS_KEY, email);
            else localStorage.removeItem(LS_KEY);

            const user = await login(email, password);
            if (user.role === 'admin') navigate('/admin/dashboard');
            else if (user.role === 'contractor') navigate('/contractor/clock');
            else if (user.role === 'client') navigate('/client/dashboard');
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

            {/* ════════════════════════════════
                LEFT PANEL — 60% brand panel
                ════════════════════════════════ */}
            <div className="login-left">
                {/* Dot-matrix particle canvas — Nexis Compute style */}
                <canvas ref={canvasRef} className="login-left__canvas" aria-hidden="true" />
                <div className="login-left__inner">
                    {/* Logo */}
                    <img
                        src="/images/logo cuadrado.JPG"
                        alt="HM Construction Staffing LLLP"
                        className="login-left__logo"
                        onError={e => { e.target.style.display = 'none'; }}
                    />

                    {/* Headline */}
                    <h1 className="login-left__headline">
                        <span className="login-left__headline--top">Skilled Technical</span>
                        <span className="login-left__headline--main">Staffing</span>
                    </h1>

                    {/* Tagline */}
                    <div className="login-left__tagline-wrap">
                        <p className="login-left__tagline">
                            Expert personnel for plumbing,<br />electrical, and HVAC services.
                        </p>
                    </div>

                    {/* Service badges */}
                    <div className="login-left__badges">
                        <span className="login-left__badge">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            Electrical
                        </span>
                        <span className="login-left__badge">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 2a5 5 0 0 1 5 5c0 3-5 9-5 9S7 10 7 7a5 5 0 0 1 5-5z" />
                                <circle cx="12" cy="7" r="1.5" />
                            </svg>
                            Plumbing
                        </span>
                        <span className="login-left__badge">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M12 22V12M12 12C12 12 8 8 8 5a4 4 0 0 1 8 0c0 3-4 7-4 7z" />
                                <path d="M8 22h8" />
                            </svg>
                            HVAC
                        </span>
                    </div>
                </div>

                {/* Decorative bottom line */}
                <div className="login-left__line" />
            </div>

            {/* ════════════════════════════════
                RIGHT PANEL — 40% form panel
                ════════════════════════════════ */}
            <div className="login-right">
                <div className="login-form-container">

                    {/* Form header: small logo + company name */}
                    <div className="login-form-header">
                        <img
                            src="/images/logo cuadrado.JPG"
                            alt="HMCS"
                            className="login-form-header__logo"
                            onError={e => { e.target.style.display = 'none'; }}
                        />
                        <div>
                            <div className="login-form-header__company">HM Construction</div>
                            <div className="login-form-header__sub">Staffing LLLP</div>
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="login-title">Bienvenido</h2>
                    <p className="login-subtitle">Inicia sesión para continuar</p>

                    {/* Error banner */}
                    {error && (
                        <div className="login-error">
                            <AlertCircle size={15} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit}>

                        {/* Email */}
                        <div className="login-group">
                            <label htmlFor="l-email">Correo electrónico</label>
                            <div className="login-field">
                                <Mail size={16} className="login-field__icon" />
                                <input
                                    id="l-email"
                                    type="email"
                                    placeholder="admin@hmcs.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="login-group">
                            <label htmlFor="l-pass">Contraseña</label>
                            <div className="login-field">
                                <Lock size={16} className="login-field__icon" />
                                <input
                                    id="l-pass"
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="login-field__toggle"
                                    onClick={() => setShowPass(v => !v)}
                                    tabIndex={-1}
                                >
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Remember + Forgot */}
                        <div className="login-options">
                            <label className="login-check">
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={e => setRemember(e.target.checked)}
                                />
                                Recordarme
                            </label>
                            <a href="#" className="login-forgot">¿Olvidaste tu contraseña?</a>
                        </div>

                        {/* Submit */}
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading
                                ? <><Loader size={18} className="spin-icon" /> Cargando...</>
                                : 'Iniciar Sesión'
                            }
                        </button>
                    </form>

                    {/* Contact admin */}
                    <p className="login-contact">
                        ¿No tienes cuenta?{' '}
                        <a href="#">Contactar Admin</a>
                    </p>

                    {/* Demo quick-access */}
                    <div className="login-demo">
                        <span className="login-demo__label">Demo access:</span>
                        <div className="login-demo__btns">
                            <button
                                type="button"
                                className="login-demo__btn login-demo__btn--admin"
                                onClick={() => { setEmail('admin@hmcs.com'); setPassword('admin123'); setError(''); }}
                            >
                                👤 Admin
                            </button>
                            <button
                                type="button"
                                className="login-demo__btn login-demo__btn--contractor"
                                onClick={() => { setEmail('josue@hmcs.com'); setPassword('contractor123'); setError(''); }}
                            >
                                🦺 Contractor
                            </button>
                            <button
                                type="button"
                                className="login-demo__btn login-demo__btn--client"
                                onClick={() => { setEmail('contact@mockplumbing.com'); setPassword('client123'); setError(''); }}
                            >
                                🏗️ Client
                            </button>
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
};

export default Login;
