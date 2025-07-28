// utils/urlValidator.js

/**
 * URL validation utilities to prevent open redirect attacks
 * Validates that redirect URLs are safe and belong to trusted domains
 */

const { BASE_URL, FRONTEND_URL } = require('../config/environment');

/**
 * List of trusted domains and paths for redirects
 * These are the only URLs that the application will redirect to
 */
const TRUSTED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    '::1'
];

/**
 * List of trusted paths for internal redirects
 * These paths are allowed for same-origin redirects
 */
const TRUSTED_PATHS = [
    '/restricted/dashboard',
    '/restricted/dashboard/',
    '/restricted/dashboard/analyses',
    '/restricted/dashboard/users', 
    '/restricted/dashboard/archive',
    '/restricted/dashboard/security',
    '/user/profile',
    '/user/account',
    '/user/privacy',
    '/user/integrations',
    '/user/notifications',
    '/auth/login',
    '/auth/register'
];

/**
 * Get trusted domains from environment configuration
 * @returns {Array<string>} Array of trusted domain names
 */
function getTrustedDomains() {
    const domains = [...TRUSTED_DOMAINS];
    
    try {
        // Extract domain from BASE_URL
        if (BASE_URL) {
            const baseUrl = new URL(BASE_URL);
            if (!domains.includes(baseUrl.hostname)) {
                domains.push(baseUrl.hostname);
            }
        }
        
        // Extract domain from FRONTEND_URL
        if (FRONTEND_URL && FRONTEND_URL !== BASE_URL) {
            const frontendUrl = new URL(FRONTEND_URL);
            if (!domains.includes(frontendUrl.hostname)) {
                domains.push(frontendUrl.hostname);
            }
        }
    } catch (error) {
        console.warn('URL Validator: Error parsing environment URLs:', error.message);
    }
    
    return domains;
}

/**
 * Validates if a URL is safe for redirects
 * @param {string} url - URL to validate
 * @param {string} baseUrl - Base URL of the current request
 * @returns {object} Validation result with details
 */
function validateRedirectUrl(url, baseUrl = BASE_URL) {
    if (!url || typeof url !== 'string') {
        return {
            valid: false,
            reason: 'URL is required and must be a string',
            sanitized: null
        };
    }

    // Remove any potential whitespace and normalize
    const trimmedUrl = url.trim();
    
    if (!trimmedUrl) {
        return {
            valid: false,
            reason: 'URL cannot be empty',
            sanitized: null
        };
    }

    try {
        // Handle relative URLs (most common case)
        if (trimmedUrl.startsWith('/')) {
            // Check for path traversal attempts
            if (trimmedUrl.includes('..') || trimmedUrl.includes('//') || trimmedUrl.includes('\0')) {
                return {
                    valid: false,
                    reason: 'Path contains potentially dangerous sequences (path traversal)',
                    sanitized: null
                };
            }
            
            // Normalize path by removing any double slashes or other anomalies
            const normalizedPath = trimmedUrl.replace(/\/+/g, '/');
            
            // Validate against trusted paths
            const isPathTrusted = TRUSTED_PATHS.some(trustedPath => {
                return normalizedPath === trustedPath || 
                       normalizedPath.startsWith(trustedPath + '/') ||
                       normalizedPath.startsWith(trustedPath + '?');
            });
            
            if (!isPathTrusted) {
                return {
                    valid: false,
                    reason: `Path '${normalizedPath}' is not in the list of trusted paths`,
                    sanitized: null
                };
            }
            
            return {
                valid: true,
                reason: 'Valid relative URL to trusted path',
                sanitized: normalizedPath
            };
        }
        
        // Handle absolute URLs
        const parsedUrl = new URL(trimmedUrl);
        const trustedDomains = getTrustedDomains();
        
        // Check protocol (only allow http and https)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return {
                valid: false,
                reason: `Protocol '${parsedUrl.protocol}' is not allowed`,
                sanitized: null
            };
        }
        
        // Check if domain is trusted
        if (!trustedDomains.includes(parsedUrl.hostname)) {
            return {
                valid: false,
                reason: `Domain '${parsedUrl.hostname}' is not in the list of trusted domains`,
                sanitized: null
            };
        }
        
        // Additional security checks
        if (parsedUrl.username || parsedUrl.password) {
            return {
                valid: false,
                reason: 'URLs with credentials are not allowed',
                sanitized: null
            };
        }
        
        return {
            valid: true,
            reason: 'Valid absolute URL to trusted domain',
            sanitized: trimmedUrl
        };
        
    } catch (error) {
        return {
            valid: false,
            reason: `Invalid URL format: ${error.message}`,
            sanitized: null
        };
    }
}

/**
 * Gets a safe default redirect URL for the current user
 * @param {object} user - User object with role information
 * @returns {string} Safe default redirect URL
 */
function getDefaultRedirectUrl(user = null) {
    // Default to dashboard for authenticated users
    if (user) {
        return '/restricted/dashboard';
    }
    
    // Default to login for unauthenticated users
    return '/auth/login';
}

/**
 * Sanitizes and validates a redirect URL, providing a safe fallback
 * @param {string} url - URL to validate and sanitize
 * @param {object} user - Current user object (optional)
 * @param {string} fallback - Custom fallback URL (optional)
 * @returns {object} Result with validated URL
 */
function safeRedirectUrl(url, user = null, fallback = null) {
    const validation = validateRedirectUrl(url);
    
    if (validation.valid) {
        return {
            url: validation.sanitized,
            isFallback: false,
            reason: validation.reason
        };
    }
    
    // Use provided fallback or get default
    const safeUrl = fallback || getDefaultRedirectUrl(user);
    
    return {
        url: safeUrl,
        isFallback: true,
        reason: `Original URL rejected (${validation.reason}), using safe fallback`
    };
}

/**
 * Middleware to validate redirect parameters in requests
 * @param {string} paramName - Name of the redirect parameter (default: 'redirect')
 * @returns {Function} Express middleware function
 */
function validateRedirectMiddleware(paramName = 'redirect') {
    return (req, res, next) => {
        const redirectUrl = req.query[paramName] || req.body[paramName];
        
        if (redirectUrl) {
            const validation = validateRedirectUrl(redirectUrl);
            
            if (!validation.valid) {
                // Log the security attempt
                console.warn('Security: Invalid redirect URL attempted:', {
                    url: redirectUrl,
                    reason: validation.reason,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    user: req.auth?.userId || 'anonymous'
                });
                
                // Remove the invalid redirect parameter
                delete req.query[paramName];
                delete req.body[paramName];
                
                // Optionally add a warning header
                res.set('X-Redirect-Warning', 'Invalid redirect URL removed');
            }
        }
        
        next();
    };
}

module.exports = {
    validateRedirectUrl,
    safeRedirectUrl,
    getDefaultRedirectUrl,
    validateRedirectMiddleware,
    getTrustedDomains,
    TRUSTED_PATHS,
    TRUSTED_DOMAINS
};