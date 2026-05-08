import './Skeleton.css';

const Skeleton = ({ variant = 'text', width, height, count = 1, className = '' }) => {
    const items = Array.from({ length: count }, (_, i) => i);

    if (variant === 'card') {
        return (
            <div className={`sk sk--card ${className}`} style={{ width, height }}>
                <div className="sk__block sk__block--img" />
                <div className="sk__body">
                    <div className="sk__line sk__line--title" />
                    <div className="sk__line sk__line--text" />
                    <div className="sk__line sk__line--text-short" />
                </div>
            </div>
        );
    }

    if (variant === 'circle') {
        return (
            <div
                className={`sk sk--circle ${className}`}
                style={{ width: width || 40, height: height || 40 }}
            />
        );
    }

    if (variant === 'chart') {
        return (
            <div className={`sk sk--chart ${className}`} style={{ width, height: height || 200 }}>
                <div className="sk__bar-group">
                    <div className="sk__bar" style={{ height: '60%' }} />
                    <div className="sk__bar" style={{ height: '80%' }} />
                    <div className="sk__bar" style={{ height: '45%' }} />
                    <div className="sk__bar" style={{ height: '90%' }} />
                    <div className="sk__bar" style={{ height: '55%' }} />
                    <div className="sk__bar" style={{ height: '70%' }} />
                    <div className="sk__bar" style={{ height: '40%' }} />
                </div>
            </div>
        );
    }

    if (variant === 'table-row') {
        return (
            <div className={`sk sk--table-row ${className}`}>
                {items.map(i => (
                    <div key={i} className="sk__row">
                        <div className="sk__cell sk__cell--sm" />
                        <div className="sk__cell sk__cell--lg" />
                        <div className="sk__cell sk__cell--md" />
                        <div className="sk__cell sk__cell--sm" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className={`sk sk--text ${className}`}>
            {items.map(i => (
                <div
                    key={i}
                    className="sk__line"
                    style={{
                        width: width || (i % 2 === 0 ? '100%' : '75%'),
                        height: height || 14,
                    }}
                />
            ))}
        </div>
    );
};

export default Skeleton;
