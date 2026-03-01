const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PerDiemEntry = sequelize.define('PerDiemEntry', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    worker_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'workers', key: 'id' },
    },
    assignment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'assignments', key: 'id' },
    },
    week_start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    week_end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('pending', 'paid'),
        allowNull: false,
        defaultValue: 'pending',
    },
    paid_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    tableName: 'per_diem_entries',
    underscored: true,
    timestamps: true,
});

module.exports = PerDiemEntry;
