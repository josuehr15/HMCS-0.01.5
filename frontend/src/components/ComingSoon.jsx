/**
 * BASURA-002: Proper placeholder for routes not yet implemented.
 * Replaces inline <div> JSX in App.jsx route definitions.
 */
export default function ComingSoon({ title, description }) {
    return (
        <div className="fade-in" style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
            <h2 style={{ marginBottom: 8 }}>{title}</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto' }}>
                {description || 'Esta sección estará disponible próximamente.'}
            </p>
        </div>
    );
}
