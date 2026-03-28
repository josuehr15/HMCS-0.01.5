const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InvoiceLine = sequelize.define('InvoiceLine', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    invoice_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'invoices', key: 'id' } },
    worker_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'workers', key: 'id' } },
    trade_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'trades', key: 'id' } },
    description: { type: DataTypes.STRING, allowNull: true },
    regular_hours: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
    overtime_hours: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
    rate: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },  // regular rate
    overtime_rate: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    per_diem_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },  // passthrough
    quantity: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },  // total hours
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },  // labor subtotal (no per_diem)
    line_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },  // amount + per_diem
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    tableName: 'invoice_lines',
    underscored: true,
    timestamps: true,
});

module.exports = InvoiceLine;
