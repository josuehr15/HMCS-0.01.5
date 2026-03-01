const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payroll = sequelize.define('Payroll', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    week_start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    week_end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'paid'),
        allowNull: false,
        defaultValue: 'pending',
    },
    approved_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
    },
    approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    paid_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    tableName: 'payroll',
    underscored: true,
    timestamps: true,
});

module.exports = Payroll;
