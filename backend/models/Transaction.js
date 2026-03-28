const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false }, // always positive
    type: { type: DataTypes.ENUM('income', 'expense'), allowNull: false },
    category_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'accounting_categories', key: 'id' } },

    // Split support
    is_split: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    parent_transaction_id: { type: DataTypes.INTEGER, allowNull: true }, // self-reference

    // Optional links
    worker_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'workers', key: 'id' } },
    client_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'clients', key: 'id' } },
    invoice_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'invoices', key: 'id' } },
    payroll_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'payroll', key: 'id' } },

    bank_reference: { type: DataTypes.STRING, allowNull: true },
    source: {
        type: DataTypes.ENUM('manual', 'csv_import', 'auto_generated'),
        allowNull: false, defaultValue: 'manual',
    },
    is_reconciled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    tableName: 'transactions',
    underscored: true,
    timestamps: true,
});

module.exports = Transaction;
