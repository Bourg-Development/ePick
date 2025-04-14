const logger = require('../config/logger').getComponentLogger('server');

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

module.exports = loggerMiddleware;