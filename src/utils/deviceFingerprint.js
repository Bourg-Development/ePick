// utils/deviceFingerprint.js
const crypto = require('crypto');

/**
 * Utility for generating and validating device fingerprints
 */
class DeviceFingerprintUtil {
    /**
     * Generate a device fingerprint from request data
     * @param {Object} req - Express request object
     * @returns {string} Device fingerprint hash
     */
    getFingerprint(req) {
        // Try to get fingerprint from header first (if client-side fingerprinting is used)
        const clientFingerprint = req.get('X-Device-Fingerprint');
        if (clientFingerprint) {
            return clientFingerprint;
        }

        // Generate server-side fingerprint
        return this.generateServerFingerprint(req);
    }

    /**
     * Generate a server-side device fingerprint
     * @param {Object} req - Express request object
     * @returns {string} Server-generated fingerprint
     */
    generateServerFingerprint(req) {
        // Collect data points to use for fingerprinting
        const dataPoints = [
            req.headers['user-agent'] || '',
            req.headers['accept-language'] || '',
            req.headers['accept-encoding'] || '',
            req.headers['accept'] || '',
            req.ip // IP address
        ];

        // Add additional browser-specific headers if available
        if (req.headers['sec-ch-ua']) dataPoints.push(req.headers['sec-ch-ua']);
        if (req.headers['sec-ch-ua-platform']) dataPoints.push(req.headers['sec-ch-ua-platform']);
        if (req.headers['sec-ch-ua-mobile']) dataPoints.push(req.headers['sec-ch-ua-mobile']);

        // Hash the data points to create a fingerprint
        const fingerprintData = dataPoints.join('||');
        return crypto
            .createHash('sha256')
            .update(fingerprintData)
            .digest('hex');
    }

    /**
     * Validate if a fingerprint matches expected value
     * @param {string} providedFingerprint - Fingerprint provided by client
     * @param {string} expectedFingerprint - Expected fingerprint from database
     * @param {boolean} strictMode - Whether to enforce strict matching
     * @returns {boolean} Whether fingerprints match
     */
    validateFingerprint(providedFingerprint, expectedFingerprint, strictMode = false) {
        // In strict mode, require exact match
        if (strictMode) {
            return providedFingerprint === expectedFingerprint;
        }

        // In non-strict mode, check if the first 16 characters match
        // This allows for minor variations in browser/device
        if (!providedFingerprint || !expectedFingerprint) {
            return false;
        }

        const prefixLength = 16;
        return providedFingerprint.substring(0, prefixLength) ===
            expectedFingerprint.substring(0, prefixLength);
    }

    /**
     * Calculate similarity between two fingerprints (0-100%)
     * @param {string} fingerprint1 - First fingerprint
     * @param {string} fingerprint2 - Second fingerprint
     * @returns {number} Similarity percentage
     */
    calculateSimilarity(fingerprint1, fingerprint2) {
        if (!fingerprint1 || !fingerprint2) {
            return 0;
        }

        // Compare character by character
        let matchingChars = 0;
        const length = Math.min(fingerprint1.length, fingerprint2.length);

        for (let i = 0; i < length; i++) {
            if (fingerprint1[i] === fingerprint2[i]) {
                matchingChars++;
            }
        }

        // Return percentage match
        return Math.round((matchingChars / length) * 100);
    }
}

module.exports = new DeviceFingerprintUtil();