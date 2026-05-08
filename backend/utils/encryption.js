/**
 * encryption.js — AES-256-GCM symmetric encryption for sensitive PII (SSN, etc.)
 *
 * Key is derived from ENCRYPTION_SECRET env variable.
 * Format: iv:authTag:ciphertext (all base64)
 *
 * SEC-SSN: Fix C11 — SSN stored in plaintext under misleading column name ssn_encrypted.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN   = 32; // bytes for AES-256

function getDerivedKey() {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
        // Fallback for dev — NOT for production
        const fallback = 'hmcs-dev-secret-change-in-production!!';
        if (process.env.NODE_ENV === 'production') {
            throw new Error('ENCRYPTION_SECRET env variable is required in production.');
        }
        return crypto.createHash('sha256').update(fallback).digest(); // 32 bytes
    }
    return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string.
 * @param {string} plaintext
 * @returns {string} "iv:authTag:ciphertext" (base64 segments)
 */
function encrypt(plaintext) {
    if (!plaintext) return plaintext;
    const key = getDerivedKey();
    const iv  = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag   = cipher.getAuthTag();
    return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

/**
 * Decrypts a value produced by encrypt().
 * Returns plaintext, or null if decryption fails.
 * @param {string} value
 * @returns {string|null}
 */
function decrypt(value) {
    if (!value) return value;
    // If not in our format, return as-is (backward compat with plaintext rows)
    if (!value.includes(':')) return value;
    try {
        const [ivB64, authTagB64, dataB64] = value.split(':');
        const key     = getDerivedKey();
        const iv      = Buffer.from(ivB64,     'base64');
        const authTag = Buffer.from(authTagB64, 'base64');
        const data    = Buffer.from(dataB64,   'base64');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
        return null; // tampered or corrupted
    }
}

/**
 * Masks an SSN for display — shows only last 4 digits.
 * Works on both plaintext and encrypted values.
 * @param {string} ssnOrEncrypted
 * @returns {string} e.g. "***-**-1234"
 */
function maskSSN(ssnOrEncrypted) {
    if (!ssnOrEncrypted) return '';
    const plain = decrypt(ssnOrEncrypted) || ssnOrEncrypted;
    const digits = plain.replace(/\D/g, '');
    if (digits.length < 4) return '***-**-****';
    return `***-**-${digits.slice(-4)}`;
}

module.exports = { encrypt, decrypt, maskSSN };
