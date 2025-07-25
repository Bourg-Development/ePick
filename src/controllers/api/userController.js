// controllers/userController.js
const userService = require('../../services/userService');
const logService = require('../../services/logService');
const organizationSettingsService = require('../../services/organizationSettingsService'); // Add this import
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');
const emailService = require('../../services/emailService');

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
                    full_name: result.data.full_name,
                    role: result.data.role?.name,
                    service: result.data.service?.name,
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
            const { email, fullName } = req.body;

            // Check if any profile data is provided
            if (email === undefined && fullName === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'No profile data to update'
                });
            }

            // Check if self-service profile updates are enabled
            const selfServiceSetting = await organizationSettingsService.getSetting('self_service');

            if (!selfServiceSetting.success) {
                // If setting doesn't exist, default to false (disabled)
                return res.status(403).json({
                    success: false,
                    message: 'Self-service profile updates are not configured'
                });
            }

            if (!selfServiceSetting.setting.value) {
                return res.status(403).json({
                    success: false,
                    message: 'Self-service profile updates are disabled. Please contact an administrator to update your profile.'
                });
            }

            // Extract request context
            const context = new UserController()._getRequestContext(req);

            let emailResult = { success: true };
            let fullNameResult = { success: true };

            // Update email using existing method
            if (email !== undefined) {
                emailResult = await userService.updateUserEmail(userId, email, context);
                if (!emailResult.success) {
                    return res.status(400).json(emailResult);
                }
            }

            // Update full name using existing method (user updates their own profile)
            if (fullName !== undefined) {
                fullNameResult = await userService.updateUserFullName(userId, fullName, userId, context);
                if (!fullNameResult.success) {
                    return res.status(400).json(fullNameResult);
                }
            }

            // Return success response
            return res.status(200).json({
                success: true,
                message: 'Profile updated successfully'
            });

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
            
            console.log('updatePreferences API called:', {
                userId,
                preferences: JSON.stringify(preferences)
            });

            if (!preferences) {
                return res.status(400).json({
                    success: false,
                    message: 'Preferences data is required'
                });
            }

            // Update preferences
            console.log('Calling userService.updateUserPreferences with:', preferences);
            const result = await userService.updateUserPreferences(userId, preferences);

            // If language was updated successfully, set the cookie
            if (result.success && preferences.language) {
                res.cookie('lang', preferences.language, { 
                    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
                    httpOnly: true,
                    sameSite: 'lax'
                });
            }

            // Check if language was actually saved to user table
            let actualUserLanguage = null;
            if (preferences.language) {
                const db = require('../../db');
                const user = await db.User.findByPk(userId, {
                    attributes: ['preferred_language']
                });
                actualUserLanguage = user?.preferred_language;
            }

            // Add debug info to response
            const debugInfo = {
                ...result,
                debug: {
                    userId,
                    preferencesReceived: preferences,
                    languageInPreferences: preferences.language,
                    actualUserLanguageInDB: actualUserLanguage,
                    timestamp: new Date().toISOString()
                }
            };
            
            return res.status(result.success ? 200 : 400).json(debugInfo);
        } catch (error) {
            console.error('Update preferences error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update preferences'
            });
        }
    }

    /**
     * Update user language preference
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateLanguage(req, res) {
        try {
            const { userId } = req.auth;
            const { language } = req.body;

            // Update language preference
            const result = await userService.updateUserLanguage(userId, language);

            if (result.success) {
                // Update cookie
                res.cookie('lang', language, { 
                    maxAge: 365 * 24 * 60 * 60 * 1000,
                    httpOnly: true,
                    sameSite: 'lax'
                });
            }

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update language error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update language preference'
            });
        }
    }

    /**
     * Update user display preferences
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateDisplayPreferences(req, res) {
        try {
            const { userId } = req.auth;
            const { dateFormat } = req.body;

            // Update display preferences
            const result = await userService.updateUserDisplayPreferences(userId, {
                dateFormat
            });

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update display preferences error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update display preferences'
            });
        }
    }

    /**
     * Get user display preferences
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getDisplayPreferences(req, res) {
        try {
            const { userId } = req.auth;

            // Get display preferences
            const result = await userService.getUserDisplayPreferences(userId);

            return res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
            console.error('Get display preferences error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve display preferences'
            });
        }
    }

    /**
     * Get user's mailing list subscriptions
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getMailingListSubscriptions(req, res) {
        try {
            const { userId } = req.auth;

            const db = require('../../db');
            
            // Get user's mailing list subscriptions
            const subscriptions = await db.MailingListSubscriber.findAll({
                where: {
                    user_id: userId,
                    status: 'active'
                },
                include: [{
                    model: db.MailingList,
                    as: 'mailingList',
                    attributes: ['id', 'name', 'description', 'created_at'],
                    where: {
                        is_active: true
                    }
                }],
                order: [['subscribed_at', 'DESC']]
            });

            const formattedSubscriptions = subscriptions.map(sub => ({
                id: sub.mailingList.id,
                name: sub.mailingList.name,
                description: sub.mailingList.description,
                subscribed_at: sub.subscribed_at,
                status: sub.status,
                can_unsubscribe: true
            }));

            return res.status(200).json({
                success: true,
                data: {
                    subscriptions: formattedSubscriptions,
                    total: formattedSubscriptions.length
                }
            });
        } catch (error) {
            console.error('Get mailing list subscriptions error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve mailing list subscriptions'
            });
        }
    }

    /**
     * Unsubscribe user from a mailing list
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async unsubscribeFromList(req, res) {
        try {
            const { userId } = req.auth;
            const { listId } = req.params;
            const context = this._getRequestContext(req);

            const db = require('../../db');
            
            // Find the subscription
            const subscription = await db.MailingListSubscriber.findOne({
                where: {
                    user_id: userId,
                    list_id: listId,
                    status: 'active'
                },
                include: [{
                    model: db.MailingList,
                    as: 'mailingList',
                    attributes: ['name']
                }]
            });

            if (!subscription) {
                return res.status(404).json({
                    success: false,
                    message: 'Subscription not found or already inactive'
                });
            }

            // Update subscription status
            subscription.status = 'unsubscribed';
            subscription.unsubscribed_at = new Date();
            await subscription.save();

            // Log the unsubscribe action
            await logService.auditLog({
                eventType: 'mailing_list.user_unsubscribed',
                userId: userId,
                targetId: listId,
                targetType: 'mailing_list',
                ipAddress: context.ip,
                deviceFingerprint: context.deviceFingerprint,
                metadata: {
                    listName: subscription.mailingList.name,
                    unsubscribeMethod: 'user_settings',
                    userAgent: context.userAgent
                }
            });

            return res.status(200).json({
                success: true,
                message: `Successfully unsubscribed from ${subscription.mailingList.name}`
            });
        } catch (error) {
            console.error('Unsubscribe from mailing list error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to unsubscribe from mailing list'
            });
        }
    }

    /**
     * Send test notification to user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async sendTestNotification(req, res) {
        try {
            const { userId } = req.auth;
            const { type, email } = req.body;

            // Get user profile to get email
            const userResult = await userService.getUserById(userId);
            if (!userResult.success) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const user = userResult.data;
            const targetEmail = email || user.email;

            if (!targetEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'No email address available for test notification'
                });
            }

            // Send test notification based on type
            let result = false;
            
            if (type === 'email') {
                result = await emailService.sendTestNotification({
                    email: targetEmail,
                    userId: userId
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid notification type'
                });
            }

            if (result) {
                // Log the test notification
                await logService.auditLog({
                    eventType: 'notification.test_sent',
                    userId: userId,
                    targetType: 'email',
                    ipAddress: req.ip,
                    deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                    metadata: {
                        notificationType: type,
                        targetEmail: targetEmail,
                        userAgent: req.headers['user-agent'] || 'unknown'
                    }
                });

                return res.status(200).json({
                    success: true,
                    message: 'Test notification sent successfully'
                });
            } else {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send test notification'
                });
            }
        } catch (error) {
            console.error('Send test notification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to send test notification'
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