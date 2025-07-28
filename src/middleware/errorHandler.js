// middleware/errorHandler.js
const logService = require('../services/logService');
const { NODE_ENV } = require('../config/environment');
const secureErrorHandler = require('../utils/secureErrorHandler');

/**
 * Global error handling middleware
 * Catches all unhandled errors in the application
 */
const errorHandler = async (err, req, res, next) => {
    // Log the error
    console.error('Unhandled error:', err);

    try {
        // Log to security logs
        await logService.securityLog({
            eventType: 'error.unhandled',
            severity: 'high',
            userId: req.auth?.userId || null,
            ipAddress: req.ip,
            deviceFingerprint: req.get('X-Device-Fingerprint') || null,
            metadata: {
                error: {
                    message: err.message,
                    stack: NODE_ENV === 'production' ? undefined : err.stack,
                    name: err.name,
                    code: err.code
                },
                path: req.path,
                method: req.method,
                userAgent: req.headers['user-agent'] || 'unknown',
                requestId: req.id
            }
        });
    } catch (logError) {
        // If logging fails, at least print to console
        console.error('Error logging failed:', logError);
    }

    // Use secure error handler for consistent, safe error responses
    const errorResponse = secureErrorHandler.createApiResponse(err, req);
    res.status(errorResponse.statusCode).json(errorResponse.body);
};

module.exports = errorHandler;