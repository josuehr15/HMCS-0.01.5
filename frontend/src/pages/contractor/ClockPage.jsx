import { useState, useEffect } from 'react';
import ClockButton from '../../components/contractor/ClockButton';
import useApi from '../../hooks/useApi';
import { MapPin, CheckCircle, XCircle, Clock } from 'lucide-react';
import './ClockPage.css';

const ClockPage = () => {
    const { get, post } = useApi();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [openEntry, setOpenEntry] = useState(null);
    const [recentEntries, setRecentEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    // Update clock every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Load data
    useEffect(() => { loadEntries(); }, []);

    const loadEntries = async () => {
        try {
            const res = await get('/time-entries/my');
            const entries = res?.data || [];
            setRecentEntries(entries.slice(0, 5));
            const open = entries.find((e) => !e.clock_out);
            setOpenEntry(open || null);
        } catch {
            // no entries yet
        }
    };

    const getGPS = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('GPS no disponible en este navegador.'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                (err) => reject(new Error('No se pudo obtener tu ubicación. Activa el GPS.')),
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    };

    const handleClockIn = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const gps = await getGPS();
            // Use first project (from assignment) — in production, user selects project
            await post('/time-entries/clock-in', {
                project_id: 1,
                latitude: gps.latitude,
                longitude: gps.longitude,
            });
            setMessage({ type: 'success', text: '✅ Entrada registrada correctamente.' });
            await loadEntries();
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Error al marcar entrada.';
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    const handleClockOut = async () => {
        if (!openEntry) return;
        setLoading(true);
        setMessage(null);
        try {
            const gps = await getGPS();
            await post('/time-entries/clock-out', {
                time_entry_id: openEntry.id,
                latitude: gps.latitude,
                longitude: gps.longitude,
            });
            setMessage({ type: 'success', text: '✅ Salida registrada correctamente.' });
            await loadEntries();
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Error al marcar salida.';
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    const todayHours = recentEntries
        .filter((e) => e.total_hours && new Date(e.clock_in).toDateString() === new Date().toDateString())
        .reduce((sum, e) => sum + parseFloat(e.total_hours), 0);

    const formatTime = (date) => date.toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    return (
        <div className="clock-page fade-in">
            <div className="clock-page__time-display">
                <div className="clock-page__time">{formatTime(currentTime)}</div>
                <div className="clock-page__date">
                    {currentTime.toLocaleDateString('es-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div className="clock-page__status">
                {openEntry ? (
                    <div className="clock-page__status-badge clock-page__status-badge--active">
                        <Clock size={14} />
                        Trabajando desde {new Date(openEntry.clock_in).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </div>
                ) : (
                    <div className="clock-page__status-badge">Sin marcar</div>
                )}
            </div>

            <div className="clock-page__button-area">
                <ClockButton
                    type={openEntry ? 'out' : 'in'}
                    loading={loading}
                    onClick={openEntry ? handleClockOut : handleClockIn}
                />
            </div>

            {message && (
                <div className={`clock-page__message clock-page__message--${message.type}`}>
                    {message.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    <span>{message.text}</span>
                </div>
            )}

            <div className="clock-page__today card">
                <div className="clock-page__today-header">
                    <span>Horas Hoy</span>
                    <span className="clock-page__today-value">{todayHours.toFixed(1)}h</span>
                </div>
            </div>

            <div className="clock-page__history card">
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12 }}>Registros Recientes</h3>
                {recentEntries.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin registros aún.</p>
                ) : (
                    recentEntries.map((e) => (
                        <div key={e.id} className="clock-page__entry">
                            <div className="clock-page__entry-time">
                                <MapPin size={12} />
                                {new Date(e.clock_in).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                {e.clock_out && ` → ${new Date(e.clock_out).toLocaleTimeString('es-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`}
                            </div>
                            <span className="clock-page__entry-hours">
                                {e.total_hours ? `${e.total_hours}h` : 'Abierto'}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ClockPage;
