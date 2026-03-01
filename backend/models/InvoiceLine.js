const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InvoiceLine = sequelize.define('InvoiceLine', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    invoice_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'invoices', key: 'id' },
    },
    worker_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'workers', key: 'id' },
    },
    trade_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'trades', key: 'id' },
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    quantity: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
    },
    rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    regular_hours: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
    },
    overtime_hours: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: false,
        defaultValue: 0,
    },
    overtime_rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    tableName: 'invoice_lines',
    underscored: true,
    timestamps: true,
});

module.exports = InvoiceLine;
