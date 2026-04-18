const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Project = sequelize.define('Project', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    client_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'clients',
            key: 'id',
        },
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
    },
    longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: false,
    },
    gps_radius_meters: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 500,
    },
    lunch_rule: {
        type: DataTypes.ENUM('paid', 'unpaid'),
        allowNull: false,
        defaultValue: 'paid',
    },
    lunch_duration_minutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60,
    },
    work_hours_per_day: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: false,
        defaultValue: 9.00,
    },
    paid_hours_per_day: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: false,
        defaultValue: 10.00,
    },
    status: {
        type: DataTypes.ENUM('active', 'completed', 'on_hold'),
        allowNull: false,
        defaultValue: 'active',
    },
    shift_start_time: {
        type: DataTypes.TIME,
        allowNull: true,
        defaultValue: null,
    },
    shift_end_time: {
        type: DataTypes.TIME,
        allowNull: true,
        defaultValue: null,
    },
    start_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
    },
    end_date: {
        type: DataTypes.DATEONLY,
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
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
}, {
    tableName: 'projects',
    underscored: true,
    timestamps: true,
});

module.exports = Project;
