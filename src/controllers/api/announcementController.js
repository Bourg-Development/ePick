// controllers/api/announcementController.js
const announcementService = require('../../services/announcementService');
const deviceFingerprintUtil = require('../../utils/deviceFingerprint');

/**
 * Announcement controller for managing system announcements
 */
class AnnouncementController {
    /**
     * Create a new system announcement
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async createAnnouncement(req, res) {
        try {
            const { userId } = req.auth;
            const announcementData = req.body;

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await announcementService.createAnnouncement(announcementData, userId, context);

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create announcement error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create announcement'
            });
        }
    }

    /**
     * Get announcements for the current user
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getUserAnnouncements(req, res) {
        try {
            const { userId } = req.auth;
            const {
                include_viewed = 'false',
                limit = '50',
                offset = '0',
                type,
                priority
            } = req.query;

            const options = {
                include_viewed: include_viewed === 'true',
                limit: parseInt(limit),
                offset: parseInt(offset),
                type,
                priority
            };

            const result = await announcementService.getAnnouncementsForUser(userId, options);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get user announcements error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve announcements'
            });
        }
    }

    /**
     * Get all announcements (admin only)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAllAnnouncements(req, res) {
        try {
            const {
                is_active,
                is_published,
                type,
                priority,
                target_audience,
                created_by,
                limit = '50',
                offset = '0'
            } = req.query;

            const filters = {
                is_active: is_active !== undefined ? is_active === 'true' : undefined,
                is_published: is_published !== undefined ? is_published === 'true' : undefined,
                type,
                priority,
                target_audience,
                created_by: created_by ? parseInt(created_by) : undefined,
                limit: parseInt(limit),
                offset: parseInt(offset)
            };

            const result = await announcementService.getAllAnnouncements(filters);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get all announcements error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve announcements'
            });
        }
    }

    /**
     * Mark an announcement as viewed
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async markAsViewed(req, res) {
        try {
            const { userId } = req.auth;
            const { id } = req.params;

            const result = await announcementService.markAsViewed(parseInt(id), userId);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Mark as viewed error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to mark as viewed'
            });
        }
    }

    /**
     * Acknowledge an announcement
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async acknowledgeAnnouncement(req, res) {
        try {
            const { userId } = req.auth;
            const { id } = req.params;

            const result = await announcementService.acknowledgeAnnouncement(parseInt(id), userId);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Acknowledge announcement error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to acknowledge announcement'
            });
        }
    }

    /**
     * Delete an announcement
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async deleteAnnouncement(req, res) {
        try {
            const { userId } = req.auth;
            const { id } = req.params;

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            const result = await announcementService.deleteAnnouncement(parseInt(id), userId, context);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Delete announcement error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete announcement'
            });
        }
    }

    /**
     * Update an announcement
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateAnnouncement(req, res) {
        try {
            const { userId } = req.auth;
            const { id } = req.params;
            const updateData = req.body;

            const context = {
                ip: req.ip,
                deviceFingerprint: deviceFingerprintUtil.getFingerprint(req),
                userAgent: req.headers['user-agent'] || 'unknown'
            };

            // Implementation would go here
            // For now, return not implemented
            return res.status(501).json({
                success: false,
                message: 'Update announcement not yet implemented'
            });
        } catch (error) {
            console.error('Update announcement error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update announcement'
            });
        }
    }

    /**
     * Get announcement statistics (admin only)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAnnouncementStats(req, res) {
        try {
            // Implementation would go here
            // For now, return basic stats
            return res.status(200).json({
                success: true,
                stats: {
                    total_announcements: 0,
                    active_announcements: 0,
                    published_announcements: 0,
                    total_views: 0,
                    acknowledgment_rate: 0
                }
            });
        } catch (error) {
            console.error('Get announcement stats error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve announcement statistics'
            });
        }
    }
}

module.exports = new AnnouncementController();