// services/cryptoService.js
const crypto = require('crypto');
const { CRYPTO_SECRET } = require('../config/environment');

/**
 * Service for encryption/decryption of sensitive data
 */
class CryptoService {
    constructor() {
        // Ensure CRYPTO_SECRET is set and has proper length
        if (!CRYPTO_SECRET || CRYPTO_SECRET.length !== 32) {
            console.warn(
                'WARNING: CRYPTO_SECRET is not set properly or is not 32 characters. ' +
                'This will affect the security of encrypted data.'
            );
        }
    }

    /**
     * Encrypt a string
     * @param {string} text - Plain text to encrypt
     * @returns {string} Base64 encoded encrypted string
     */
    encrypt(text) {
        try {
            if (!text) return '';

            // Generate a random initialization vector
            const iv = crypto.randomBytes(16);

            // Create a cipher with AES-256-CBC
            const cipher = crypto.createCipheriv(
                'aes-256-cbc',
                Buffer.from(CRYPTO_SECRET),
                iv
            );

            // Encrypt the text
            let encrypted = cipher.update(text, 'utf8', 'base64');
            encrypted += cipher.final('base64');

            // Return IV and encrypted text combined (IV needs to be stored for decryption)
            return iv.toString('hex') + ':' + encrypted;
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt an encrypted string
     * @param {string} encryptedText - Encrypted text (format: iv:encryptedText)
     * @returns {string} Decrypted text
     */
    decrypt(encryptedText) {
        try {
            if (!encryptedText) return '';

            // Split the IV and encrypted text
            const parts = encryptedText.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted text format');
            }

            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];

            // Create a decipher
            const decipher = crypto.createDecipheriv(
                'aes-256-cbc',
                Buffer.from(CRYPTO_SECRET),
                iv
            );

            // Decrypt the text
            let decrypted = decipher.update(encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Hash a string using SHA-256
     * @param {string} text - Text to hash
     * @returns {string} Hex encoded hash
     */
    hash(text) {
        if (!text) return '';
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    /**
     * Generate a secure random token
     * @param {number} length - Token length (default: 32)
     * @returns {string} Hex encoded random token
     */
    generateToken(length = 32) {
        return crypto.randomBytes(length / 2).toString('hex');
    }
}

module.exports = new CryptoService();