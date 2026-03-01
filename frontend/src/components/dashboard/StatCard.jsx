import './StatCard.css';

const StatCard = ({ title, value, change, changeType = 'up', icon: Icon }) => {
    return (
        <div className="stat-card card">
            <div className="stat-card__header">
                <div className="stat-card__info">
                    <span className="stat-card__title">{title}</span>
                    <span className="stat-card__value">{value}</span>
                </div>
                {Icon && (
                    <div className={`stat-card__icon stat-card__icon--${changeType}`}>
                        <Icon size={22} />
                    </div>
                )}
            </div>
            {change !== undefined && (
                <div className={`stat-card__change stat-card__change--${changeType}`}>
                    {changeType === 'up' ? '↑' : '↓'} {change}%
                </div>
            )}
        </div>
    );
};

export default StatCard;
