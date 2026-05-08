/**
 * WorkerAvailability.js
 * Disponibilidad semanal de un worker.
 *
 * Cada fila = un día de la semana para un worker.
 *   day_of_week: 0=Domingo, 1=Lunes, ..., 6=Sábado
 *   start_time / end_time: formato 'HH:MM' (24h)
 *   is_available: false → el worker no está disponible ese día
 *
 * El admin y el contractor pueden leer. Solo el contractor puede editar los suyos.
 * Upsert por (worker_id, day_of_week) — un registro por día.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkerAvailability = sequelize.define('WorkerAvailability', {
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
    day_of_week: {
        type: DataTypes.INTEGER,  // 0 = Domingo … 6 = Sábado
        allowNull: false,
        validate: { min: 0, max: 6 },
    },
    is_available: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    start_time: {
        type: DataTypes.STRING(5),  // 'HH:MM'
        allowNull: true,
        defaultValue: '07:00',
    },
    end_time: {
        type: DataTypes.STRING(5),
        allowNull: true,
        defaultValue: '17:00',
    },
    note: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
}, {
    tableName: 'worker_availability',
    underscored: true,
    timestamps: true,
    indexes: [
        { unique: true, fields: ['worker_id', 'day_of_week'] },
    ],
});

module.exports = WorkerAvailability;
