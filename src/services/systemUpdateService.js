const { SystemUpdate, UserUpdateAcknowledgment, User } = require('../db');
const emailService = require('./emailService');
const GitHubService = require('./githubService');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class SystemUpdateService {
    constructor() {
        this.githubService = new GitHubService();
    }
    async createUpdate(updateData, publisherId) {
        try {
            const createData = { ...updateData };
            
            // Only set published_by if publisherId is provided
            if (publisherId) {
                createData.published_by = publisherId;
            }
            
            const update = await SystemUpdate.create(createData);

            return {
                success: true,
                data: update
            };
        } catch (error) {
            console.error('Error creating system update:', error);
            return {
                success: false,
                message: 'Failed to create system update'
            };
        }
    }

    async publishUpdate(updateId, publisherId) {
        try {
            const update = await SystemUpdate.findByPk(updateId);
            if (!update) {
                return {
                    success: false,
                    message: 'Update not found'
                };
            }

            if (update.status === 'published') {
                return {
                    success: false,
                    message: 'Update is already published'
                };
            }

            // Update status
            const updateData = {
                status: 'published',
                published_at: new Date()
            };
            
            // Only set published_by if publisherId is provided
            if (publisherId) {
                updateData.published_by = publisherId;
            }
            
            await update.update(updateData);

            // Send email notifications
            const emailResult = await this.sendUpdateNotifications(update);

            return {
                success: true,
                data: update,
                emailsSent: emailResult.sent
            };
        } catch (error) {
            console.error('Error publishing system update:', error);
            return {
                success: false,
                message: 'Failed to publish system update'
            };
        }
    }

    async sendUpdateNotifications(update) {
        try {
            let sentCount = 0;
            
            // Get all users with email notification preferences
            const users = await User.findAll({
                attributes: ['id', 'email', 'full_name'],
                where: {
                    email: {
                        [Op.not]: null
                    }
                }
            });

            for (const user of users) {
                // Check user email preferences
                const canSendEmail = await emailService.checkUserEmailPreference(
                    user.id, 
                    'system_updates'
                );

                if (canSendEmail) {
                    const emailSent = await emailService.sendSystemUpdateNotification(user, update);
                    if (emailSent) {
                        sentCount++;
                    }
                }
            }

            // Mark emails as sent
            await update.update({
                email_sent: true,
                email_sent_at: new Date()
            });

            return {
                success: true,
                sent: sentCount,
                total: users.length
            };
        } catch (error) {
            console.error('Error sending update notifications:', error);
            return {
                success: false,
                sent: 0,
                error: error.message
            };
        }
    }

    async getUpdates(filters = {}) {
        try {
            const where = {};
            
            if (filters.status) {
                where.status = filters.status;
            }
            
            if (filters.priority) {
                where.priority = filters.priority;
            }

            const updates = await SystemUpdate.findAll({
                where,
                include: [
                    {
                        model: User,
                        as: 'publisher',
                        attributes: ['id', 'full_name', 'email']
                    }
                ],
                order: [['published_at', 'DESC'], ['created_at', 'DESC']]
            });

            return {
                success: true,
                data: updates
            };
        } catch (error) {
            console.error('Error fetching system updates:', error);
            return {
                success: false,
                message: 'Failed to fetch system updates'
            };
        }
    }

    async getUpdateById(updateId) {
        try {
            const update = await SystemUpdate.findByPk(updateId, {
                include: [
                    {
                        model: User,
                        as: 'publisher',
                        attributes: ['id', 'full_name', 'email']
                    },
                    {
                        model: UserUpdateAcknowledgment,
                        as: 'acknowledgments',
                        include: [
                            {
                                model: User,
                                as: 'user',
                                attributes: ['id', 'full_name', 'email']
                            }
                        ]
                    }
                ]
            });

            if (!update) {
                return {
                    success: false,
                    message: 'Update not found'
                };
            }

            return {
                success: true,
                data: update
            };
        } catch (error) {
            console.error('Error fetching system update:', error);
            return {
                success: false,
                message: 'Failed to fetch system update'
            };
        }
    }

    async getPendingUpdatesForUser(userId) {
        try {
            const acknowledgedUpdateIds = await UserUpdateAcknowledgment.findAll({
                where: { user_id: userId },
                attributes: ['update_id']
            }).then(acknowledgments => acknowledgments.map(a => a.update_id));

            const pendingUpdates = await SystemUpdate.findAll({
                where: {
                    status: 'published',
                    show_popup: true,
                    id: {
                        [Op.notIn]: acknowledgedUpdateIds
                    },
                    published_at: {
                        [Op.gte]: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)) // Last 30 days
                    }
                },
                order: [['published_at', 'DESC']]
            });

            return {
                success: true,
                data: pendingUpdates
            };
        } catch (error) {
            console.error('Error fetching pending updates:', error);
            return {
                success: false,
                message: 'Failed to fetch pending updates'
            };
        }
    }

    async acknowledgeUpdate(userId, updateId) {
        try {
            const [acknowledgment, created] = await UserUpdateAcknowledgment.findOrCreate({
                where: {
                    user_id: userId,
                    update_id: updateId
                },
                defaults: {
                    user_id: userId,
                    update_id: updateId,
                    acknowledged_at: new Date()
                }
            });

            return {
                success: true,
                data: acknowledgment,
                created
            };
        } catch (error) {
            console.error('Error acknowledging update:', error);
            return {
                success: false,
                message: 'Failed to acknowledge update'
            };
        }
    }

    async markPopupShown(userId, updateId) {
        try {
            const [acknowledgment, created] = await UserUpdateAcknowledgment.findOrCreate({
                where: {
                    user_id: userId,
                    update_id: updateId
                },
                defaults: {
                    user_id: userId,
                    update_id: updateId,
                    popup_shown: true,
                    popup_shown_at: new Date()
                }
            });

            if (!created && !acknowledgment.popup_shown) {
                await acknowledgment.update({
                    popup_shown: true,
                    popup_shown_at: new Date()
                });
            }

            return {
                success: true,
                data: acknowledgment
            };
        } catch (error) {
            console.error('Error marking popup shown:', error);
            return {
                success: false,
                message: 'Failed to mark popup shown'
            };
        }
    }

    async updateUpdate(updateId, updateData) {
        try {
            const update = await SystemUpdate.findByPk(updateId);
            if (!update) {
                return {
                    success: false,
                    message: 'Update not found'
                };
            }

            if (update.status === 'published') {
                // Only allow certain fields to be updated after publishing
                const allowedFields = ['description', 'changes'];
                const filteredData = Object.keys(updateData)
                    .filter(key => allowedFields.includes(key))
                    .reduce((obj, key) => {
                        obj[key] = updateData[key];
                        return obj;
                    }, {});
                
                await update.update(filteredData);
            } else {
                await update.update(updateData);
            }

            return {
                success: true,
                data: update
            };
        } catch (error) {
            console.error('Error updating system update:', error);
            return {
                success: false,
                message: 'Failed to update system update'
            };
        }
    }

    async deleteUpdate(updateId) {
        try {
            const update = await SystemUpdate.findByPk(updateId);
            if (!update) {
                return {
                    success: false,
                    message: 'Update not found'
                };
            }

            if (update.status === 'published') {
                return {
                    success: false,
                    message: 'Cannot delete published updates'
                };
            }

            await update.destroy();

            return {
                success: true,
                message: 'Update deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting system update:', error);
            return {
                success: false,
                message: 'Failed to delete system update'
            };
        }
    }

    async getAcknowledmentStats(updateId) {
        try {
            const update = await SystemUpdate.findByPk(updateId);
            if (!update) {
                return {
                    success: false,
                    message: 'Update not found'
                };
            }

            const totalUsers = await User.count();
            const acknowledgedCount = await UserUpdateAcknowledgment.count({
                where: { update_id: updateId }
            });
            const popupShownCount = await UserUpdateAcknowledgment.count({
                where: { 
                    update_id: updateId,
                    popup_shown: true
                }
            });

            return {
                success: true,
                data: {
                    totalUsers,
                    acknowledgedCount,
                    popupShownCount,
                    acknowledgmentRate: totalUsers > 0 ? (acknowledgedCount / totalUsers * 100).toFixed(2) : 0,
                    popupViewRate: totalUsers > 0 ? (popupShownCount / totalUsers * 100).toFixed(2) : 0
                }
            };
        } catch (error) {
            console.error('Error fetching acknowledgment stats:', error);
            return {
                success: false,
                message: 'Failed to fetch acknowledgment stats'
            };
        }
    }

    // ===== GITHUB INTEGRATION METHODS =====

    async syncWithGitHub() {
        try {
            if (!this.githubService.isEnabled()) {
                return {
                    success: false,
                    message: 'GitHub integration is not enabled or configured'
                };
            }

            const releases = await this.githubService.getLatestReleases(20);
            let created = 0;
            let skipped = 0;
            let errors = 0;

            for (const release of releases) {
                try {
                    const result = await this.createUpdateFromGitHubRelease(release);
                    if (result.success) {
                        if (result.created) {
                            created++;
                        } else {
                            skipped++;
                        }
                    } else {
                        errors++;
                    }
                } catch (error) {
                    logger.error(`Error processing release ${release.tag_name}:`, error);
                    errors++;
                }
            }

            logger.info(`GitHub sync completed: ${created} created, ${skipped} skipped, ${errors} errors`);

            return {
                success: true,
                data: {
                    created,
                    skipped,
                    errors,
                    total: releases.length
                }
            };
        } catch (error) {
            logger.error('GitHub sync failed:', error);
            return {
                success: false,
                message: `GitHub sync failed: ${error.message}`
            };
        }
    }

    async createUpdateFromGitHubRelease(release) {
        try {
            // Check if update already exists
            const existingUpdate = await SystemUpdate.findOne({
                where: { version: release.tag_name }
            });

            if (existingUpdate) {
                return {
                    success: true,
                    created: false,
                    message: `Update for version ${release.tag_name} already exists`,
                    data: existingUpdate
                };
            }

            // Get the previous release to determine release type
            const previousRelease = await this.getLastestSystemUpdateVersion();
            
            const updateData = {
                version: release.tag_name,
                title: release.name || `Release ${release.tag_name}`,
                description: release.body || release.name || `Release ${release.tag_name}`,
                changes: this.githubService.parseReleaseNotes(release.body),
                release_type: this.githubService.determineReleaseType(release.tag_name, previousRelease),
                priority: this.githubService.determinePriority(release, previousRelease),
                status: 'draft', // Start as draft for admin review
                requires_acknowledgment: false,
                show_popup: true,
                popup_duration_days: 7,
                github_release_id: release.id,
                github_release_url: release.html_url,
                github_tag_name: release.tag_name,
                auto_imported: true
            };

            // Don't set published_by for auto-imported updates
            const result = await this.createUpdate(updateData, null);
            
            if (result.success) {
                logger.info(`Created system update from GitHub release: ${release.tag_name}`);
                return {
                    success: true,
                    created: true,
                    data: result.data
                };
            } else {
                return result;
            }
        } catch (error) {
            logger.error(`Error creating update from GitHub release ${release.tag_name}:`, error);
            return {
                success: false,
                message: `Failed to create update from release: ${error.message}`
            };
        }
    }

    async getLastestSystemUpdateVersion() {
        try {
            const latestUpdate = await SystemUpdate.findOne({
                order: [['created_at', 'DESC']],
                attributes: ['version']
            });
            return latestUpdate ? latestUpdate.version : null;
        } catch (error) {
            logger.error('Error getting latest system update version:', error);
            return null;
        }
    }

    truncateDescription(description) {
        if (!description) return '';
        
        // Remove markdown formatting and limit length
        const cleaned = description
            .replace(/#{1,6}\s/g, '') // Remove markdown headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
            .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
            .replace(/`(.*?)`/g, '$1') // Remove code formatting
            .trim();

        return cleaned.length > 500 ? cleaned.substring(0, 497) + '...' : cleaned;
    }

    async importSpecificGitHubRelease(tagName) {
        try {
            if (!this.githubService.isEnabled()) {
                return {
                    success: false,
                    message: 'GitHub integration is not enabled or configured'
                };
            }

            const release = await this.githubService.getReleaseByTag(tagName);
            const result = await this.createUpdateFromGitHubRelease(release);

            return result;
        } catch (error) {
            logger.error(`Error importing GitHub release ${tagName}:`, error);
            return {
                success: false,
                message: `Failed to import release ${tagName}: ${error.message}`
            };
        }
    }

    async getGitHubStatus() {
        try {
            const repoInfo = await this.githubService.getRepositoryInfo();
            
            if (repoInfo.enabled) {
                // Get latest release info
                try {
                    const latestRelease = await this.githubService.getLatestRelease();
                    repoInfo.latestRelease = {
                        tag_name: latestRelease.tag_name,
                        name: latestRelease.name,
                        published_at: latestRelease.published_at,
                        html_url: latestRelease.html_url
                    };
                } catch (error) {
                    repoInfo.latestReleaseError = error.message;
                }

                // Check if latest release is already imported
                if (repoInfo.latestRelease) {
                    const existingUpdate = await SystemUpdate.findOne({
                        where: { version: repoInfo.latestRelease.tag_name }
                    });
                    repoInfo.latestReleaseImported = !!existingUpdate;
                }
            }

            return {
                success: true,
                data: repoInfo
            };
        } catch (error) {
            logger.error('Error getting GitHub status:', error);
            return {
                success: false,
                message: `Failed to get GitHub status: ${error.message}`
            };
        }
    }

    async autoPublishGitHubReleases() {
        try {
            // Find all draft updates that came from GitHub and are ready to publish
            const draftUpdates = await SystemUpdate.findAll({
                where: {
                    status: 'draft',
                    github_release_id: {
                        [Op.not]: null
                    }
                },
                order: [['created_at', 'ASC']]
            });

            let published = 0;
            let errors = 0;

            for (const update of draftUpdates) {
                try {
                    // Auto-publish non-prerelease versions
                    if (!update.priority === 'critical') { // Assuming critical means prerelease
                        // For auto-publishing, don't set a specific user
                        const result = await this.publishUpdate(update.id, null);
                        if (result.success) {
                            published++;
                            logger.info(`Auto-published GitHub release update: ${update.version}`);
                        } else {
                            errors++;
                        }
                    }
                } catch (error) {
                    logger.error(`Error auto-publishing update ${update.version}:`, error);
                    errors++;
                }
            }

            return {
                success: true,
                data: {
                    published,
                    errors,
                    total: draftUpdates.length
                }
            };
        } catch (error) {
            logger.error('Error auto-publishing GitHub releases:', error);
            return {
                success: false,
                message: `Failed to auto-publish releases: ${error.message}`
            };
        }
    }
}

module.exports = new SystemUpdateService();