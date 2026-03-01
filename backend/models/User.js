const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    password_hash: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM('admin', 'contractor', 'client'),
        allowNull: false,
    },
    preferred_language: {
        type: DataTypes.ENUM('es', 'en'),
        allowNull: false,
        defaultValue: 'es',
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    last_login_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
});

module.exports = User;
