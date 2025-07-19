// middleware/authentication.js
const tokenService = require('../services/tokenService');
const deviceFingerprintUtil = require('../utils/deviceFingerprint');
const logService = require('../services/logService');
const db = require('../db');
const { ACCESS_TOKEN_COOKIE_EXPIRY } = require('../config/environment')
const { Op } = require('sequelize');

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
    console.log('Auth middleware running on:', req.path);
    console.log('Cookies in auth middleware:', req.cookies);

    try {
        // Extract token from headers
        const token = req.cookies.accessToken; // or similar code to extract the token
        if (!token) {
            return res.status(401).redirect('/auth/login')
        }

        let decoded;

        try{
            decoded = await tokenService.verifyToken(token, 'access');
        }catch (e) {
                if (req.headers.accept?.includes('text/html')) {
                    return res.redirect(`/api/auth/refresh-token?redirect=${encodeURIComponent(req.originalUrl)}`)
                }
                return res.status(401).json({ error: 'Your access token is invalid. You will now be redirected to refresh it.' })
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

            if (req.headers.accept?.includes('text/html')) {
                return res.redirect('/auth/login?error=session_expired')
            }
            return res.status(401).json({ 
                success: false, 
                message: 'Your session has been revoked. Please log in again.' 
            });
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
            if (req.headers.accept?.includes('text/html')) {
                return res.redirect(`/api/auth/refresh-token?redirect=${encodeURIComponent(req.originalUrl)}`)
            }
            return res.status(401).json({ error: 'Your session is invalid. You will now be redirected to refresh it.' })

        }

        // Optional: Verify device fingerprint if session has this feature enabled
        if (session.device_fingerprint &&
            session.device_fingerprint !== deviceFingerprint) {
            // Log potential token misuse
            await logService.securityLog({
                eventType: 'session.device_mismatch',
                severity: 'high',
                userId: decoded.userId,
                ipAddress: req.ip,
                deviceFingerprint,
                metadata: {
                    userAgent: req.headers['user-agent'] || 'unknown',
                    tokenId: decoded.id,
                    expectedDevice: session.device_fingerprint
                }
            });

            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
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
                    console.log('Token rotated for user:', decoded.userId);
                }
            } catch (error) {
                console.error('Token rotation failed:', error);
                // Continue with existing token if rotation fails
            }
        } else {
            // Update session last activity without rotating token
            try {
                await session.update({ last_activity: new Date() });
            } catch (error) {
                console.error('Failed to update session activity:', error);
            }
        }



        req.auth = authInfo;
        res.locals.permissions = authInfo.permissions;
        res.locals.role = authInfo.role;

        return next();
    } catch (error) {
        console.error('Authentication middleware error:', error);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
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
            
            if (req.headers.accept?.includes('text/html')) {
                return res.redirect(`/api/auth/refresh-token?redirect=${encodeURIComponent(req.originalUrl)}`)
            }
            return res.status(401).json({ error: 'Your access token has expired. You will now be redirected to refresh it.' })
        }
        console.log(e.code)
        console.log(e.originalError.name)
        console.log(2)
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