// middleware/csrf.js
const crypto = require('crypto');
const db = require('../db');
const { Op } = require('sequelize');
const logService = require('../services/logService');
const secureRandom = require('../utils/secureRandom');

/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern with server-side token validation
 */
class CSRFProtection {
    constructor() {
        // In-memory token store with TTL (should use Redis in production)
        this.tokenStore = new Map();
        
        // Clean up expired tokens every 15 minutes
        setInterval(() => {
            this._cleanupExpiredTokens();
        }, 15 * 60 * 1000);
    }

    /**
     * Generate a new CSRF token
     * @param {Object} req - Express request object
     * @returns {Promise<string>} CSRF token
     */
    async generateToken(req) {
        try {
            // Generate cryptographically secure random token with additional entropy
            const baseToken = crypto.randomBytes(32);
            const timestamp = Date.now();
            const randomSalt = secureRandom.randomBytes(16);
            
            // Combine multiple entropy sources and hash for unpredictability
            const tokenData = Buffer.concat([
                baseToken,
                Buffer.from(timestamp.toString()),
                randomSalt
            ]);
            
            // Create final token hash to prevent length-based analysis
            const token = crypto.createHash('sha256')
                .update(tokenData)
                .digest('hex');
            
            // Create token identifier for this session/user (consistent for retrieval)
            const tokenKey = this._getTokenKey(req);
            
            // Add random expiration jitter to prevent timing-based prediction (55-65 minutes)
            const baseExpiry = 60 * 60 * 1000; // 1 hour
            const jitter = secureRandom.randomInt(-5 * 60 * 1000, 5 * 60 * 1000); // ±5 minutes
            const expiresAt = Date.now() + baseExpiry + jitter;
            
            this.tokenStore.set(tokenKey, {
                token,
                expiresAt,
                used: false,
                createdAt: timestamp,
                entropy: randomSalt.toString('hex')
            });

            // Also store in database for persistent sessions
            await this._storeTokenInDatabase(tokenKey, token, expiresAt);

            return token;
        } catch (error) {
            console.error('CSRF token generation error:', error);
            throw new Error('Failed to generate CSRF token');
        }
    }

    /**
     * Middleware to generate and set CSRF token
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     * @param {Function} next - Next middleware
     */
    setToken = async (req, res, next) => {
        try {
            // Don't generate new token if one already exists and is valid
            const existingToken = await this._getValidToken(req);
            if (existingToken) {
                res.locals.csrfToken = existingToken;
                return next();
            }

            // Generate new token
            const token = await this.generateToken(req);
            
            // Set token in response locals for templates
            res.locals.csrfToken = token;
            
            // Set cookie with same-site protection
            res.cookie('_csrf', token, {
                httpOnly: false, // Frontend needs to read this
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 1000, // 1 hour
                path: '/'
            });

            next();
        } catch (error) {
            console.error('CSRF token setting error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to initialize CSRF protection'
            });
        }
    };

    /**
     * Middleware to verify CSRF token
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     * @param {Function} next - Next middleware
     */
    verifyToken = async (req, res, next) => {
        try {
            // Skip CSRF verification for safe methods
            if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
                return next();
            }

            // Get token from various sources
            const submittedToken = this._extractToken(req);
            const cookieToken = req.cookies && req.cookies._csrf;


            if (!submittedToken || !cookieToken) {
                await this._logCSRFViolation(req, 'missing_token');
                return res.status(403).json({
                    success: false,
                    message: 'CSRF token missing'
                });
            }

            // Timing-safe token comparison to prevent timing attacks
            const tokenMatch = this._timingSafeCompare(submittedToken, cookieToken);
            if (!tokenMatch) {
                await this._logCSRFViolation(req, 'token_mismatch');
                // Add random delay to prevent timing analysis
                await secureRandom.randomDelay(10, 50);
                return res.status(403).json({
                    success: false,
                    message: 'CSRF token mismatch'
                });
            }

            // Verify token exists and is valid with timing protection
            const isValid = await this._validateTokenTimingSafe(req, submittedToken);
            if (!isValid) {
                await this._logCSRFViolation(req, 'invalid_token');
                // Add random delay to prevent timing analysis
                await secureRandom.randomDelay(10, 50);
                return res.status(403).json({
                    success: false,
                    message: 'Invalid CSRF token'
                });
            }

            // Skip marking token as used to allow reuse in SPAs
            // await this._markTokenUsed(req, submittedToken);

            next();
        } catch (error) {
            console.error('CSRF verification error:', error);
            await this._logCSRFViolation(req, 'verification_error', error.message);
            return res.status(500).json({
                success: false,
                message: 'CSRF verification failed'
            });
        }
    };

    /**
     * Create token key for storage with additional entropy
     * @private
     * @param {Object} req - Express request
     * @param {Buffer} [entropy] - Additional entropy for key generation
     * @returns {string} Token key
     */
    _getTokenKey(req, entropy = null) {
        // Base components for key generation (consistent for same user/session)
        let keyComponents = [];
        
        // Use session ID if available
        if (req.auth && req.auth.sessionId) {
            keyComponents = [
                'session',
                req.auth.sessionId,
                req.auth.userId.toString()
            ];
        } else if (req.auth && req.auth.userId) {
            keyComponents = [
                'user',
                req.auth.userId.toString(),
                req.ip
            ];
        } else {
            // For unauthenticated users, use consistent identifiers
            const userAgent = req.headers['user-agent'] || 'unknown';
            const acceptLanguage = req.headers['accept-language'] || 'unknown';
            keyComponents = [
                'anonymous',
                req.ip,
                crypto.createHash('md5').update(userAgent).digest('hex').substring(0, 8),
                crypto.createHash('md5').update(acceptLanguage).digest('hex').substring(0, 8)
            ];
        }
        
        // Create consistent hash without random component
        const keyData = keyComponents.join(':');
        const hash = crypto.createHash('sha256')
            .update(keyData)
            .digest('hex');
            
        return `${keyComponents[0]}:${hash.substring(0, 16)}`;
    }

    /**
     * Extract CSRF token from request
     * @private
     * @param {Object} req - Express request
     * @returns {string|null} CSRF token
     */
    _extractToken(req) {
        // Check multiple sources for the token
        return (req.body && req.body._csrf) ||
               (req.query && req.query._csrf) ||
               req.headers['x-csrf-token'] ||
               req.headers['x-xsrf-token'] ||
               null;
    }

    /**
     * Timing-safe token comparison to prevent timing attacks
     * @private
     * @param {string} token1 - First token
     * @param {string} token2 - Second token  
     * @returns {boolean} Whether tokens match
     */
    _timingSafeCompare(token1, token2) {
        if (!token1 || !token2) {
            return false;
        }
        
        // Ensure both tokens are the same length to prevent length-based timing attacks
        if (token1.length !== token2.length) {
            return false;
        }
        
        // Use Node.js built-in timing-safe comparison
        try {
            const buf1 = Buffer.from(token1, 'hex');
            const buf2 = Buffer.from(token2, 'hex');
            return crypto.timingSafeEqual(buf1, buf2);
        } catch (error) {
            // Fallback for non-hex tokens
            return crypto.timingSafeEqual(
                Buffer.from(token1), 
                Buffer.from(token2)
            );
        }
    }

    /**
     * Validate CSRF token with timing protection
     * @private
     * @param {Object} req - Express request
     * @param {string} token - Token to validate
     * @returns {Promise<boolean>} Whether token is valid
     */
    async _validateTokenTimingSafe(req, token) {
        const startTime = Date.now();
        
        // Get the primary token key for this session/user
        const tokenKey = this._getTokenKey(req);
        let isValid = false;
        
        // Check in-memory store first
        const storedData = this.tokenStore.get(tokenKey);
        if (storedData && this._timingSafeCompare(storedData.token, token) && 
            storedData.expiresAt > Date.now()) {
            isValid = true;
        }

        // Check database as fallback if not found in memory
        if (!isValid) {
            try {
                const dbToken = await db.CSRFToken.findOne({
                    where: {
                        token_key: tokenKey,
                        expires_at: { [Op.gt]: new Date() }
                    }
                });
                
                if (dbToken && this._timingSafeCompare(dbToken.token_value, token)) {
                    isValid = true;
                }
            } catch (error) {
                console.error('Database CSRF token validation error:', error);
            }
        }
        
        // Ensure minimum validation time to prevent timing analysis
        const minValidationTime = 50; // 50ms minimum
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < minValidationTime) {
            await secureRandom.randomDelay(
                minValidationTime - elapsedTime, 
                minValidationTime - elapsedTime + 20
            );
        }
        
        return isValid;
    }


    /**
     * Validate CSRF token (legacy method - kept for compatibility)
     * @private
     * @param {Object} req - Express request
     * @param {string} token - Token to validate
     * @returns {Promise<boolean>} Whether token is valid
     */
    async _validateToken(req, token) {
        return this._validateTokenTimingSafe(req, token);
    }

    /**
     * Get valid existing token
     * @private
     * @param {Object} req - Express request
     * @returns {Promise<string|null>} Valid token or null
     */
    async _getValidToken(req) {
        const tokenKey = this._getTokenKey(req);
        
        // Check in-memory store
        const storedData = this.tokenStore.get(tokenKey);
        if (storedData && storedData.expiresAt > Date.now()) {
            return storedData.token;
        }

        // Check database
        try {
            const dbToken = await db.CSRFToken.findOne({
                where: {
                    token_key: tokenKey,
                    expires_at: { [Op.gt]: new Date() }
                }
            });
            
            if (dbToken) {
                // Sync to in-memory store
                this.tokenStore.set(tokenKey, {
                    token: dbToken.token_value,
                    expiresAt: dbToken.expires_at.getTime(),
                    used: false
                });
                return dbToken.token_value;
            }
        } catch (error) {
            console.error('Database CSRF token retrieval error:', error);
        }

        return null;
    }

    /**
     * Store token in database
     * @private
     * @param {string} tokenKey - Token key
     * @param {string} token - Token value
     * @param {number} expiresAt - Expiration timestamp
     */
    async _storeTokenInDatabase(tokenKey, token, expiresAt) {
        try {
            // Clean up any existing tokens for this key
            await db.CSRFToken.destroy({
                where: { token_key: tokenKey }
            });

            // Store new token
            await db.CSRFToken.create({
                token_key: tokenKey,
                token_value: token,
                expires_at: new Date(expiresAt),
                used: false
            });
        } catch (error) {
            console.error('Database CSRF token storage error:', error);
            // Don't throw - in-memory storage is still available
        }
    }

    /**
     * Mark token as used
     * @private
     * @param {Object} req - Express request
     * @param {string} token - Token to mark as used
     */
    async _markTokenUsed(req, token) {
        const tokenKey = this._getTokenKey(req);
        
        // Mark in memory store
        const storedData = this.tokenStore.get(tokenKey);
        if (storedData && storedData.token === token) {
            storedData.used = true;
        }

        // Mark in database
        try {
            await db.CSRFToken.update(
                { used: true },
                {
                    where: {
                        token_key: tokenKey,
                        token_value: token
                    }
                }
            );
        } catch (error) {
            console.error('Database CSRF token marking error:', error);
        }
    }

    /**
     * Clean up expired tokens
     * @private
     */
    _cleanupExpiredTokens() {
        const now = Date.now();
        
        // Clean up in-memory store
        for (const [key, data] of this.tokenStore.entries()) {
            if (data.expiresAt <= now) {
                this.tokenStore.delete(key);
            }
        }

        // Clean up database (run periodically)
        db.CSRFToken.destroy({
            where: {
                expires_at: { [Op.lt]: new Date() }
            }
        }).catch(error => {
            console.error('CSRF token cleanup error:', error);
        });
    }

    /**
     * Log CSRF violation
     * @private
     * @param {Object} req - Express request
     * @param {string} violationType - Type of violation
     * @param {string} [details] - Additional details
     */
    async _logCSRFViolation(req, violationType, details = null) {
        try {
            await logService.securityLog({
                eventType: 'csrf.violation',
                severity: 'high',
                userId: req.auth?.userId || null,
                ipAddress: req.ip,
                deviceFingerprint: req.get('X-Device-Fingerprint') || null,
                metadata: {
                    violationType,
                    details,
                    path: req.path,
                    method: req.method,
                    userAgent: req.headers['user-agent'] || 'unknown',
                    referer: req.headers.referer || null,
                    origin: req.headers.origin || null
                }
            });
        } catch (error) {
            console.error('Failed to log CSRF violation:', error);
        }
    }
}

// Create singleton instance
const csrfProtection = new CSRFProtection();

module.exports = {
    // Middleware functions
    setCSRFToken: csrfProtection.setToken,
    verifyCSRFToken: csrfProtection.verifyToken,
    
    // Direct access to instance for token generation
    generateCSRFToken: (req) => csrfProtection.generateToken(req),
    
    // Factory function for custom CSRF protection
    createCSRFProtection: (options = {}) => {
        return new CSRFProtection(options);
    }
};