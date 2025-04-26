// middleware/errorHandler.js
const logService = require('../services/logService');
const { NODE_ENV } = require('../config/environment');

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

    // Handle specific error types
    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: err.errors.map(e => ({
                field: e.path,
                message: e.message
            }))
        });
    }

    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            success: false,
            message: 'Resource already exists'
        });
    }

    if (err.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid reference to a related resource'
        });
    }

    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }

    // Default error response
    const statusCode = err.statusCode || 500;
    const errorMessage = statusCode === 500 ?
        'Internal server error' : // Generic message for 500 errors
        err.message || 'Something went wrong';

    res.status(statusCode).json({
        success: false,
        message: errorMessage,
        // Only include error details in non-production environments
        ...(NODE_ENV !== 'production' && {
            error: {
                name: err.name,
                message: err.message,
                stack: err.stack
            }
        })
    });
};

module.exports = errorHandler;