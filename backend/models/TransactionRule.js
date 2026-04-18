const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TransactionRule = sequelize.define('TransactionRule', {
    id:           { type: DataTypes.INTEGER,               primaryKey: true, autoIncrement: true },
    name:         { type: DataTypes.STRING(100),           allowNull: false },
    keywords:     { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false },
    record_type:  { type: DataTypes.ENUM('any', 'income', 'expense'), allowNull: false, defaultValue: 'any' },
    category_id:  { type: DataTypes.INTEGER, allowNull: true, references: { model: 'accounting_categories', key: 'id' } },
    worker_id:    { type: DataTypes.INTEGER, allowNull: true, references: { model: 'workers', key: 'id' } },
    apply_to_existing: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    times_applied:     { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    last_applied_at:   { type: DataTypes.DATE,    allowNull: true },
    is_active:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by_user_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
}, {
    tableName: 'transaction_rules',
    underscored: true,
    timestamps: true,
});

// Auto-migrate: create table if it doesn't exist
const ensureTable = async () => {
    try {
        await TransactionRule.sync({ alter: false });
    } catch (_) {
        // table may already exist — ignore
    }
};
ensureTable();

module.exports = TransactionRule;
