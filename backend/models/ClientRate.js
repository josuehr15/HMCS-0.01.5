const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClientRate = sequelize.define('ClientRate', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    client_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'clients',
            key: 'id',
        },
    },
    trade_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'trades',
            key: 'id',
        },
    },
    hourly_rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    overtime_multiplier: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.50,
    },
}, {
    tableName: 'client_rates',
    underscored: true,
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['client_id', 'trade_id'],
            name: 'unique_client_trade_rate',
        },
    ],
});

module.exports = ClientRate;
