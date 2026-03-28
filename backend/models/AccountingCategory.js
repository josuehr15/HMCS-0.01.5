const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AccountingCategory = sequelize.define('AccountingCategory', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },       // English key
    name_es: { type: DataTypes.STRING, allowNull: false },    // Spanish display
    type: { type: DataTypes.ENUM('income', 'expense'), allowNull: false },
    tax_deductible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    tax_category: { type: DataTypes.STRING, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    tableName: 'accounting_categories',
    underscored: true,
    timestamps: true,
});

module.exports = AccountingCategory;
