// config/environment.js
require('dotenv').config();

/**
 * Environment configuration variables with secure defaults
 */
module.exports = {
    // Node environment
    NODE_ENV: process.env.NODE_ENV || 'development',

    // Server config
    PORT: process.env.PORT || 4000,
    HOST: process.env.HOST || 'localhost',
    BASE_URL: process.env.BASE_URL || 'http://localhost:4000',
    FRONTEND_URL: process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:4000',
    SUPPORT_URL: process.env.SUPPORT_URL || 'https://portal.bourg.dev',

    // Database config
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || 5432,
    DB_NAME: process.env.DB_NAME || 'security_auth',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    DB_SSL: process.env.DB_SSL === 'true',

    // JWT config
    ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'change-me-in-production-access',
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'change-me-in-production-refresh',
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY || '15m',
    ACCESS_TOKEN_COOKIE_EXPIRY: process.env.ACCESS_TOKEN_COOKIE_EXPIRY ||'86400',
    REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY || '7d',

    // Security config
    PEPPER: process.env.PEPPER || 'change-me-in-production-pepper',
    CRYPTO_SECRET: process.env.CRYPTO_SECRET || 'change-me-in-production-crypto-32chars',
    LOG_ENCRYPTION_ENABLED: process.env.LOG_ENCRYPTION_ENABLED === 'true',
    REFERENCE_CODE_EXPIRY_DAYS: parseInt(process.env.REFERENCE_CODE_EXPIRY_DAYS || '7'),

    // CORS config
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

    // Email config
    EMAIL_FROM: process.env.EMAIL_FROM || 'security@example.com',
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'ePick System',
    REPLY_TO: process.env.REPLY_TO || 'info@example.com',
    EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.example.com',
    EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587'),
    EMAIL_USER: process.env.EMAIL_USER || '',
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
    EMAIL_SECURE: process.env.EMAIL_SECURE === 'true',

    // Validation settings
    PASSWORD_MIN_LENGTH: parseInt(process.env.PASSWORD_MIN_LENGTH || '12'),
    PASSWORD_REQUIRE_UPPERCASE: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    PASSWORD_REQUIRE_LOWERCASE: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    PASSWORD_REQUIRE_NUMBER: process.env.PASSWORD_REQUIRE_NUMBER !== 'false',
    PASSWORD_REQUIRE_SYMBOL: process.env.PASSWORD_REQUIRE_SYMBOL !== 'false',

    // Session settings
    SESSION_DEVICE_BINDING: process.env.SESSION_DEVICE_BINDING === 'true',

    // GitHub Integration config
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
    GITHUB_OWNER: process.env.GITHUB_OWNER || '',
    GITHUB_REPO: process.env.GITHUB_REPO || '',
    GITHUB_SYNC_ENABLED: process.env.GITHUB_SYNC_ENABLED === 'true',
    GITHUB_SYNC_INTERVAL: parseInt(process.env.GITHUB_SYNC_INTERVAL || '3600000'), // 1 hour in ms
    GITHUB_AUTO_PUBLISH: process.env.GITHUB_AUTO_PUBLISH === 'true'
};