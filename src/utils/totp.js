// utils/totp.js
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const cryptoService = require('../services/cryptoService');

/**
 * Utility for TOTP (Time-based One-Time Password) operations
 */
class TOTPUtil {
    /**
     * Generate a new TOTP secret
     * @param {string} username - User's username
     * @param {string} [issuer='Military-Auth'] - Issuer name
     * @returns {Promise<Object>} TOTP secret and URI
     */
    async generateSecret(username, issuer = 'Military-Auth') {
        try {
            // Generate secure secret
            const secret = speakeasy.generateSecret({
                length: 20,
                name: `${issuer}:${username}`,
                issuer
            });

            // Generate QR code
            const qrCodeDataUrl = await this.generateQRCode(secret.otpauth_url);

            return {
                base32: secret.base32,
                otpauthUrl: secret.otpauth_url,
                qrCode: qrCodeDataUrl
            };
        } catch (error) {
            console.error('TOTP secret generation error:', error);
            throw new Error('Failed to generate TOTP secret');
        }
    }

    /**
     * Verify a TOTP code
     * @param {string} token - TOTP code (6 digits)
     * @param {string} secret - Base32 encoded secret
     * @param {Object} [options] - Verification options
     * @param {number} [options.window=1] - Time window (default: ±1 period)
     * @returns {boolean} Whether the token is valid
     */
    verifyToken(token, secret, options = {}) {
        try {
            // Verify the token
            return speakeasy.totp.verify({
                secret,
                encoding: 'base32',
                token,
                window: options.window || 1
            });
        } catch (error) {
            console.error('TOTP verification error:', error);
            return false;
        }
    }

    /**
     * Generate a TOTP QR code
     * @param {string} otpauthUrl - TOTP auth URL
     * @returns {Promise<string>} QR code as data URL
     */
    async generateQRCode(otpauthUrl) {
        try {
            return await QRCode.toDataURL(otpauthUrl, {
                errorCorrectionLevel: 'M',
                margin: 4,
                scale: 4
            });
        } catch (error) {
            console.error('QR code generation error:', error);
            throw new Error('Failed to generate QR code');
        }
    }

    /**
     * Encrypt a TOTP secret for storage
     * @param {string} secret - TOTP secret in base32 format
     * @returns {string} Encrypted secret
     */
    encryptSecret(secret) {
        return cryptoService.encrypt(secret);
    }

    /**
     * Decrypt a stored TOTP secret
     * @param {string} encryptedSecret - Encrypted TOTP secret
     * @returns {string} Decrypted secret in base32 format
     */
    decryptSecret(encryptedSecret) {
        return cryptoService.decrypt(encryptedSecret);
    }

    /**
     * Generate a TOTP token (for testing)
     * @param {string} secret - Base32 encoded secret
     * @returns {string} Current TOTP token
     */
    generateToken(secret) {
        try {
            return speakeasy.totp({
                secret,
                encoding: 'base32',
                digits: 6
            });
        } catch (error) {
            console.error('TOTP generation error:', error);
            throw new Error('Failed to generate TOTP token');
        }
    }
}

module.exports = new TOTPUtil();