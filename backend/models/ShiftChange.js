const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * ShiftChange — Solicitud de cambio de turno entre contractors.
 *
 * Flujo:
 *   1. Contractor A (requester) solicita cambiar su turno con Contractor B (target).
 *   2. Contractor B acepta o rechaza.
 *   3. Admin aprueba o rechaza la solicitud aceptada.
 *
 * Status transitions:
 *   pending_target → accepted_target | rejected_target
 *   accepted_target → approved_admin | rejected_admin
 */
const ShiftChange = sequelize.define('ShiftChange', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    // Quien solicita el cambio
    requester_worker_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'workers', key: 'id' },
    },

    // Worker con quien quiere cambiar
    target_worker_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'workers', key: 'id' },
    },

    // Time entry del requester que quiere ceder
    requester_entry_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'time_entries', key: 'id' },
    },

    // Time entry del target que recibirá el requester (opcional — puede ser propuesta abierta)
    target_entry_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'time_entries', key: 'id' },
    },

    // Fecha del turno que se quiere cambiar
    shift_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },

    reason: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    status: {
        type: DataTypes.ENUM(
            'pending_target',    // esperando respuesta del target worker
            'accepted_target',   // target aceptó, esperando admin
            'rejected_target',   // target rechazó
            'approved_admin',    // admin aprobó — cambio efectivo
            'rejected_admin',    // admin rechazó
            'cancelled',         // requester canceló
        ),
        allowNull: false,
        defaultValue: 'pending_target',
    },

    // Nota del target al aceptar/rechazar
    target_note: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Nota del admin al aprobar/rechazar
    admin_note: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    // Quién aprobó/rechazó como admin
    reviewed_by_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
    },

    reviewed_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'shift_changes',
    timestamps: true,
    underscored: true,
});

module.exports = ShiftChange;
