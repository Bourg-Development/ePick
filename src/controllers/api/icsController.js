const icsService = require('../../services/icsService');
const logService = require('../../services/logService');

const icsController = {
    /**
     * Enable ICS feed for the authenticated user
     */
    async enableFeed(req, res) {
        const { userId } = req.auth;
        const context = req.context || {};

        console.log('Enabling ICS feed for user:', userId);
        try {
            const token = await icsService.enableFeedForUser(userId);
            console.log('Generated token:', token);
            const feedUrl = await icsService.getFeedUrl(userId);
            console.log('Generated feed URL:', feedUrl);

            // Log the action
            await logService.securityLog({
                eventType: 'ICS_FEED_ENABLED',
                userId,
                ipAddress: context.ip,
                deviceFingerprint: context.userAgent
            });

            res.status(200).json({
                success: true,
                message: 'ICS feed enabled successfully',
                data: {
                    enabled: true,
                    feedUrl
                }
            });
        } catch (error) {
            console.error('Error enabling ICS feed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to enable ICS feed'
            });
        }
    },

    /**
     * Disable ICS feed for the authenticated user
     */
    async disableFeed(req, res) {
        const { userId } = req.auth;
        const context = req.context || {};

        try {
            await icsService.disableFeedForUser(userId);

            // Log the action
            await logService.securityLog({
                eventType: 'ICS_FEED_DISABLED',
                userId,
                ipAddress: context.ip,
                deviceFingerprint: context.userAgent
            });

            res.status(200).json({
                success: true,
                message: 'ICS feed disabled successfully',
                data: {
                    enabled: false,
                    feedUrl: null
                }
            });
        } catch (error) {
            console.error('Error disabling ICS feed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to disable ICS feed'
            });
        }
    },

    /**
     * Get ICS feed URL for the authenticated user
     */
    async getFeedUrl(req, res) {
        const { userId } = req.auth;

        try {
            const feedUrl = await icsService.getFeedUrl(userId);
            
            // Check if feed is enabled
            const db = require('../../db');
            const preference = await db.UserPreference.findOne({
                where: { user_id: userId }
            });

            const isEnabled = preference && preference.preferences && preference.preferences.ics_feed_enabled === true;

            res.status(200).json({
                success: true,
                data: {
                    enabled: isEnabled,
                    feedUrl: isEnabled ? feedUrl : null
                }
            });
        } catch (error) {
            console.error('Error getting ICS feed URL:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get ICS feed URL'
            });
        }
    },

    /**
     * Serve ICS feed (public endpoint with token authentication)
     */
    async serveFeed(req, res) {
        const { userId, token } = req.params;
        
        console.log('Serving ICS feed for user:', userId, 'with token:', token);
        try {
            const userIdNum = parseInt(userId);
            if (isNaN(userIdNum)) {
                return res.status(400).send('Invalid user ID');
            }

            // Generate ICS content
            console.log('Generating ICS content...');
            const icsContent = await icsService.generateUserServiceFeed(userIdNum, token);
            console.log('ICS content generated successfully');

            // Set appropriate headers
            res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
            res.setHeader('Content-Disposition', 'inline; filename="epick-analyses.ics"');
            res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
            
            res.status(200).send(icsContent);
        } catch (error) {
            console.error('Error serving ICS feed:', error);
            
            if (error.message === 'Invalid feed token') {
                res.status(401).send('Unauthorized: Invalid or expired feed token');
            } else if (error.message === 'ICS feed is not enabled for this user') {
                res.status(403).send('Forbidden: ICS feed is not enabled');
            } else {
                res.status(500).send('Internal Server Error');
            }
        }
    }
};

module.exports = icsController;