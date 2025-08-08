// middleware/authentication.js
const tokenService = require('../services/tokenService');
const deviceFingerprintUtil = require('../utils/deviceFingerprint');
const logService = require('../services/logService');
const db = require('../db');
const { ACCESS_TOKEN_COOKIE_EXPIRY } = require('../config/environment')
const { Op } = require('sequelize');
const { validateRedirectUrl } = require('../utils/urlValidator');
const secureErrorHandler = require('../utils/secureErrorHandler');

/**
 * Helper function to create safe redirect URL for token refresh
 * Validates the original URL to prevent open redirect attacks
 */
const createSafeRedirectUrl = (originalUrl) => {
    // Validate the original URL
    const validation = validateRedirectUrl(originalUrl);
    
    if (validation.valid) {
        return `/api/auth/refresh-token?redirect=${encodeURIComponent(validation.sanitized)}`;
    }
    
    // If URL is invalid, redirect to token refresh without redirect parameter
    // This will default to the dashboard after successful token refresh
    return `/api/auth/refresh-token`;
};

/**
 * Helper function to clear authentication cookies
 */
const clearAuthCookies = (res) => {
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh-token'
    });
};

/**
 * Authentication middleware
 * Verifies JWT tokens and sets user authentication context
 */
const authenticate = async (req, res, next) => {
    // Authentication middleware running

    try {
        // Extract token from headers
        const token = req.cookies.accessToken; // or similar code to extract the token
        if (!token) {
            // Check if this is an API request or expects JSON response
            const isApiRequest = req.path.startsWith('/api/') || 
                                req.headers.accept?.includes('application/json') ||
                                req.headers['content-type']?.includes('application/json');
            
            if (isApiRequest) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                    error: 'no_token',
                    redirectTo: '/auth/login'
                });
            }
            
            return res.status(401).redirect('/auth/login');
        }

        let decoded;

        try{
            decoded = await tokenService.verifyToken(token, 'access');
        }catch (e) {
            // Handle token verification error securely
            const errorResponse = secureErrorHandler.handleAuthError('token_invalid', req, {
                tokenPresent: !!token,
                verificationError: e.message
            });
            
            if (req.headers.accept?.includes('text/html')) {
                return res.redirect(createSafeRedirectUrl(req.originalUrl));
            }
            return res.status(401).json(errorResponse);
        }

        // Check if the token is blacklisted
        const blacklistedToken = await db.BlacklistedToken.findOne({
            where: { token_id: decoded.id }
        });

        if (blacklistedToken) {
            // Clear authentication cookies
            clearAuthCookies(res);
            
            // Log the attempt to use a blacklisted token
            await logService.securityLog({
                eventType: 'auth.blacklisted_token_used',
                severity: 'medium',
                userId: decoded.userId,
                ipAddress: req.ip,
                metadata: {
                    tokenId: decoded.id,
                    reason: blacklistedToken.reason,
                    userAgent: req.headers['user-agent'] || 'unknown'
                }
            });

            const errorResponse = secureErrorHandler.handleAuthError('blacklisted_token', req, {
                tokenId: decoded.id,
                reason: blacklistedToken.reason
            });
            
            if (req.headers.accept?.includes('text/html')) {
                return res.redirect('/auth/login?error=session_expired')
            }
            return res.status(401).json(errorResponse);
        }



        // Extract device fingerprint
        const deviceFingerprint = deviceFingerprintUtil.getFingerprint(req);
        // Verify session is still valid and not expired
        const session = await db.Session.findOne({
            where: {
                token_id: decoded.id,
                user_id: decoded.userId,
                is_valid: true,
                expires_at: { [Op.gt]: new Date() } // Check session hasn't expired
            }
        });

        if (!session) {
            const errorResponse = secureErrorHandler.handleAuthError('session_invalid', req, {
                tokenId: decoded.id,
                userId: decoded.userId
            });
            
            if (req.headers.accept?.includes('text/html')) {
                return res.redirect(`/api/auth/refresh-token?redirect=${encodeURIComponent(req.originalUrl)}`)
            }
            return res.status(401).json(errorResponse);
        }

        // Enhanced device fingerprint validation with anti-spoofing
        if (session.device_fingerprint) {
            // Use secure validation that checks against server calculation
            const isValidFingerprint = deviceFingerprintUtil.validateFingerprint(
                deviceFingerprint,
                session.device_fingerprint,
                false, // Non-strict mode allows minor variations
                req   // Pass request for secure validation
            );
            
            if (!isValidFingerprint) {
                // Get detailed validation info for logging
                const secureFingerprint = require('../utils/secureDeviceFingerprint');
                const validation = secureFingerprint.validateWithSession(
                    req,
                    deviceFingerprint,
                    session
                );
                
                // Log security event with detailed information
                await logService.securityLog({
                    eventType: validation.securityConcern || 'session.device_mismatch',
                    severity: validation.securityConcern === 'possible_session_hijack' ? 'critical' : 'high',
                    userId: decoded.userId,
                    ipAddress: req.ip,
                    deviceFingerprint,
                    metadata: {
                        userAgent: req.headers['user-agent'] || 'unknown',
                        tokenId: decoded.id,
                        expectedDevice: session.device_fingerprint.substring(0, 16) + '...',
                        providedDevice: deviceFingerprint.substring(0, 16) + '...',
                        similarity: validation.similarity,
                        reason: validation.reason,
                        suspicious: validation.suspicious,
                        securityChecks: validation.securityChecks
                    }
                });
                
                // Invalidate session if this looks like a hijack attempt
                if (validation.securityConcern === 'possible_session_hijack') {
                    session.is_valid = false;
                    session.invalidated_at = new Date();
                    session.invalidation_reason = 'security_violation_device_hijack';
                    await session.save();
                }
                
                const errorResponse = secureErrorHandler.handleAuthError('device_mismatch', req, {
                    expectedDevice: session.device_fingerprint.substring(0, 16) + '...',
                    providedDevice: deviceFingerprint.substring(0, 16) + '...',
                    similarity: validation.similarity,
                    reason: validation.reason,
                    securityConcern: validation.securityConcern
                });
                
                return res.status(401).json(errorResponse);
            }
        }

        // Store auth info temporarily
        const authInfo = {
            userId: decoded.userId,
            username: decoded.username,
            role: decoded.role,
            permissions: decoded.permissions || [],
            tokenId: decoded.id,
            sessionId: session.id
        };

        // Only rotate token if it's close to expiry (within 15 minutes) and not recently rotated
        const now = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = decoded.exp - now;
        const shouldRotate = timeUntilExpiry < 900; // Less than 15 minutes until expiry

        if (shouldRotate) {
            try {
                // Check if this token was recently rotated (prevent race conditions)
                const recentRotation = await tokenService.checkRecentRotation(decoded.id);
                
                if (!recentRotation) {
                    const newToken = await tokenService.rotateAccessToken(token, { req });

                    // Set the new token in a cookie
                    res.cookie('accessToken', newToken.token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict',
                        maxAge: ACCESS_TOKEN_COOKIE_EXPIRY * 1000,
                        path: '/'
                    });

                    // Update auth info with new token ID
                    authInfo.tokenId = newToken.id;
                    // Token rotated successfully
                }
            } catch (error) {
                // Token rotation failed, continuing with existing token
                // Continue with existing token if rotation fails
            }
        } else {
            // Update session last activity without rotating token
            try {
                await session.update({ last_activity: new Date() });
            } catch (error) {
                // Failed to update session activity
            }
        }



        req.auth = authInfo;
        res.locals.permissions = authInfo.permissions;
        res.locals.role = authInfo.role;

        return next();
    } catch (error) {
        // Authentication middleware error occurred
        const errorResponse = secureErrorHandler.handleError(error, req, {
            middlewareFunction: 'authenticate',
            path: req.path
        });
        return res.status(401).json(errorResponse);
    }
};

const nonAuth = async (req, res, next) => {
    const token = req.cookies.accessToken; // or similar code to extract the token
    if(!token) return next();
    let decoded;

    try{
        decoded = await tokenService.verifyToken(token, 'access');
    }catch (e) {
        if(e.code === 'TOKEN_EXPIRED') {
            // If accessing login/register pages with expired token, just clear cookies and continue
            if (req.path === '/auth/login' || req.path === '/auth/register') {
                clearAuthCookies(res);
                return next();
            }
            
            const errorResponse = secureErrorHandler.handleAuthError('token_expired', req, {
                tokenPresent: !!token,
                path: req.path
            });
            
            if (req.headers.accept?.includes('text/html')) {
                return res.redirect(`/api/auth/refresh-token?redirect=${encodeURIComponent(req.originalUrl)}`)
            }
            return res.status(401).json(errorResponse);
        }
        // Token verification error in nonAuth middleware
        return res.status(401).render('errors/unauthorized', { type: 'noAuth', layout: 'layouts/auth', title: '401 | Auth required' } );
    }

    // Check if the token is blacklisted
    const blacklistedToken = await db.BlacklistedToken.findOne({
        where: { token_id: decoded.id }
    });

    if (blacklistedToken) {
        // Clear authentication cookies
        clearAuthCookies(res);
        
        // Log the attempt to use a blacklisted token
        await logService.securityLog({
            eventType: 'auth.blacklisted_token_used',
            severity: 'medium',
            userId: decoded.userId,
            ipAddress: req.ip,
            metadata: {
                tokenId: decoded.id,
                reason: blacklistedToken.reason,
                userAgent: req.headers['user-agent'] || 'unknown'
            }
        });

        return next(); // Continue without authentication
    }



    // Verify session is still valid
    const session = await db.Session.findOne({
        where: {
            token_id: decoded.id,
            user_id: decoded.userId,
            is_valid: true
        }
    });

    if (!session) return next();
    return res.redirect('/restricted/dashboard');
}

// Optional authentication - sets req.auth if user is authenticated, but doesn't require it
const optionalAuth = async (req, res, next) => {
    const token = req.cookies.accessToken;
    
    if (!token) {
        // No token provided, continue without authentication
        req.auth = null;
        return next();
    }
    
    try {
        const decoded = await tokenService.verifyToken(token, 'access');
        
        // Check if the token is blacklisted
        const blacklistedToken = await db.BlacklistedToken.findOne({
            where: { token_id: decoded.id }
        });

        if (blacklistedToken) {
            // Clear authentication cookies
            clearAuthCookies(res);
            
            // Log the attempt to use a blacklisted token
            await logService.securityLog({
                eventType: 'auth.blacklisted_token_used',
                severity: 'medium',
                userId: decoded.userId,
                ipAddress: req.ip,
                metadata: {
                    tokenId: decoded.id,
                    reason: blacklistedToken.reason,
                    userAgent: req.headers['user-agent'] || 'unknown'
                }
            });

            req.auth = null;
            return next();
        }
        
        // Verify session is still valid
        const session = await db.Session.findOne({
            where: {
                token_id: decoded.id,
                user_id: decoded.userId,
                is_valid: true
            }
        });
        
        if (!session) {
            // Invalid session, continue without authentication
            req.auth = null;
            return next();
        }
        
        // Get user with role and permissions
        const user = await db.User.findByPk(decoded.userId, {
            include: [{
                model: db.Role,
                as: 'role',
                include: [{
                    model: db.Permission,
                    as: 'permissions'
                }]
            }]
        });
        
        if (!user) {
            req.auth = null;
            return next();
        }
        
        // Set authentication info
        req.auth = {
            userId: user.id,
            username: user.username,
            role: user.role.name,
            permissions: user.role.permissions.map(p => p.name)
        };
        
        res.locals.permissions = req.auth.permissions;
        res.locals.role = req.auth.role;
        
        return next();
    } catch (error) {
        // Authentication failed, continue without authentication
        req.auth = null;
        return next();
    }
};

module.exports = { authenticate, nonAuth, optionalAuth, clearAuthCookies };