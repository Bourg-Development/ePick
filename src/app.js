// app.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const path = require("node:path");
const expressLayouts = require('express-ejs-layouts')
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const indexRoutes = require('./routes/indexRoutes');
const restrictedRoutes = require('./routes/restrictedRoutes');
const errorHandler = require('./middleware/errorHandler');
const logService = require('./services/logService');
const { NODE_ENV, CORS_ORIGIN } = require('./config/environment');

const authMiddleware = require('./middleware/authentication');


// Create Express app
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))
app.set('layout', 'layouts/public');

// Request ID middleware
app.use((req, res, next) => {
    req.id = uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
});

// Pass current URL path to frontend
app.use((req, res, next) => {
    res.locals.path = req.originalUrl;
    next();
})

// Security headers
app.use(helmet({
    contentSecurityPolicy: NODE_ENV !== 'development'
}));

// CORS configuration
const corsOptions = {
    origin: CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Fingerprint'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Request body parsing
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Layouts
app.use(expressLayouts);

// Cookie parsing
app.use(cookieParser());

// Compression
app.use(compression());

// Global rate limiter (applies to all routes)
const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => NODE_ENV === 'development', // Skip in development
    handler: (req, res) => {
        // Log rate limit violation
        logService.securityLog({
            eventType: 'ratelimit.global_exceeded',
            severity: 'medium',
            ipAddress: req.ip,
            deviceFingerprint: req.get('X-Device-Fingerprint') || null,
            metadata: {
                path: req.path,
                method: req.method,
                userAgent: req.headers['user-agent'] || 'unknown'
            }
        });

        res.status(429).json({
            success: false,
            message: 'Too many requests, please try again later'
        });
    }
});

// Logging
if (NODE_ENV !== 'test') {
    // HTTP request logging
    app.use(morgan('[:date[iso]] :method :url :status :response-time ms - :res[content-length]'));

    // Setup request logging middleware
    app.use((req, res, next) => {
        // Capture original end function
        const originalEnd = res.end;

        // Start time of request
        const startTime = Date.now();

        // Override end function
        res.end = function() {
            // Calculate request duration
            const duration = Date.now() - startTime;
            // Log request if it's not a health check or static asset
            if (!req.originalUrl.startsWith('/health') && !req.originalUrl.startsWith('/static')) {
                if (res.statusCode >= 400 ||
                    req.originalUrl.includes('/auth/') ||
                    req.originalUrl.includes('/admin/')) {
                    logService.auditLog({
                        eventType: 'http.request',
                        userId: req.auth?.userId || null,
                        ipAddress: req.ip,
                        deviceFingerprint: req.get('X-Device-Fingerprint') || null,
                        metadata: {
                            method: req.method,
                            path: req.originalUrl, // <- updated
                            statusCode: res.statusCode,
                            duration,
                            userAgent: req.headers['user-agent'] || 'unknown',
                            requestId: req.id
                        }
                    }).catch(err => console.error('Request logging error:', err));
                }
            }
            // Call original end function
            return originalEnd.apply(this, arguments);
        };

        next();
    });
}

// Static content
app.use('/static', express.static(path.join(__dirname, 'public')))

// apply rate limiter to all non static content routes
app.use(globalRateLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/restricted', restrictedRoutes);
app.use('/', indexRoutes);


// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: 'Resource not found'
    });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;