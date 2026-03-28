const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BankImport = sequelize.define('BankImport', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    file_name: { type: DataTypes.STRING, allowNull: false },
    bank_name: { type: DataTypes.STRING, allowNull: false, defaultValue: 'wells_fargo' },
    total_transactions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    imported_transactions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    skipped_transactions: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    imported_by_user_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
}, {
    tableName: 'bank_imports',
    underscored: true,
    timestamps: true,
});

module.exports = BankImport;
