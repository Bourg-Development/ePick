// utils/secureDeviceFingerprint.js

const crypto = require('crypto');
const { CRYPTO_SECRET } = require('../config/environment');

/**
 * Secure device fingerprint utility that prevents spoofing
 * Always validates client-provided fingerprints against server-generated ones
 */
class SecureDeviceFingerprint {
    constructor() {
        // Use application secret for HMAC operations
        this.hmacSecret = CRYPTO_SECRET || crypto.randomBytes(32).toString('hex');
        
        // Fingerprint components and their weights for similarity scoring
        this.fingerprintComponents = {
            ip: { weight: 0.3, extract: (req) => req.ip },
            userAgent: { weight: 0.3, extract: (req) => this.normalizeUserAgent(req.headers['user-agent'] || '') },
            language: { weight: 0.1, extract: (req) => req.headers['accept-language'] || '' },
            encoding: { weight: 0.05, extract: (req) => req.headers['accept-encoding'] || '' },
            platform: { weight: 0.1, extract: (req) => req.headers['sec-ch-ua-platform'] || '' },
            mobile: { weight: 0.05, extract: (req) => req.headers['sec-ch-ua-mobile'] || '' },
            vendor: { weight: 0.1, extract: (req) => req.headers['sec-ch-ua'] || '' }
        };
        
        // Minimum similarity threshold for fingerprint validation (70%)
        this.SIMILARITY_THRESHOLD = 0.7;
        
        // Cache for recently validated fingerprints (prevent replay attacks)
        this.recentValidations = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Generate a secure device fingerprint from request
     * This is the authoritative server-side fingerprint
     * 
     * @param {Object} req - Express request object
     * @returns {Object} Fingerprint data with hash and components
     */
    generateSecureFingerprint(req) {
        const components = {};
        const timestamp = Date.now();
        
        // Extract all components
        for (const [name, config] of Object.entries(this.fingerprintComponents)) {
            components[name] = config.extract(req);
        }
        
        // Create deterministic fingerprint string
        const fingerprintData = [
            components.ip,
            components.userAgent,
            components.language,
            components.encoding,
            components.platform,
            components.mobile,
            components.vendor
        ].join('||');
        
        // Generate HMAC-based fingerprint (prevents client forgery)
        const fingerprint = crypto
            .createHmac('sha256', this.hmacSecret)
            .update(fingerprintData)
            .digest('hex');
        
        // Also generate a public hash (without secret)
        const publicHash = crypto
            .createHash('sha256')
            .update(fingerprintData)
            .digest('hex');
        
        return {
            fingerprint,        // Secure HMAC fingerprint
            publicHash,        // Public hash for client comparison
            components,        // Individual components for similarity checking
            timestamp,         // Generation time
            data: fingerprintData
        };
    }

    /**
     * Validate a client-provided fingerprint
     * Prevents spoofing by comparing against server-generated fingerprint
     * 
     * @param {Object} req - Express request object
     * @param {string} clientFingerprint - Fingerprint provided by client
     * @param {string} storedFingerprint - Previously stored fingerprint
     * @returns {Object} Validation result
     */
    validateClientFingerprint(req, clientFingerprint, storedFingerprint = null) {
        // Generate current server fingerprint
        const serverFingerprint = this.generateSecureFingerprint(req);
        
        // Check for replay attacks
        const replayKey = `${clientFingerprint}:${req.ip}`;
        if (this.recentValidations.has(replayKey)) {
            const lastValidation = this.recentValidations.get(replayKey);
            if (Date.now() - lastValidation.timestamp < this.CACHE_TTL) {
                return {
                    valid: false,
                    reason: 'Replay attack detected - fingerprint recently used',
                    similarity: 0,
                    serverFingerprint: serverFingerprint.fingerprint
                };
            }
        }
        
        // Validate against server fingerprint
        const validationResults = {
            exactMatch: clientFingerprint === serverFingerprint.fingerprint,
            publicMatch: clientFingerprint === serverFingerprint.publicHash,
            storedMatch: storedFingerprint ? clientFingerprint === storedFingerprint : null,
            similarity: 0,
            componentMatches: {}
        };
        
        // If client sent public hash instead of HMAC, that's suspicious but calculate similarity
        if (validationResults.publicMatch && !validationResults.exactMatch) {
            validationResults.suspicious = true;
        }
        
        // Calculate component-wise similarity if stored fingerprint exists
        if (storedFingerprint) {
            validationResults.similarity = this.calculateWeightedSimilarity(
                serverFingerprint.components,
                storedFingerprint
            );
        }
        
        // Determine if fingerprint is valid
        const isValid = validationResults.exactMatch || 
                       (storedFingerprint && validationResults.storedMatch) ||
                       (validationResults.similarity >= this.SIMILARITY_THRESHOLD);
        
        // Cache validation to prevent replay
        if (isValid) {
            this.recentValidations.set(replayKey, {
                timestamp: Date.now(),
                fingerprint: clientFingerprint
            });
            
            // Clean old entries
            this.cleanValidationCache();
        }
        
        return {
            valid: isValid,
            reason: this.getValidationReason(validationResults),
            similarity: validationResults.similarity,
            serverFingerprint: serverFingerprint.fingerprint,
            suspicious: validationResults.suspicious || false,
            details: validationResults
        };
    }

    /**
     * Get a safe fingerprint for client-side storage
     * This prevents clients from obtaining the HMAC version
     * 
     * @param {Object} req - Express request object
     * @returns {string} Public fingerprint hash
     */
    getClientSafeFingerprint(req) {
        const fingerprint = this.generateSecureFingerprint(req);
        return fingerprint.publicHash;
    }

    /**
     * Calculate weighted similarity between fingerprint components
     * 
     * @param {Object} currentComponents - Current request components
     * @param {string} storedFingerprint - Stored fingerprint to compare
     * @returns {number} Similarity score (0-1)
     */
    calculateWeightedSimilarity(currentComponents, storedFingerprint) {
        // For now, do simple string similarity
        // In production, you'd decode stored components and compare individually
        const current = Object.values(currentComponents).join('||');
        const stored = storedFingerprint;
        
        if (!current || !stored) return 0;
        
        // Character-by-character comparison
        let matches = 0;
        const minLength = Math.min(current.length, stored.length);
        
        for (let i = 0; i < minLength; i++) {
            if (current[i] === stored[i]) matches++;
        }
        
        return matches / Math.max(current.length, stored.length);
    }

    /**
     * Normalize user agent string to reduce false positives
     * 
     * @param {string} userAgent - Raw user agent string
     * @returns {string} Normalized user agent
     */
    normalizeUserAgent(userAgent) {
        return userAgent
            // Remove specific version numbers but keep browser identity
            .replace(/Chrome\/[\d.]+/g, 'Chrome/X')
            .replace(/Safari\/[\d.]+/g, 'Safari/X')
            .replace(/Firefox\/[\d.]+/g, 'Firefox/X')
            .replace(/Edge\/[\d.]+/g, 'Edge/X')
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
    }

    /**
     * Get human-readable validation failure reason
     * 
     * @param {Object} results - Validation results
     * @returns {string} Reason for validation result
     */
    getValidationReason(results) {
        if (results.exactMatch) {
            return 'Exact fingerprint match with server calculation';
        }
        if (results.storedMatch) {
            return 'Fingerprint matches stored value';
        }
        if (results.similarity >= this.SIMILARITY_THRESHOLD) {
            return `Fingerprint similarity ${Math.round(results.similarity * 100)}% exceeds threshold`;
        }
        if (results.publicMatch) {
            return 'Client provided public hash instead of secure fingerprint (suspicious)';
        }
        return 'Fingerprint validation failed - no match found';
    }

    /**
     * Clean old entries from validation cache
     */
    cleanValidationCache() {
        const now = Date.now();
        for (const [key, value] of this.recentValidations.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.recentValidations.delete(key);
            }
        }
    }

    /**
     * Validate fingerprint with enhanced security checks
     * 
     * @param {Object} req - Express request object  
     * @param {string} clientFingerprint - Client-provided fingerprint
     * @param {Object} session - Session object with stored fingerprint
     * @returns {Object} Enhanced validation result
     */
    validateWithSession(req, clientFingerprint, session) {
        // Basic validation
        const validation = this.validateClientFingerprint(
            req, 
            clientFingerprint, 
            session.device_fingerprint
        );
        
        // Additional security checks
        const securityChecks = {
            ipChanged: session.ip_address !== req.ip,
            suspiciousPattern: this.detectSuspiciousPattern(req),
            recentFailures: this.checkRecentFailures(req.ip)
        };
        
        // Adjust validation based on security checks
        if (securityChecks.ipChanged && validation.similarity < 0.9) {
            validation.valid = false;
            validation.reason = 'IP address changed with low fingerprint similarity';
            validation.securityConcern = 'possible_session_hijack';
        }
        
        if (securityChecks.suspiciousPattern) {
            validation.suspicious = true;
            validation.securityConcern = 'suspicious_request_pattern';
        }
        
        validation.securityChecks = securityChecks;
        return validation;
    }

    /**
     * Detect suspicious request patterns
     * 
     * @param {Object} req - Express request object
     * @returns {boolean} Whether request seems suspicious
     */
    detectSuspiciousPattern(req) {
        const ua = req.headers['user-agent'] || '';
        
        // Check for common bot/scraper patterns
        const suspiciousPatterns = [
            /bot|crawler|spider|scraper/i,
            /curl|wget|python|java/i,
            /headless/i
        ];
        
        return suspiciousPatterns.some(pattern => pattern.test(ua));
    }

    /**
     * Check for recent validation failures from an IP
     * 
     * @param {string} ip - IP address to check
     * @returns {boolean} Whether there are concerning recent failures
     */
    checkRecentFailures(ip) {
        // In production, this would check a database or cache
        // For now, return false
        return false;
    }
}

module.exports = new SecureDeviceFingerprint();