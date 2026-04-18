import { Component } from 'react';

/**
 * DEUDA-004: Global React ErrorBoundary.
 * Prevents a single JS error from crashing the entire app.
 * Wraps <AppRoutes> in App.jsx.
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100vh', padding: 24, textAlign: 'center',
                }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
                    <h2 style={{ marginBottom: 8 }}>Algo salió mal</h2>
                    <p style={{ color: 'var(--text-muted)', maxWidth: 400, marginBottom: 24 }}>
                        Ocurrió un error inesperado. Por favor recarga la página.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '10px 24px', backgroundColor: 'var(--primary, #2A6C95)',
                            color: '#fff', border: 'none', borderRadius: 8,
                            cursor: 'pointer', fontSize: 14,
                        }}
                    >
                        Recargar página
                    </button>
                    {import.meta.env.DEV && this.state.error && (
                        <pre style={{
                            marginTop: 24, padding: 16, backgroundColor: '#fee2e2',
                            borderRadius: 8, fontSize: 12, textAlign: 'left',
                            maxWidth: 600, overflow: 'auto', color: '#991b1b',
                        }}>
                            {this.state.error.toString()}
                        </pre>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}
