const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Trade = sequelize.define('Trade', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    name_es: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    tableName: 'trades',
    underscored: true,
    timestamps: true,
});

module.exports = Trade;
