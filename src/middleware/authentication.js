// middleware/authentication.js
const tokenService = require('../services/tokenService');
const deviceFingerprintUtil = require('../utils/deviceFingerprint');
const logService = require('../services/logService');
const db = require('../db');
const { ACCESS_TOKEN_COOKIE_EXPIRY } = require('../config/environment')

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
            if(e.code === 'TOKEN_EXPIRED') {
                console.log(1)
                //TODO add validation plus advanced error handling e.g. just invalid token
                return res.redirect(`/api/auth/refresh-token?redirect=${encodeURIComponent(req.originalUrl)}`)
            }
            console.log(e.code)
            console.log(e.originalError.name)
            console.log(2)
            return res.status(401).render('errors/unauthorized', { type: 'noAuth', layout: 'layouts/auth', title: '401 | Auth required' } );
        }



        // Extract device fingerprint
        const deviceFingerprint = deviceFingerprintUtil.getFingerprint(req);

        // Verify session is still valid
        const session = await db.Session.findOne({
            where: {
                token_id: decoded.id,
                user_id: decoded.userId,
                is_valid: true
            }
        });

        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
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

        // Perform token rotation immediately
        let newToken;
        try {
            newToken = await tokenService.rotateAccessToken(token, { req });

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

        } catch (error) {
            console.error('Token rotation failed:', error);
        }

        req.auth = authInfo;

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
        return next()
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

module.exports = { authenticate, nonAuth};