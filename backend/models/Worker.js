const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

// BUG-001: AES-256-GCM encryption for SSN field.
// Requires SSN_ENCRYPTION_KEY in .env (64 hex chars = 32 bytes).
const ALGO = 'aes-256-gcm';

function encryptSSN(plaintext) {
    if (!plaintext) return null;
    const key = Buffer.from(process.env.SSN_ENCRYPTION_KEY || '', 'hex');
    if (key.length !== 32) {
        console.error('SSN_ENCRYPTION_KEY must be 64 hex characters (32 bytes). SSN not encrypted.');
        return plaintext; // store as-is rather than lose data
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: iv(12):tag(16):ciphertext — all hex-encoded, colon-separated
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSSN(stored) {
    if (!stored) return null;
    // Detect unencrypted legacy values (no colons in our format)
    const parts = stored.split(':');
    if (parts.length !== 3) return stored; // legacy plaintext, return as-is
    const key = Buffer.from(process.env.SSN_ENCRYPTION_KEY || '', 'hex');
    if (key.length !== 32) return null;
    try {
        const [ivHex, tagHex, ctHex] = parts;
        const iv = Buffer.from(ivHex, 'hex');
        const tag = Buffer.from(tagHex, 'hex');
        const ct = Buffer.from(ctHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGO, key, iv);
        decipher.setAuthTag(tag);
        return decipher.update(ct) + decipher.final('utf8');
    } catch {
        return null;
    }
}

const Worker = sequelize.define('Worker', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    worker_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    first_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    last_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false,
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
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
    },
    availability: {
        type: DataTypes.ENUM('available', 'assigned', 'unavailable'),
        allowNull: false,
        defaultValue: 'available',
    },
    ssn_encrypted: {
        type: DataTypes.STRING,
        allowNull: true,
        // BUG-001: encrypt on write, decrypt on read
        set(value) {
            this.setDataValue('ssn_encrypted', encryptSSN(value));
        },
        get() {
            return decryptSSN(this.getDataValue('ssn_encrypted'));
        },
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    city: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    state: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    zip_code: {
        type: DataTypes.STRING(10),
        allowNull: true,
    },
    emergency_contact_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    emergency_contact_phone: {
        type: DataTypes.STRING,
        allowNull: true,
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
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
}, {
    tableName: 'workers',
    underscored: true,
    timestamps: true,
});

// Auto-add columns if missing (safe to re-run)
(async () => {
    try {
        const qi = sequelize.getQueryInterface();
        const cols = await qi.describeTable('workers');
        if (!cols.city)     await qi.addColumn('workers', 'city',     { type: DataTypes.STRING(100), allowNull: true });
        if (!cols.state)    await qi.addColumn('workers', 'state',    { type: DataTypes.STRING(50),  allowNull: true });
        if (!cols.zip_code) await qi.addColumn('workers', 'zip_code', { type: DataTypes.STRING(10),  allowNull: true });
    } catch (e) {
        console.error('[Worker] ensureColumns error:', e.message);
    }
})();

module.exports = Worker;
