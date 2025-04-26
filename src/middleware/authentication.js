// middleware/authentication.js
const tokenService = require('../services/tokenService');
const deviceFingerprintUtil = require('../utils/deviceFingerprint');
const logService = require('../services/logService');
const db = require('../db');

/**
 * Authentication middleware
 * Verifies JWT tokens and sets user authentication context
 */
const authenticate = async (req, res, next) => {
    try {
        // Extract token from headers
        const token = req.cookies.accessToken; // or similar code to extract the token

        if (!token) {
            console.log(22)
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Verify token
        const decoded = await tokenService.verifyToken(token, 'access');

        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
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

        // Update session last activity
        session.last_activity = new Date();
        await session.save();

        // Set auth info in request
        req.auth = {
            userId: decoded.userId,
            username: decoded.username,
            role: decoded.role,
            permissions: decoded.permissions || [],
            tokenId: decoded.id,
            sessionId: session.id
        };

        return next();
    } catch (error) {
        console.error('Authentication middleware error:', error);
        return res.status(401).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};

module.exports = authenticate;