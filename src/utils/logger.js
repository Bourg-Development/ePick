// utils/logger.js
const winston = require('winston');
const { NODE_ENV } = require('../config/environment');

/**
 * Custom logger utility
 */
class Logger {
    constructor() {
        // Define log format
        const logFormat = winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.splat(),
            winston.format.json()
        );

        // Create logger with appropriate transports
        this.logger = winston.createLogger({
            level: NODE_ENV === 'production' ? 'info' : 'debug',
            format: logFormat,
            defaultMeta: { service: 'auth-system' },
            transports: [
                // Console logger
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.printf(
                            info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? `\n${info.stack}` : ''}`
                        )
                    )
                })
            ]
        });

        // Add file transports in production
        if (NODE_ENV === 'production') {
            this.logger.add(
                new winston.transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                    maxsize: 10485760, // 10MB
                    maxFiles: 10
                })
            );

            this.logger.add(
                new winston.transports.File({
                    filename: 'logs/combined.log',
                    maxsize: 10485760, // 10MB
                    maxFiles: 10
                })
            );
        }
    }

    /**
     * Log info message
     * @param {string} message - Log message
     * @param {Object} [meta] - Additional metadata
     */
    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    /**
     * Log debug message
     * @param {string} message - Log message
     * @param {Object} [meta] - Additional metadata
     */
    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    /**
     * Log warning message
     * @param {string} message - Log message
     * @param {Object} [meta] - Additional metadata
     */
    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    /**
     * Log error message
     * @param {string} message - Log message
     * @param {Error|Object} [error] - Error object or metadata
     */
    error(message, error = {}) {
        if (error instanceof Error) {
            this.logger.error(message, { error: error.message, stack: error.stack });
        } else {
            this.logger.error(message, error);
        }
    }

    /**
     * Log HTTP request
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {number} responseTime - Response time in ms
     */
    httpRequest(req, res, responseTime) {
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            responseTime: `${responseTime}ms`,
            contentLength: res.getHeader('content-length'),
            ip: req.ip,
            userAgent: req.headers['user-agent']
        };

        if (res.statusCode >= 400) {
            this.warn(`HTTP ${req.method} ${req.url} ${res.statusCode}`, logData);
        } else {
            this.info(`HTTP ${req.method} ${req.url} ${res.statusCode}`, logData);
        }
    }

    /**
     * Log security event
     * @param {string} event - Security event type
     * @param {string} severity - Severity level
     * @param {Object} [data] - Additional data
     */
    security(event, severity, data = {}) {
        this.logger.log({
            level: this._severityToLevel(severity),
            message: `SECURITY: ${event}`,
            event,
            severity,
            ...data
        });
    }

    /**
     * Map security severity to log level
     * @private
     * @param {string} severity - Security severity
     * @returns {string} Log level
     */
    _severityToLevel(severity) {
        switch (severity) {
            case 'critical':
                return 'error';
            case 'high':
                return 'error';
            case 'medium':
                return 'warn';
            case 'low':
                return 'info';
            default:
                return 'info';
        }
    }
}

module.exports = new Logger();