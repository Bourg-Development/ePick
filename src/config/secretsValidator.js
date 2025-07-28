// config/secretsValidator.js

/**
 * Validates that all required secrets are properly configured for production
 * Prevents application startup with insecure default values
 */

const crypto = require('crypto');

/**
 * Required secrets configuration with validation rules
 */
const REQUIRED_SECRETS = {
    ACCESS_TOKEN_SECRET: {
        required: true,
        minLength: 32,
        description: 'JWT access token signing secret'
    },
    REFRESH_TOKEN_SECRET: {
        required: true,
        minLength: 32,
        description: 'JWT refresh token signing secret'
    },
    PEPPER: {
        required: true,
        minLength: 16,
        description: 'Password hashing pepper value'
    },
    CRYPTO_SECRET: {
        required: true,
        minLength: 32,
        exactLength: 32,
        description: 'Data encryption secret (must be exactly 32 characters)'
    }
};

/**
 * Development-only fallback secrets (only used in development)
 */
const DEV_FALLBACKS = {
    ACCESS_TOKEN_SECRET: crypto.randomBytes(32).toString('hex'),
    REFRESH_TOKEN_SECRET: crypto.randomBytes(32).toString('hex'),
    PEPPER: crypto.randomBytes(16).toString('hex'),
    CRYPTO_SECRET: crypto.randomBytes(16).toString('hex') // 32 chars hex = 16 bytes
};

/**
 * Insecure default values that should never be used
 */
const INSECURE_DEFAULTS = [
    'change-me-in-production-access',
    'change-me-in-production-refresh', 
    'change-me-in-production-pepper',
    'change-me-in-production-crypto-32chars',
    'secret',
    'password',
    '123456',
    'default',
    'test'
];

/**
 * Validates a secret value against security requirements
 * @param {string} name - Secret name
 * @param {string} value - Secret value  
 * @param {object} rules - Validation rules
 * @returns {object} Validation result
 */
function validateSecret(name, value, rules) {
    const errors = [];
    const warnings = [];

    // Check if value exists
    if (!value) {
        if (rules.required) {
            errors.push(`${name} is required but not set`);
        }
        return { valid: false, errors, warnings };
    }

    // Check for insecure default values
    if (INSECURE_DEFAULTS.includes(value.toLowerCase())) {
        errors.push(`${name} is using an insecure default value`);
    }

    // Check minimum length
    if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${name} must be at least ${rules.minLength} characters long`);
    }

    // Check exact length
    if (rules.exactLength && value.length !== rules.exactLength) {
        errors.push(`${name} must be exactly ${rules.exactLength} characters long`);
    }

    // Check entropy (basic check for randomness)
    if (value.length >= 16) {
        const uniqueChars = new Set(value.toLowerCase()).size;
        const entropyRatio = uniqueChars / value.length;
        
        if (entropyRatio < 0.3) {
            warnings.push(`${name} appears to have low entropy (repeated characters)`);
        }
    }

    // Check for common patterns
    if (/^(.)\1+$/.test(value)) {
        errors.push(`${name} cannot be all the same character`);
    }

    if (/^(abc|123|qwerty|password)/i.test(value)) {
        errors.push(`${name} contains common insecure patterns`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Validates all required secrets and provides fallbacks for development
 * @param {string} nodeEnv - Current NODE_ENV
 * @returns {object} Validation result and secure config
 */
function validateAndProvideSecrets(nodeEnv = 'development') {
    const isProduction = nodeEnv === 'production';
    const isTest = nodeEnv === 'test';
    
    const results = {
        valid: true,
        errors: [],
        warnings: [],
        secrets: {}
    };

    // Validate each required secret
    for (const [name, rules] of Object.entries(REQUIRED_SECRETS)) {
        const envValue = process.env[name];
        const validation = validateSecret(name, envValue, rules);

        // For production, all secrets must be properly configured
        if (isProduction) {
            if (!validation.valid) {
                results.valid = false;
                results.errors.push(...validation.errors.map(err => `PRODUCTION: ${err}`));
            }
            results.warnings.push(...validation.warnings);
            results.secrets[name] = envValue;
        } 
        // For test environment, use simple test values
        else if (isTest) {
            results.secrets[name] = envValue || `test-${name.toLowerCase()}-${'x'.repeat(32)}`;
        }
        // For development, provide secure fallbacks with warnings
        else {
            if (!envValue) {
                results.warnings.push(
                    `DEVELOPMENT: ${name} not set, using generated fallback. ` +
                    `Set ${name} environment variable for production.`
                );
                results.secrets[name] = DEV_FALLBACKS[name];
            } else {
                // Still validate even in development
                if (!validation.valid) {
                    results.warnings.push(...validation.errors.map(err => `DEVELOPMENT: ${err}`));
                }
                results.warnings.push(...validation.warnings);
                results.secrets[name] = envValue;
            }
        }
    }

    return results;
}

/**
 * Logs validation results with appropriate severity
 * @param {object} results - Validation results
 */
function logValidationResults(results) {
    const logger = console; // Could be replaced with structured logger

    if (results.errors.length > 0) {
        logger.error('🔒 SECRET VALIDATION FAILED:');
        results.errors.forEach(error => logger.error(`   ❌ ${error}`));
        logger.error('');
        logger.error('🚨 APPLICATION CANNOT START WITH INSECURE SECRETS');
        logger.error('');
        logger.error('To fix this issue:');
        logger.error('1. Generate secure random secrets:');
        logger.error('   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
        logger.error('2. Set environment variables:');
        logger.error('   export ACCESS_TOKEN_SECRET="your-secure-secret-here"');
        logger.error('3. Use a secrets management system in production');
        logger.error('');
    }

    if (results.warnings.length > 0) {
        logger.warn('🔒 SECRET VALIDATION WARNINGS:');
        results.warnings.forEach(warning => logger.warn(`   ⚠️  ${warning}`));
        logger.warn('');
    }

    if (results.valid && results.errors.length === 0) {
        logger.info('🔒 Secret validation passed');
    }
}

/**
 * Main validation function - call this during application startup
 * @param {string} nodeEnv - Current NODE_ENV
 * @returns {object} Validated secrets configuration
 * @throws {Error} If validation fails in production
 */
function validateSecrets(nodeEnv = process.env.NODE_ENV || 'development') {
    const results = validateAndProvideSecrets(nodeEnv);
    
    logValidationResults(results);

    // Fail fast in production with insecure configuration
    if (!results.valid) {
        const error = new Error(
            'Security validation failed: Cannot start application with insecure secrets configuration. ' +
            'Please check the error messages above and configure proper secrets.'
        );
        error.code = 'INSECURE_SECRETS';
        throw error;
    }

    return results.secrets;
}

module.exports = {
    validateSecrets,
    validateSecret,
    REQUIRED_SECRETS,
    INSECURE_DEFAULTS
};