// utils/deviceFingerprint.js
const crypto = require('crypto');
const secureFingerprint = require('./secureDeviceFingerprint');

/**
 * Utility for generating and validating device fingerprints
 * Enhanced with anti-spoofing protection
 */
class DeviceFingerprintUtil {
    /**
     * Generate a device fingerprint from request data
     * @param {Object} req - Express request object
     * @returns {string} Device fingerprint hash
     */

    getFingerprint(req) {
        // Always generate server-side fingerprint for security
        const serverFingerprintData = secureFingerprint.generateSecureFingerprint(req);
        
        // Check if client provided a fingerprint
        const clientFingerprint = req.get('X-Device-Fingerprint');
        
        if (clientFingerprint) {
            // Validate client fingerprint against server calculation
            const validation = secureFingerprint.validateClientFingerprint(
                req,
                clientFingerprint,
                null // No stored fingerprint for initial generation
            );
            
            // Log suspicious attempts
            if (validation.suspicious || !validation.valid) {
                console.warn('Device fingerprint validation issue:', {
                    clientFingerprint: clientFingerprint.substring(0, 16) + '...',
                    serverFingerprint: serverFingerprintData.fingerprint.substring(0, 16) + '...',
                    reason: validation.reason,
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                });
            }
            
            // Only use client fingerprint if it matches server calculation
            if (validation.valid && validation.exactMatch) {
                return clientFingerprint;
            }
        }
        
        // Return secure server-generated fingerprint
        return serverFingerprintData.fingerprint;
    }

    /**
     * Generate a server-side device fingerprint
     * @param {Object} req - Express request object
     * @returns {string} Server-generated fingerprint
     */
    generateServerFingerprint(req) {
        // Use more stable data points that don't vary between navigation and fetch
        const dataPoints = [
            req.ip, // IP address - most stable
            this.normalizeUserAgent(req.headers['user-agent'] || ''), // Normalized UA
            req.headers['accept-language'] || '', // Usually consistent
        ];

        // Only add browser-specific headers if they exist (more lenient)
        // These are often missing in fetch requests, so make them optional
        const optionalHeaders = [
            req.headers['sec-ch-ua'],
            req.headers['sec-ch-ua-platform'],
            req.headers['sec-ch-ua-mobile']
        ];

        // Only include optional headers that are actually present
        optionalHeaders.forEach(header => {
            if (header) dataPoints.push(header);
        });

        // Hash the data points to create a fingerprint
        const fingerprintData = dataPoints.join('||');
        return crypto
            .createHash('sha256')
            .update(fingerprintData)
            .digest('hex');
    }

    /**
     * Normalize user agent to ignore minor variations
     * @param {string} userAgent
     * @returns {string} Normalized user agent
     */
    normalizeUserAgent(userAgent) {
        // Remove version numbers that might change frequently
        return userAgent
            .replace(/Chrome\/[\d.]+/g, 'Chrome/XXX')
            .replace(/Safari\/[\d.]+/g, 'Safari/XXX')
            .replace(/Firefox\/[\d.]+/g, 'Firefox/XXX')
            .replace(/Edge\/[\d.]+/g, 'Edge/XXX');
    }
    /**
     * Validate if a fingerprint matches expected value
     * Enhanced with anti-spoofing protection
     * @param {string} providedFingerprint - Fingerprint provided by client
     * @param {string} expectedFingerprint - Expected fingerprint from database
     * @param {boolean} strictMode - Whether to enforce strict matching
     * @param {Object} req - Express request object for validation
     * @returns {boolean} Whether fingerprints match
     */
    validateFingerprint(providedFingerprint, expectedFingerprint, strictMode = false, req = null) {
        // If request object is provided, use secure validation
        if (req) {
            const validation = secureFingerprint.validateClientFingerprint(
                req,
                providedFingerprint,
                expectedFingerprint
            );
            
            // In strict mode, require exact match and no suspicion
            if (strictMode) {
                return validation.valid && !validation.suspicious && validation.similarity >= 0.95;
            }
            
            // In non-strict mode, allow some variation
            return validation.valid && validation.similarity >= 0.7;
        }
        
        // Fallback to legacy validation if no request object
        // This maintains backward compatibility but is less secure
        console.warn('Device fingerprint validation without request object is deprecated');
        
        if (strictMode) {
            return providedFingerprint === expectedFingerprint;
        }

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