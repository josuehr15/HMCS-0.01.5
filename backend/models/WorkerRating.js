const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkerRating = sequelize.define('WorkerRating', {
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
        allowNull: true,
        references: { model: 'projects', key: 'id' },
    },
    rating: {
        type: DataTypes.DECIMAL(2, 1),
        allowNull: false,
        validate: { min: 1, max: 5 },
    },
    comment: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    rated_by: {
        type: DataTypes.STRING(100),
        allowNull: true, // nombre del admin o cliente que calificó
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    tableName: 'worker_ratings',
    underscored: true,
    timestamps: true,
});

module.exports = WorkerRating;
