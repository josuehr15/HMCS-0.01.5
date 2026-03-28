const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PayrollLine = sequelize.define('PayrollLine', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    payroll_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'payroll', key: 'id' } },
    worker_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'workers', key: 'id' } },
    project_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'projects', key: 'id' } },

    regular_hours: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
    overtime_hours: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
    regular_rate: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    overtime_rate: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    regular_pay: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    overtime_pay: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    gross_pay: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },

    // Deducciones almacenadas como JSON y total sumado
    deductions_detail: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    deductions: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    net_pay: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 }, // gross - deductions

    per_diem_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    total_to_transfer: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 }, // net_pay + per_diem

    status: {
        type: DataTypes.ENUM('pending', 'paid'),
        allowNull: false, defaultValue: 'pending',
    },
    paid_at: { type: DataTypes.DATE, allowNull: true },
    payment_method: { type: DataTypes.STRING, allowNull: true }, // zelle, cash, check
    payment_reference: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    tableName: 'payroll_lines',
    underscored: true,
    timestamps: true,
});

module.exports = PayrollLine;
