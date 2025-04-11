const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Custom format to display component prominently
const customFormat = winston.format.printf(({ timestamp, level, message, component, ...meta }) => {
    // Remove component from meta if it exists
    const metaStr = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : '';

    // Format with component highlighted
    return component
        ? `${timestamp} [${level}] [${component}]: ${message}${metaStr}`
        : `${timestamp} [${level}]: ${message}${metaStr}`;
});

// Create the basic logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        // For file transports, use JSON format
        winston.format.json()
    ),
    defaultMeta: { service: 'med-track' }, // Change this to your app name
    transports: [
        // Write to all logs with level `info` and below to `combined.log`
        new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
        // Write all logs error (and below) to `error.log`
        new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' })
    ]
});

// If we're not in production then log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            customFormat // Use our custom format for console
        )
    }));
}

// Simple function to create a component logger
function getComponentLogger(component) {
    return {
        error: (message, meta = {}) => logger.error(message, { component, ...meta }),
        warn: (message, meta = {}) => logger.warn(message, { component, ...meta }),
        info: (message, meta = {}) => logger.info(message, { component, ...meta }),
        http: (message, meta = {}) => logger.http(message, { component, ...meta }),
        verbose: (message, meta = {}) => logger.verbose(message, { component, ...meta }),
        debug: (message, meta = {}) => logger.debug(message, { component, ...meta }),
        silly: (message, meta = {}) => logger.silly(message, { component, ...meta })
    };
}

// Simple Express middleware for logging requests
function loggerMiddleware(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
        const responseTime = Date.now() - start;
        logger.info(`${req.method} ${req.url}`, {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime
        });
    });
    next();
}

module.exports = { logger, getComponentLogger, loggerMiddleware };