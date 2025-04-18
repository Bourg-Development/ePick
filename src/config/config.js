require('dotenv').config();
const crypto = require('crypto');
const logger = require('../config/logger').getComponentLogger('config')

// generate random secret if not provided
let jwtSecret = process.env.JWT_SECRET;
if(!jwtSecret){
    logger.warn('WARNING: JWT_SECRET not set in the environment variables. Using randomly generated secret.')
    logger.warn('This is fine for development but insecure for production, as restarts will invalidate tokens.');
    jwtSecret = crypto.randomBytes(64).toString('hex');
}

// generate random refresh token secret if not provided
let refreshSecret = process.env.REFRESH_TOKEN_SECRET;
if(!refreshSecret){
    logger.warn('WARNING: REFRESH_TOKEN_SECRET not set in the environment variables. Using randomly generated secret.')
    jwtSecret = crypto.randomBytes(64).toString('hex');
}

const env = {
    port: process.env.PORT || '3000',
    nodeEnv: process.env.NODE_ENV || 'development',

    // Auth secrets
    jwtSecret,
    jwtExpiry: process.env.JWT_EXPIRY || '5m',
    refreshTokenSecret: refreshSecret,
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d',
    saltRounds: parseInt(process.env.SALT_ROUNDS || '12', 10),

    // Reference code generation
    referenceCodeLength: 9, // Format xxx-xxx-xxx

    // Session management
    sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex'),

    // API rate limit
    rateLimit: {
        window: 15 * 60 * 1000, // 15 minutes
        max: 100,
        standardHeaders: true,
    },

    // Login attempts
    maxLoginAttempts: 5,
    loginLockoutTime: 30, // minutes

    // CORS
    corsOrigin: process.env.CORS_ORIGIN || '*',

    dbName: process.env.DB_NAME,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbHost: process.env.DB_HOST || 'localhost',
    dbPort: process.env.DB_PORT ||'5432',
    dbDialect: process.env.DB_DIALECT || 'postgres',

    // Cookie settings
    cookieSecret: process.env.COOKIE_SECRET || crypto.randomBytes(64).toString('hex'),
    cookieSecure: process.env.NODE_ENV === 'production',
    cookieSameSite: 'strict',

    // Security headers
    cspDirectives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "'data:'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'self'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"],
    },

    // Email service configuration
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,

    // Additional security settings
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecial: true,

    // Logging
    logLevel: process.env.LOG_LEVEL | 'info'
};

// Check required environment variables for production
if(env.nodeEnv === 'production'){
    const requiredEnvVars = [
        'JWT_SECRET',
        'REFRESH_TOKEN_SECRET',
        'SESSION_SECRET',
        'COOKIE_SECRET',
        'DB_NAME',
        'DB_USER',
        'DB_PASSWORD',
        'SMTP_HOST',
        'SMTP_USER',
        'SMTP_PASS'
    ];

    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

    if(missingEnvVars > 0){
        throw new Error(`The following environment variables are required in production: ${missingEnvVars.join(', ')}`);
    }
}


module.exports = env;