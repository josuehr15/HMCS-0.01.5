const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Document — stores metadata for uploaded files.
 * Actual files are stored on disk in backend/uploads/documents/
 */
const Document = sequelize.define('Document', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    owner_type: {
        type: DataTypes.ENUM('worker', 'client', 'company'),
        allowNull: false,
    },
    owner_id: {
        type: DataTypes.INTEGER,
        allowNull: true, // null = company-level doc
    },
    document_type: {
        type: DataTypes.ENUM('id_photo', 'ssn_photo', 'w9', 'contract', 'insurance_cert', 'other'),
        allowNull: false,
        defaultValue: 'other',
    },
    document_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    file_name: {
        type: DataTypes.STRING,
        allowNull: false, // stored filename on disk
    },
    file_url: {
        type: DataTypes.STRING,
        allowNull: false, // relative URL e.g. /uploads/documents/abc123.pdf
    },
    file_size: {
        type: DataTypes.INTEGER,
        allowNull: true, // bytes
    },
    mime_type: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    uploaded_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    tableName: 'documents',
    underscored: true,
    timestamps: true,
});

module.exports = Document;
