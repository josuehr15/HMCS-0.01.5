const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TimeEntry = sequelize.define('TimeEntry', {
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
    project_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
    },
    assignment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'assignments', key: 'id' },
    },
    clock_in: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    clock_out: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    clock_in_latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
    },
    clock_in_longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
    },
    clock_out_latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
    },
    clock_out_longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
    },
    total_hours: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'flagged', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
    },
    is_manual_entry: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    manual_entry_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
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
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    edited_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    tableName: 'time_entries',
    underscored: true,
    timestamps: true,
});

module.exports = TimeEntry;
