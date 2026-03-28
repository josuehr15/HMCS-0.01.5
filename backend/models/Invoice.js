const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Invoice = sequelize.define('Invoice', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    client_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'clients', key: 'id' } },
    project_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'projects', key: 'id' } },
    invoice_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    invoice_date: { type: DataTypes.DATEONLY, allowNull: false },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    week_start_date: { type: DataTypes.DATEONLY, allowNull: false },
    week_end_date: { type: DataTypes.DATEONLY, allowNull: false },

    subtotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    per_diem_total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    adjustments: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    tax_rate: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },

    status: {
        type: DataTypes.ENUM('draft', 'pending_approval', 'approved', 'sent', 'paid', 'overdue'),
        allowNull: false, defaultValue: 'draft',
    },
    approved_by_user_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
    approved_at: { type: DataTypes.DATE, allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: true },
    paid_at: { type: DataTypes.DATE, allowNull: true },
    payment_method: { type: DataTypes.STRING, allowNull: true },
    payment_reference: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    tableName: 'invoices',
    underscored: true,
    timestamps: true,
});

module.exports = Invoice;
