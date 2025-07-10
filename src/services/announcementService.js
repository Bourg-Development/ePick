// services/announcementService.js
const { Op } = require('sequelize');
const db = require('../db');
const logService = require('./logService');
const notificationService = require('./notificationService');

/**
 * Service for managing system announcements
 */
class AnnouncementService {
    /**
     * Create a new system announcement
     * @param {Object} announcementData - Announcement data
     * @param {number} userId - ID of the user creating the announcement
     * @param {Object} context - Request context
     */
    async createAnnouncement(announcementData, userId, context) {
        try {
            const {
                title,
                message,
                type = 'info',
                priority = 'normal',
                target_audience = 'all',
                target_roles = null,
                scheduled_for = null,
                expires_at = null,
                publish_immediately = true
            } = announcementData;

            // Validate required fields
            if (!title || !message) {
                return {
                    success: false,
                    message: 'Title and message are required'
                };
            }

            // Create the announcement
            const announcement = await db.SystemAnnouncement.create({
                title,
                message,
                type,
                priority,
                target_audience,
                target_roles,
                scheduled_for,
                expires_at,
                is_published: publish_immediately && !scheduled_for,
                published_at: publish_immediately && !scheduled_for ? new Date() : null,
                created_by: userId
            });

            // If publishing immediately, create notifications
            if (publish_immediately && !scheduled_for) {
                await this.createNotificationsForAnnouncement(announcement);
            }

            // Log the action
            await logService.log({
                event_type: 'announcement.created',
                user_id: userId,
                target_id: announcement.id,
                target_type: 'announcement',
                ip_address: context.ip,
                device_fingerprint: context.deviceFingerprint,
                metadata: {
                    title: announcement.title,
                    type: announcement.type,
                    priority: announcement.priority,
                    target_audience: announcement.target_audience,
                    published_immediately: publish_immediately
                }
            });

            return {
                success: true,
                message: 'Announcement created successfully',
                announcement: announcement
            };
        } catch (error) {
            console.error('Create announcement error:', error);
            return {
                success: false,
                message: 'Failed to create announcement'
            };
        }
    }

    /**
     * Get announcements for a specific user
     * @param {number} userId - User ID
     * @param {Object} options - Query options
     */
    async getAnnouncementsForUser(userId, options = {}) {
        try {
            const {
                include_viewed = false,
                limit = 50,
                offset = 0,
                type = null,
                priority = null
            } = options;

            // Get user details
            const user = await db.User.findByPk(userId, {
                include: ['role']
            });

            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            const now = new Date();
            
            // Build where conditions
            const whereConditions = {
                is_active: true,
                is_published: true,
                [Op.or]: [
                    { scheduled_for: null },
                    { scheduled_for: { [Op.lte]: now } }
                ],
                [Op.or]: [
                    { expires_at: null },
                    { expires_at: { [Op.gt]: now } }
                ]
            };

            // Add type filter
            if (type) {
                whereConditions.type = type;
            }

            // Add priority filter
            if (priority) {
                whereConditions.priority = priority;
            }

            // Add target audience filter
            const targetConditions = [
                { target_audience: 'all' }
            ];

            if (user.role === 'admin' || user.role === 'system_admin') {
                targetConditions.push({ target_audience: 'admins' });
            } else {
                targetConditions.push({ target_audience: 'staff' });
            }

            targetConditions.push({
                target_audience: 'specific_role',
                target_roles: {
                    [Op.like]: `%"${user.role}"%`
                }
            });

            whereConditions[Op.or] = targetConditions;

            // Get announcements
            const announcements = await db.SystemAnnouncement.findAll({
                where: whereConditions,
                include: [
                    {
                        model: db.User,
                        as: 'creator',
                        attributes: ['id', 'username']
                    },
                    {
                        model: db.AnnouncementView,
                        as: 'views',
                        where: { user_id: userId },
                        required: false
                    }
                ],
                order: [
                    ['priority', 'DESC'],
                    ['published_at', 'DESC']
                ],
                limit,
                offset
            });

            // Filter out viewed announcements if requested
            let filteredAnnouncements = announcements;
            if (!include_viewed) {
                filteredAnnouncements = announcements.filter(announcement => 
                    !announcement.views || announcement.views.length === 0
                );
            }

            return {
                success: true,
                announcements: filteredAnnouncements,
                total: filteredAnnouncements.length
            };
        } catch (error) {
            console.error('Get announcements for user error:', error);
            return {
                success: false,
                message: 'Failed to retrieve announcements'
            };
        }
    }

    /**
     * Mark an announcement as viewed by a user
     * @param {number} announcementId - Announcement ID
     * @param {number} userId - User ID
     */
    async markAsViewed(announcementId, userId) {
        try {
            // Check if already viewed
            const existingView = await db.AnnouncementView.findOne({
                where: {
                    announcement_id: announcementId,
                    user_id: userId
                }
            });

            if (existingView) {
                return {
                    success: true,
                    message: 'Already marked as viewed'
                };
            }

            // Create view record
            await db.AnnouncementView.create({
                announcement_id: announcementId,
                user_id: userId,
                viewed_at: new Date()
            });

            return {
                success: true,
                message: 'Marked as viewed'
            };
        } catch (error) {
            console.error('Mark as viewed error:', error);
            return {
                success: false,
                message: 'Failed to mark as viewed'
            };
        }
    }

    /**
     * Acknowledge an announcement
     * @param {number} announcementId - Announcement ID
     * @param {number} userId - User ID
     */
    async acknowledgeAnnouncement(announcementId, userId) {
        try {
            // Find or create view record
            const [view, created] = await db.AnnouncementView.findOrCreate({
                where: {
                    announcement_id: announcementId,
                    user_id: userId
                },
                defaults: {
                    viewed_at: new Date(),
                    is_acknowledged: true,
                    acknowledged_at: new Date()
                }
            });

            if (!created) {
                // Update existing view
                await view.update({
                    is_acknowledged: true,
                    acknowledged_at: new Date()
                });
            }

            return {
                success: true,
                message: 'Announcement acknowledged'
            };
        } catch (error) {
            console.error('Acknowledge announcement error:', error);
            return {
                success: false,
                message: 'Failed to acknowledge announcement'
            };
        }
    }

    /**
     * Get all announcements for admin management
     * @param {Object} filters - Filter options
     */
    async getAllAnnouncements(filters = {}) {
        try {
            const {
                is_active,
                is_published,
                type,
                priority,
                target_audience,
                created_by,
                limit = 50,
                offset = 0
            } = filters;

            const whereConditions = {};

            if (is_active !== undefined) whereConditions.is_active = is_active;
            if (is_published !== undefined) whereConditions.is_published = is_published;
            if (type) whereConditions.type = type;
            if (priority) whereConditions.priority = priority;
            if (target_audience) whereConditions.target_audience = target_audience;
            if (created_by) whereConditions.created_by = created_by;

            const announcements = await db.SystemAnnouncement.findAndCountAll({
                where: whereConditions,
                include: [
                    {
                        model: db.User,
                        as: 'creator',
                        attributes: ['id', 'username']
                    },
                    {
                        model: db.AnnouncementView,
                        as: 'views',
                        include: [
                            {
                                model: db.User,
                                as: 'user',
                                attributes: ['id', 'username']
                            }
                        ]
                    }
                ],
                order: [['created_at', 'DESC']],
                limit,
                offset
            });

            return {
                success: true,
                announcements: announcements.rows,
                total: announcements.count
            };
        } catch (error) {
            console.error('Get all announcements error:', error);
            return {
                success: false,
                message: 'Failed to retrieve announcements'
            };
        }
    }

    /**
     * Create notifications for an announcement
     * @param {Object} announcement - Announcement object
     */
    async createNotificationsForAnnouncement(announcement) {
        try {
            // Get target users based on announcement audience
            let targetUsers = [];

            if (announcement.target_audience === 'all') {
                targetUsers = await db.User.findAll({
                    where: { active: true },
                    attributes: ['id']
                });
            } else if (announcement.target_audience === 'admins') {
                targetUsers = await db.User.findAll({
                    where: { 
                        active: true,
                        role: ['admin', 'system_admin']
                    },
                    attributes: ['id']
                });
            } else if (announcement.target_audience === 'staff') {
                targetUsers = await db.User.findAll({
                    where: { 
                        active: true,
                        role: {
                            [Op.notIn]: ['admin', 'system_admin']
                        }
                    },
                    attributes: ['id']
                });
            } else if (announcement.target_audience === 'specific_role' && announcement.target_roles) {
                targetUsers = await db.User.findAll({
                    where: { 
                        active: true,
                        role: {
                            [Op.in]: announcement.target_roles
                        }
                    },
                    attributes: ['id']
                });
            }

            // Create notifications for each target user
            for (const user of targetUsers) {
                await notificationService.createNotification({
                    user_id: user.id,
                    type: 'system_announcement',
                    title: announcement.title,
                    message: announcement.message,
                    priority: announcement.priority,
                    metadata: {
                        announcement_id: announcement.id,
                        announcement_type: announcement.type
                    }
                });
            }

            return {
                success: true,
                notifications_created: targetUsers.length
            };
        } catch (error) {
            console.error('Create notifications for announcement error:', error);
            return {
                success: false,
                message: 'Failed to create notifications'
            };
        }
    }

    /**
     * Publish scheduled announcements
     */
    async publishScheduledAnnouncements() {
        try {
            const now = new Date();
            
            // Find announcements that should be published
            const announcementsToPublish = await db.SystemAnnouncement.findAll({
                where: {
                    is_active: true,
                    is_published: false,
                    scheduled_for: {
                        [Op.lte]: now
                    }
                }
            });

            let publishedCount = 0;

            for (const announcement of announcementsToPublish) {
                await announcement.update({
                    is_published: true,
                    published_at: now
                });

                // Create notifications
                await this.createNotificationsForAnnouncement(announcement);
                publishedCount++;
            }

            return {
                success: true,
                published_count: publishedCount
            };
        } catch (error) {
            console.error('Publish scheduled announcements error:', error);
            return {
                success: false,
                message: 'Failed to publish scheduled announcements'
            };
        }
    }

    /**
     * Delete an announcement
     * @param {number} announcementId - Announcement ID
     * @param {number} userId - User ID performing the action
     * @param {Object} context - Request context
     */
    async deleteAnnouncement(announcementId, userId, context) {
        try {
            const announcement = await db.SystemAnnouncement.findByPk(announcementId);

            if (!announcement) {
                return {
                    success: false,
                    message: 'Announcement not found'
                };
            }

            // Store announcement data for logging
            const announcementData = {
                id: announcement.id,
                title: announcement.title,
                type: announcement.type
            };

            // Delete the announcement (cascade will handle views)
            await announcement.destroy();

            // Log the action
            await logService.log({
                event_type: 'announcement.deleted',
                user_id: userId,
                target_id: announcementId,
                target_type: 'announcement',
                ip_address: context.ip,
                device_fingerprint: context.deviceFingerprint,
                metadata: announcementData
            });

            return {
                success: true,
                message: 'Announcement deleted successfully'
            };
        } catch (error) {
            console.error('Delete announcement error:', error);
            return {
                success: false,
                message: 'Failed to delete announcement'
            };
        }
    }
}

module.exports = new AnnouncementService();