// controllers/userController.js
const userService = require('../services/userService');
const logService = require('../services/logService');
const deviceFingerprintUtil = require('../utils/deviceFingerprint');

/**
 * Controller for user management operations
 */
class UserController {
    /**
     * Get user profile for authenticated user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getProfile(req, res) {
        try {
            const { userId } = req.auth;

            // Get user profile
            const result = await userService.getUserById(userId);

            if (!result.success) {
                return res.status(404).json(result);
            }

            // Return profile data (excluding sensitive info)
            return res.status(200).json({
                success: true,
                profile: {
                    id: result.data.id,
                    username: result.data.username,
                    role: result.data.Role?.name,
                    email: result.data.email,
                    totpEnabled: result.data.totp_enabled,
                    webauthnEnabled: result.data.webauthn_enabled,
                    createdAt: result.data.created_at,
                    lastLogin: result.data.last_login
                }
            });
        } catch (error) {
            console.error('Get profile error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve profile'
            });
        }
    }

    /**
     * Update user profile information
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateProfile(req, res) {
        try {
            const { userId } = req.auth;
            const { email } = req.body;

            // Only email can be updated by the user themselves
            if (!email) {
                return res.status(400).json({
                    success: false,
                    message: 'No profile data to update'
                });
            }

            // Extract request context
            const context = this._getRequestContext(req);

            // Update profile
            const result = await userService.updateUserEmail(userId, email, context);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update profile error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update profile'
            });
        }
    }

    /**
     * Get user's session information
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getSessionInfo(req, res) {
        try {
            const { userId, sessionId } = req.auth;

            // Get current session info
            const result = await userService.getSessionInfo(userId, sessionId);

            if (!result.success) {
                return res.status(404).json(result);
            }

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get session info error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve session information'
            });
        }
    }

    /**
     * Get user's authentication activity
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAuthActivity(req, res) {
        try {
            const { userId } = req.auth;

            // Get recent authentication activity
            const result = await userService.getUserAuthActivity(userId);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get auth activity error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve authentication activity'
            });
        }
    }

    /**
     * Get user preferences
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getPreferences(req, res) {
        try {
            const { userId } = req.auth;

            // Get user preferences
            const result = await userService.getUserPreferences(userId);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get preferences error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve user preferences'
            });
        }
    }

    /**
     * Update user preferences
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updatePreferences(req, res) {
        try {
            const { userId } = req.auth;
            const { preferences } = req.body;

            if (!preferences) {
                return res.status(400).json({
                    success: false,
                    message: 'Preferences data is required'
                });
            }

            // Update preferences
            const result = await userService.updateUserPreferences(userId, preferences);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update preferences error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update preferences'
            });
        }
    }

    /**
     * Extract request context information
     * @private
     * @param {Object} req - Express request
     * @returns {Object} Request context
     */
    _getRequestContext(req) {
        return {
            ip: req.ip,
            deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
            userAgent: req.headers['user-agent'] || 'unknown'
        };
    }
}

module.exports = new UserController();