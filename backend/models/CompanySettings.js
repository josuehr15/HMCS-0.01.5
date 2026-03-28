const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CompanySettings = sequelize.define('CompanySettings', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    company_name: { type: DataTypes.STRING, allowNull: false, defaultValue: 'HM Construction Staffing LLLP' },
    address: { type: DataTypes.STRING, allowNull: true, defaultValue: '500 Lucas Dr' },
    city: { type: DataTypes.STRING, allowNull: true, defaultValue: 'Savannah' },
    state: { type: DataTypes.STRING, allowNull: true, defaultValue: 'GA' },
    zip: { type: DataTypes.STRING, allowNull: true, defaultValue: '31406-9435' },
    email: { type: DataTypes.STRING, allowNull: true, defaultValue: 'hmconstruction.staffing@gmail.com' },
    phone: { type: DataTypes.STRING, allowNull: true, defaultValue: '+1 (912) 695-1424' },
    logo_url: { type: DataTypes.STRING, allowNull: true },
    invoice_next_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    invoice_prefix: { type: DataTypes.STRING, allowNull: false, defaultValue: '26' },
    payment_terms_days: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 14 },
    payment_instructions: {
        type: DataTypes.TEXT, allowNull: true,
        defaultValue: 'Please make checks payable to: HM Construction Staffing LLLP'
    },
}, {
    tableName: 'company_settings',
    underscored: true,
    timestamps: true,
});

module.exports = CompanySettings;
