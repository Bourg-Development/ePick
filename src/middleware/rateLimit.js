// middleware/rateLimit.js
const db = require('../db');
const logService = require('../services/logService');

/**
 * Factory function to create rate limiting middleware
 * @param {Object} options - Rate limiting options
 * @param {number} options.maxRequests - Maximum number of requests allowed within window
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {string} options.keyType - Type of key to rate limit by ('ip', 'user', 'service')
 * @param {string} options.errorMessage - Error message to return when rate limited
 * @param {string} options.logType - Type of event to log when rate limited
 * @returns {Function} Express middleware function
 */
const rateLimit = (options = {}) => {
    const {
        maxRequests = 60,
        windowMs = 60000, // 1 minute default
        keyType = 'ip',
        errorMessage = 'Too many requests, please try again later',
        logType = 'general'
    } = options;

    return async (req, res, next) => {
        try {
            // Determine the key value based on key type
            let keyValue;
            switch (keyType) {
                case 'user':
                    keyValue = req.auth?.userId?.toString() || req.ip;
                    break;
                case 'service':
                    keyValue = req.auth?.serviceId?.toString() || req.ip;
                    break;
                case 'ip':
                default:
                    keyValue = req.ip;
                    break;
            }

            // Skip rate limiting for special circumstances if needed
            if (req.skipRateLimit) {
                return next();
            }

            // Find or create rate limit record
            let rateLimit = await db.RateLimit.findOne({
                where: {
                    key_type: keyType,
                    key_value: keyValue
                }
            });

            const now = new Date();

            // If no rate limit record exists or the window has expired, create a new one
            if (!rateLimit || rateLimit.reset_at <= now) {
                const resetAt = new Date(now.getTime() + windowMs);

                if (rateLimit) {
                    // Reset existing record
                    rateLimit.counter = 1;
                    rateLimit.first_request = now;
                    rateLimit.last_request = now;
                    rateLimit.reset_at = resetAt;
                    await rateLimit.save();
                } else {
                    // Create new record
                    rateLimit = await db.RateLimit.create({
                        key_type: keyType,
                        key_value: keyValue,
                        counter: 1,
                        first_request: now,
                        last_request: now,
                        reset_at: resetAt
                    });
                }

                return next();
            }

            // Update the existing rate limit record
            rateLimit.counter += 1;
            rateLimit.last_request = now;
            await rateLimit.save();

            // If the rate limit is exceeded, return error response
            if (rateLimit.counter > maxRequests) {
                // Calculate remaining time until reset
                const resetTime = Math.ceil((rateLimit.reset_at - now) / 1000);

                // Log rate limit violation
                await logService.securityLog({
                    eventType: `ratelimit.exceeded.${logType}`,
                    severity: 'medium',
                    userId: req.auth?.userId || null,
                    ipAddress: req.ip,
                    deviceFingerprint: req.get('X-Device-Fingerprint') || null,
                    metadata: {
                        keyType,
                        keyValue,
                        requestCount: rateLimit.counter,
                        limit: maxRequests,
                        windowMs,
                        path: req.path,
                        method: req.method,
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                // Set rate limit headers
                res.set('Retry-After', resetTime);
                res.set('X-RateLimit-Limit', maxRequests);
                res.set('X-RateLimit-Remaining', 0);
                res.set('X-RateLimit-Reset', Math.ceil(rateLimit.reset_at.getTime() / 1000));

                return res.status(429).json({
                    success: false,
                    message: errorMessage,
                    retryAfter: resetTime
                });
            }

            // Set rate limit headers on successful requests too
            res.set('X-RateLimit-Limit', maxRequests);
            res.set('X-RateLimit-Remaining', maxRequests - rateLimit.counter);
            res.set('X-RateLimit-Reset', Math.ceil(rateLimit.reset_at.getTime() / 1000));

            return next();
        } catch (error) {
            console.error('Rate limiting error:', error);
            // On error, allow the request to proceed to avoid blocking legitimate traffic
            return next();
        }
    };
};

/**
 * Pre-configured rate limiters for different scenarios
 */
module.exports = {
    // Generic rate limiter
    rateLimit,

    // ============================================
    // AUTHENTICATION RATE LIMITERS
    // ============================================

    // Authentication endpoints rate limiter (very strict)
    authRateLimit: rateLimit({
        maxRequests: 5,
        windowMs: 60000, // 1 minute
        keyType: 'ip',
        errorMessage: 'Too many authentication attempts, please try again later',
        logType: 'auth'
    }),

    refreshRateLimit: rateLimit({
        maxRequests: 60,
        windowMs: 60000,
        keyType: 'ip',
        errorMessage: 'Too many authentication attempts, please try again later',
        logType: 'auth'
    }),

    // 2FA verification rate limiter (strict)
    twoFactorRateLimit: rateLimit({
        maxRequests: 10,
        windowMs: 300000, // 5 minutes
        keyType: 'ip',
        errorMessage: 'Too many 2FA attempts, please wait before trying again',
        logType: '2fa'
    }),

    // Password change rate limiter
    passwordChangeRateLimit: rateLimit({
        maxRequests: 3,
        windowMs: 300000, // 5 minutes
        keyType: 'user',
        errorMessage: 'Too many password change attempts',
        logType: 'password'
    }),

    // ============================================
    // GENERAL API RATE LIMITERS
    // ============================================

    // General API endpoints rate limiter
    generalRateLimit: rateLimit({
        maxRequests: 100,
        windowMs: 60000, // 1 minute
        keyType: 'user',
        errorMessage: 'API rate limit exceeded, please slow down',
        logType: 'api'
    }),

    // API endpoints rate limiter (legacy - kept for compatibility)
    apiRateLimit: rateLimit({
        maxRequests: 60,
        windowMs: 60000, // 1 minute
        keyType: 'user',
        errorMessage: 'API rate limit exceeded',
        logType: 'api'
    }),

    // ============================================
    // HEALTHCARE-SPECIFIC RATE LIMITERS
    // ============================================

    // Patient data access rate limiter (medical privacy protection)
    patientDataRateLimit: rateLimit({
        maxRequests: 200,
        windowMs: 60000, // 1 minute
        keyType: 'user',
        errorMessage: 'Patient data access rate limit exceeded',
        logType: 'patient_data'
    }),

    // Analysis creation rate limiter (prevent spam scheduling)
    analysisCreationRateLimit: rateLimit({
        maxRequests: 30,
        windowMs: 60000, // 1 minute
        keyType: 'user',
        errorMessage: 'Analysis creation rate limit exceeded',
        logType: 'analysis_creation'
    }),

    // Critical operations rate limiter (analysis cancellation, status updates)
    criticalOpsRateLimit: rateLimit({
        maxRequests: 50,
        windowMs: 60000, // 1 minute
        keyType: 'user',
        errorMessage: 'Critical operations rate limit exceeded',
        logType: 'critical_ops'
    }),

    // ============================================
    // ADMINISTRATIVE RATE LIMITERS
    // ============================================

    // User management rate limiter
    userManagementRateLimit: rateLimit({
        maxRequests: 20,
        windowMs: 60000, // 1 minute
        keyType: 'user',
        errorMessage: 'User management rate limit exceeded',
        logType: 'user_mgmt'
    }),

    // Reference code generation limiter (stricter)
    refCodeRateLimit: rateLimit({
        maxRequests: 10,
        windowMs: 300000, // 5 minutes
        keyType: 'user',
        errorMessage: 'Reference code generation rate limit exceeded',
        logType: 'refcode'
    }),

    // Organization settings rate limiter (very strict)
    settingsRateLimit: rateLimit({
        maxRequests: 20,
        windowMs: 300000, // 5 minutes
        keyType: 'user',
        errorMessage: 'Settings modification rate limit exceeded',
        logType: 'settings'
    }),

    // ============================================
    // DATA EXPORT & BULK OPERATIONS
    // ============================================

    // Export operations rate limiter (resource intensive)
    exportRateLimit: rateLimit({
        maxRequests: 5,
        windowMs: 300000, // 5 minutes
        keyType: 'user',
        errorMessage: 'Export rate limit exceeded, please wait before generating another export',
        logType: 'export'
    }),

    // Bulk operations rate limiter
    bulkOpsRateLimit: rateLimit({
        maxRequests: 10,
        windowMs: 300000, // 5 minutes
        keyType: 'user',
        errorMessage: 'Bulk operations rate limit exceeded',
        logType: 'bulk_ops'
    }),

    // Archive cleanup rate limiter (very strict - compliance critical)
    cleanupRateLimit: rateLimit({
        maxRequests: 2,
        windowMs: 3600000, // 1 hour
        keyType: 'user',
        errorMessage: 'Archive cleanup rate limit exceeded - this is a critical operation',
        logType: 'cleanup'
    }),

    // ============================================
    // SEARCH & REPORTING RATE LIMITERS
    // ============================================

    // Search operations rate limiter
    searchRateLimit: rateLimit({
        maxRequests: 200,
        windowMs: 60000, // 1 minute
        keyType: 'user',
        errorMessage: 'Search rate limit exceeded',
        logType: 'search'
    }),

    // Statistics and reporting rate limiter
    reportingRateLimit: rateLimit({
        maxRequests: 30,
        windowMs: 60000, // 1 minute
        keyType: 'user',
        errorMessage: 'Reporting rate limit exceeded',
        logType: 'reporting'
    }),

    // Dashboard data rate limiter (frequent polling expected)
    dashboardRateLimit: rateLimit({
        maxRequests: 500,
        windowMs: 60000, // 1 minute
        keyType: 'user',
        errorMessage: 'Dashboard refresh rate limit exceeded',
        logType: 'dashboard'
    }),

    // ============================================
    // EMERGENCY BYPASS RATE LIMITER
    // ============================================

    // Emergency operations (very permissive but logged)
    emergencyRateLimit: rateLimit({
        maxRequests: 1000,
        windowMs: 60000, // 1 minute
        keyType: 'user',
        errorMessage: 'Even emergency operations have limits',
        logType: 'emergency'
    })
};