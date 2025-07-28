// controllers/api/csrfController.js
const { generateCSRFToken } = require('../../middleware/csrf');
const logService = require('../../services/logService');

/**
 * Controller for CSRF token management
 */
class CSRFController {
    /**
     * Get CSRF token for the current session
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getToken(req, res) {
        try {
            // Generate new CSRF token
            const token = await generateCSRFToken(req);
            
            // Set token in cookie
            res.cookie('_csrf', token, {
                httpOnly: false, // Frontend needs to read this
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 1000, // 1 hour
                path: '/'
            });

            // Log token generation for audit purposes
            await logService.auditLog({
                eventType: 'csrf.token_generated',
                userId: req.auth?.userId || null,
                ipAddress: req.ip,
                deviceFingerprint: req.get('X-Device-Fingerprint') || null,
                metadata: {
                    userAgent: req.headers['user-agent'] || 'unknown',
                    sessionId: req.auth?.sessionId || null
                }
            });

            res.json({
                success: true,
                csrfToken: token,
                message: 'CSRF token generated successfully'
            });
        } catch (error) {
            console.error('CSRF token generation error:', error);
            
            // Log the error
            await logService.securityLog({
                eventType: 'csrf.token_generation_failed',
                severity: 'medium',
                userId: req.auth?.userId || null,
                ipAddress: req.ip,
                deviceFingerprint: req.get('X-Device-Fingerprint') || null,
                metadata: {
                    error: error.message,
                    userAgent: req.headers['user-agent'] || 'unknown'
                }
            });

            res.status(500).json({
                success: false,
                message: 'Failed to generate CSRF token'
            });
        }
    }

    /**
     * Verify CSRF token (for testing purposes)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async verifyToken(req, res) {
        try {
            // If we reach this point, the token has been verified by middleware
            res.json({
                success: true,
                message: 'CSRF token is valid'
            });
        } catch (error) {
            console.error('CSRF token verification error:', error);
            
            res.status(500).json({
                success: false,
                message: 'CSRF token verification failed'
            });
        }
    }

    /**
     * Get CSRF protection status and information
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getStatus(req, res) {
        try {
            const hasToken = !!req.cookies._csrf;
            const tokenFromLocals = res.locals.csrfToken || null;

            res.json({
                success: true,
                csrfProtection: {
                    enabled: true,
                    hasToken,
                    tokenSource: hasToken ? 'cookie' : null,
                    newToken: tokenFromLocals
                },
                message: 'CSRF protection status retrieved'
            });
        } catch (error) {
            console.error('CSRF status retrieval error:', error);
            
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve CSRF status'
            });
        }
    }
}

module.exports = new CSRFController();