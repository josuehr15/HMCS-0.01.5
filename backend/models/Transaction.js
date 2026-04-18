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

    // Import tracking
    import_batch_id:   { type: DataTypes.STRING(50),  allowNull: true },
    import_source:     { type: DataTypes.STRING(50),  allowNull: true },
    is_imported:       { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: false },
    original_filename: { type: DataTypes.STRING(255), allowNull: true },
}, {
    tableName: 'transactions',
    underscored: true,
    timestamps: true,
});

module.exports = Transaction;

// Auto-add original_filename column if missing
(async () => {
    try {
        const qi = sequelize.getQueryInterface();
        const cols = await qi.describeTable('transactions');
        if (!cols.original_filename) {
            await qi.addColumn('transactions', 'original_filename', { type: DataTypes.STRING(255), allowNull: true });
        }
    } catch (e) { console.error('[Transaction] ensureColumns error:', e.message); }
})();
