import './EmptyState.css';

const EmptyState = ({ icon: Icon, title, description, action, className = '' }) => {
    return (
        <div className={`empty-state ${className}`}>
            {Icon && (
                <div className="empty-state__icon">
                    <Icon size={40} />
                </div>
            )}
            <h3 className="empty-state__title">{title}</h3>
            {description && <p className="empty-state__desc">{description}</p>}
            {action && <div className="empty-state__action">{action}</div>}
        </div>
    );
};

export default EmptyState;
