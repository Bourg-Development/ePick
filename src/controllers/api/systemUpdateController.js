const systemUpdateService = require('../../services/systemUpdateService');
const logService = require('../../services/logService');

class SystemUpdateController {
    async createUpdate(req, res) {
        try {
            const {
                version,
                title,
                description,
                changes,
                release_type,
                priority,
                requires_acknowledgment,
                show_popup,
                popup_duration_days
            } = req.body;

            if (!version || !title) {
                return res.status(400).json({
                    success: false,
                    message: 'Version and title are required'
                });
            }

            const updateData = {
                version,
                title,
                description,
                changes,
                release_type: release_type || 'minor',
                priority: priority || 'medium',
                requires_acknowledgment: requires_acknowledgment || false,
                show_popup: show_popup !== false,
                popup_duration_days: popup_duration_days || 7
            };

            const result = await systemUpdateService.createUpdate(updateData, req.auth?.userId);

            if (result.success) {
                await logService.logAction(req.auth?.userId, 'system_update_created', 'SystemUpdate', result.data.id, {
                    version: result.data.version,
                    title: result.data.title
                });

                res.status(201).json({
                    success: true,
                    message: 'System update created successfully',
                    data: result.data
                });
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Create update error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async getUpdates(req, res) {
        try {
            const { status, priority } = req.query;
            
            const filters = {};
            if (status) filters.status = status;
            if (priority) filters.priority = priority;

            const result = await systemUpdateService.getUpdates(filters);

            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        updates: result.data
                    }
                });
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Get updates error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async getUpdateById(req, res) {
        try {
            const { id } = req.params;
            
            const result = await systemUpdateService.getUpdateById(id);

            if (result.success) {
                res.json({
                    success: true,
                    data: result.data
                });
            } else {
                res.status(404).json(result);
            }
        } catch (error) {
            console.error('Get update by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async updateUpdate(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const result = await systemUpdateService.updateUpdate(id, updateData);

            if (result.success) {
                await logService.logAction(req.auth?.userId, 'system_update_modified', 'SystemUpdate', id, {
                    changes: Object.keys(updateData)
                });

                res.json({
                    success: true,
                    message: 'System update updated successfully',
                    data: result.data
                });
            } else {
                res.status(result.message === 'Update not found' ? 404 : 400).json(result);
            }
        } catch (error) {
            console.error('Update update error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async publishUpdate(req, res) {
        try {
            const { id } = req.params;
            
            const result = await systemUpdateService.publishUpdate(id, req.auth?.userId);

            if (result.success) {
                await logService.auditLog({
                    eventType: 'system_update_published',
                    userId: req.auth?.userId,
                    targetId: id,
                    targetType: 'SystemUpdate',
                    ipAddress: req.ip,
                    metadata: {
                        version: result.data.version,
                        title: result.data.title,
                        emailsSent: result.emailsSent
                    }
                });

                res.json({
                    success: true,
                    message: `System update published successfully. Emails sent to ${result.emailsSent} users.`,
                    data: result.data
                });
            } else {
                console.log('Publish update failed:', result);
                res.status(result.message === 'Update not found' ? 404 : 400).json(result);
            }
        } catch (error) {
            console.error('Publish update error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async deleteUpdate(req, res) {
        try {
            const { id } = req.params;
            
            const result = await systemUpdateService.deleteUpdate(id);

            if (result.success) {
                await logService.logAction(req.auth?.userId, 'system_update_deleted', 'SystemUpdate', id);

                res.json({
                    success: true,
                    message: 'System update deleted successfully'
                });
            } else {
                res.status(result.message === 'Update not found' ? 404 : 400).json(result);
            }
        } catch (error) {
            console.error('Delete update error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async getPendingUpdates(req, res) {
        try {
            if (!req.auth || !req.auth.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }
            
            const result = await systemUpdateService.getPendingUpdatesForUser(req.auth.userId);

            if (result.success) {
                res.json({
                    success: true,
                    data: {
                        updates: result.data
                    }
                });
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Get pending updates error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async acknowledgeUpdate(req, res) {
        try {
            if (!req.auth || !req.auth.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }
            
            const { id } = req.params;
            
            const result = await systemUpdateService.acknowledgeUpdate(req.auth.userId, id);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Update acknowledged successfully',
                    data: result.data
                });
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Acknowledge update error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async markPopupShown(req, res) {
        try {
            if (!req.auth || !req.auth.userId) {
                return res.status(401).json({
                    success: false,
                    message: 'User not authenticated'
                });
            }
            
            const { id } = req.params;
            
            const result = await systemUpdateService.markPopupShown(req.auth.userId, id);

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Popup shown status updated',
                    data: result.data
                });
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Mark popup shown error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async getAcknowledmentStats(req, res) {
        try {
            const { id } = req.params;
            
            const result = await systemUpdateService.getAcknowledmentStats(id);

            if (result.success) {
                res.json({
                    success: true,
                    data: result.data
                });
            } else {
                res.status(404).json(result);
            }
        } catch (error) {
            console.error('Get acknowledgment stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async resendNotifications(req, res) {
        try {
            const { id } = req.params;
            
            const updateResult = await systemUpdateService.getUpdateById(id);
            if (!updateResult.success) {
                return res.status(404).json(updateResult);
            }

            const result = await systemUpdateService.sendUpdateNotifications(updateResult.data);

            if (result.success) {
                await logService.logAction(req.auth?.userId, 'system_update_notifications_resent', 'SystemUpdate', id, {
                    emailsSent: result.sent
                });

                res.json({
                    success: true,
                    message: `Notifications sent to ${result.sent} users`,
                    data: {
                        sent: result.sent,
                        total: result.total
                    }
                });
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Resend notifications error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    // ===== GITHUB INTEGRATION ENDPOINTS =====

    async syncGitHub(req, res) {
        try {
            const result = await systemUpdateService.syncWithGitHub();
            
            if (result.success) {
                res.json({
                    success: true,
                    message: `GitHub sync completed: ${result.data.created} created, ${result.data.skipped} skipped, ${result.data.errors} errors`,
                    data: result.data
                });
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('GitHub sync error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async getGitHubStatus(req, res) {
        try {
            const result = await systemUpdateService.getGitHubStatus();
            
            if (result.success) {
                res.json({
                    success: true,
                    data: result.data
                });
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('GitHub status error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async importGitHubRelease(req, res) {
        try {
            const { tag } = req.params;
            
            if (!tag) {
                return res.status(400).json({
                    success: false,
                    message: 'Release tag is required'
                });
            }

            const result = await systemUpdateService.importSpecificGitHubRelease(tag);
            
            if (result.success) {
                if (result.created) {
                    res.status(201).json({
                        success: true,
                        message: `Successfully imported GitHub release ${tag}`,
                        data: result.data
                    });
                } else {
                    res.json({
                        success: true,
                        message: `Release ${tag} was already imported`,
                        data: result.data
                    });
                }
            } else {
                res.status(400).json(result);
            }
        } catch (error) {
            console.error('Import GitHub release error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    async autoPublishGitHubReleases(req, res) {
        try {
            const result = await systemUpdateService.autoPublishGitHubReleases();
            
            if (result.success) {
                res.json({
                    success: true,
                    message: `Auto-publish completed: ${result.data.published} published, ${result.data.errors} errors`,
                    data: result.data
                });
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            console.error('Auto-publish GitHub releases error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}

const controller = new SystemUpdateController();

// Bind all methods to maintain 'this' context when used as Express route handlers
Object.getOwnPropertyNames(SystemUpdateController.prototype)
    .filter(name => name !== 'constructor' && typeof controller[name] === 'function')
    .forEach(name => {
        controller[name] = controller[name].bind(controller);
    });

module.exports = controller;