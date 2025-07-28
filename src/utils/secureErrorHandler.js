// utils/secureErrorHandler.js

const logger = require('./logger');
const { NODE_ENV } = require('../config/environment');

/**
 * Secure error handler utility that prevents information disclosure
 * Provides generic messages to clients while logging details server-side
 */
class SecureErrorHandler {
    constructor() {
        // Generic error messages that don't reveal system state
        this.genericMessages = {
            // Authentication errors
            'auth.invalid_credentials': 'Invalid credentials',
            'auth.session_expired': 'Session expired',
            'auth.token_invalid': 'Authentication failed',
            'auth.token_expired': 'Authentication failed',
            'auth.blacklisted_token': 'Authentication failed',
            'auth.device_mismatch': 'Authentication failed',
            'auth.session_invalid': 'Authentication failed',
            'auth.unauthorized': 'Unauthorized',
            
            // Authorization errors
            'authz.permission_denied': 'Access denied',
            'authz.role_required': 'Access denied',
            'authz.insufficient_privileges': 'Access denied',
            
            // Validation errors
            'validation.invalid_input': 'Invalid input',
            'validation.missing_field': 'Required field missing',
            'validation.invalid_format': 'Invalid format',
            
            // Resource errors
            'resource.not_found': 'Resource not found',
            'resource.already_exists': 'Resource already exists',
            'resource.conflict': 'Operation could not be completed',
            
            // Rate limiting
            'rate_limit.exceeded': 'Too many requests',
            
            // General errors
            'server.internal_error': 'An error occurred',
            'server.service_unavailable': 'Service temporarily unavailable',
            'server.database_error': 'An error occurred',
            'server.external_service_error': 'An error occurred'
        };
        
        // Error codes that should trigger security logging
        this.securityConcerns = new Set([
            'auth.blacklisted_token',
            'auth.device_mismatch',
            'authz.permission_denied',
            'rate_limit.exceeded'
        ]);
    }

    /**
     * Handle an error securely
     * @param {Error|Object} error - The error to handle
     * @param {Object} req - Express request object
     * @param {Object} context - Additional context for logging
     * @returns {Object} Safe error response
     */
    handleError(error, req = null, context = {}) {
        // Determine error code and details
        const errorCode = this.getErrorCode(error);
        const errorDetails = this.extractErrorDetails(error);
        
        // Get generic message
        const genericMessage = this.genericMessages[errorCode] || this.genericMessages['server.internal_error'];
        
        // Log detailed error server-side
        this.logError(errorCode, errorDetails, req, context);
        
        // Check if this is a security concern
        if (this.securityConcerns.has(errorCode)) {
            this.logSecurityEvent(errorCode, errorDetails, req, context);
        }
        
        // Return safe response
        return {
            success: false,
            message: genericMessage,
            // Only include error code in development
            ...(NODE_ENV === 'development' && { errorCode, details: errorDetails })
        };
    }

    /**
     * Handle authentication errors specifically
     * @param {string} specificError - Specific error type
     * @param {Object} req - Express request object
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Safe error response
     */
    handleAuthError(specificError, req, metadata = {}) {
        // Map specific errors to generic codes
        const errorMap = {
            'token_expired': 'auth.token_expired',
            'token_invalid': 'auth.token_invalid',
            'blacklisted_token': 'auth.blacklisted_token',
            'device_mismatch': 'auth.device_mismatch',
            'session_invalid': 'auth.session_invalid',
            'invalid_credentials': 'auth.invalid_credentials'
        };
        
        const errorCode = errorMap[specificError] || 'auth.unauthorized';
        
        return this.handleError(
            { code: errorCode, type: 'AuthenticationError' },
            req,
            { specificError, ...metadata }
        );
    }

    /**
     * Get error code from various error types
     * @param {Error|Object} error
     * @returns {string} Error code
     */
    getErrorCode(error) {
        // Check for explicit error code
        if (error.code) return error.code;
        
        // Check for common error types
        if (error.name === 'ValidationError') return 'validation.invalid_input';
        if (error.name === 'UnauthorizedError') return 'auth.unauthorized';
        if (error.name === 'ForbiddenError') return 'authz.permission_denied';
        if (error.name === 'NotFoundError') return 'resource.not_found';
        if (error.name === 'ConflictError') return 'resource.conflict';
        if (error.name === 'RateLimitError') return 'rate_limit.exceeded';
        
        // Database errors
        if (error.name === 'SequelizeValidationError') return 'validation.invalid_input';
        if (error.name === 'SequelizeUniqueConstraintError') return 'resource.already_exists';
        if (error.name === 'SequelizeDatabaseError') return 'server.database_error';
        
        return 'server.internal_error';
    }

    /**
     * Extract safe error details for logging
     * @param {Error|Object} error
     * @returns {Object} Error details
     */
    extractErrorDetails(error) {
        const details = {
            name: error.name || 'Error',
            message: error.message || 'Unknown error',
            stack: NODE_ENV === 'development' ? error.stack : undefined
        };
        
        // Add any safe additional properties
        if (error.statusCode) details.statusCode = error.statusCode;
        if (error.type) details.type = error.type;
        
        // Never include sensitive fields
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'salt', 'hash'];
        Object.keys(error).forEach(key => {
            if (!sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                details[key] = error[key];
            }
        });
        
        return details;
    }

    /**
     * Log error details server-side
     * @param {string} errorCode
     * @param {Object} errorDetails
     * @param {Object} req
     * @param {Object} context
     */
    logError(errorCode, errorDetails, req, context) {
        const logData = {
            errorCode,
            ...errorDetails,
            context,
            request: req ? {
                method: req.method,
                path: req.path,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                userId: req.auth?.userId
            } : null,
            timestamp: new Date().toISOString()
        };
        
        // Log based on error severity
        if (errorCode.startsWith('server.')) {
            logger.error('Server error occurred', logData);
        } else if (errorCode.startsWith('auth.') || errorCode.startsWith('authz.')) {
            logger.warn('Authentication/Authorization error', logData);
        } else {
            logger.info('Client error', logData);
        }
    }

    /**
     * Log security-related events
     * @param {string} errorCode
     * @param {Object} errorDetails
     * @param {Object} req
     * @param {Object} context
     */
    async logSecurityEvent(errorCode, errorDetails, req, context) {
        try {
            const logService = require('../services/logService');
            await logService.securityLog({
                eventType: errorCode.replace('.', '_'),
                severity: this.getSecuritySeverity(errorCode),
                userId: req?.auth?.userId || null,
                ipAddress: req?.ip || 'unknown',
                deviceFingerprint: req?.headers['x-device-fingerprint'] || null,
                metadata: {
                    ...errorDetails,
                    ...context,
                    userAgent: req?.headers['user-agent'] || 'unknown'
                }
            });
        } catch (logError) {
            // Don't let logging failures affect the response
            logger.error('Failed to log security event', { errorCode, logError });
        }
    }

    /**
     * Get security severity for an error code
     * @param {string} errorCode
     * @returns {string} Severity level
     */
    getSecuritySeverity(errorCode) {
        const severityMap = {
            'auth.blacklisted_token': 'medium',
            'auth.device_mismatch': 'high',
            'authz.permission_denied': 'medium',
            'rate_limit.exceeded': 'low'
        };
        return severityMap[errorCode] || 'low';
    }

    /**
     * Create a safe API response for errors
     * @param {Error|Object} error
     * @param {Object} req
     * @returns {Object} API response
     */
    createApiResponse(error, req = null) {
        const handled = this.handleError(error, req);
        
        // Determine HTTP status code
        let statusCode = 500;
        const errorCode = this.getErrorCode(error);
        
        if (errorCode.startsWith('auth.')) statusCode = 401;
        else if (errorCode.startsWith('authz.')) statusCode = 403;
        else if (errorCode.startsWith('validation.')) statusCode = 400;
        else if (errorCode === 'resource.not_found') statusCode = 404;
        else if (errorCode === 'resource.conflict') statusCode = 409;
        else if (errorCode === 'rate_limit.exceeded') statusCode = 429;
        
        return {
            statusCode,
            body: handled
        };
    }
}

module.exports = new SecureErrorHandler();