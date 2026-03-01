import { Loader } from 'lucide-react';
import './ClockButton.css';

const ClockButton = ({ type = 'in', loading = false, onClick }) => {
    const isClockIn = type === 'in';

    return (
        <button
            className={`clock-btn ${isClockIn ? 'clock-btn--in' : 'clock-btn--out'} ${loading ? 'clock-btn--loading' : ''}`}
            onClick={onClick}
            disabled={loading}
        >
            <div className="clock-btn__inner">
                {loading ? (
                    <Loader size={32} className="spinner" />
                ) : (
                    <>
                        <span className="clock-btn__text">{isClockIn ? 'ENTRADA' : 'SALIDA'}</span>
                        <span className="clock-btn__sub">{isClockIn ? 'Marcar entrada' : 'Marcar salida'}</span>
                    </>
                )}
            </div>
        </button>
    );
};

export default ClockButton;
