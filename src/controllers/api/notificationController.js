const notificationService = require('../../services/notificationService');

class NotificationController {
    /**
     * Get user notifications
     */
    async getUserNotifications(req, res) {
        try {
            const userId = req.auth.userId;
            const {
                includeRead = false,
                includeDismissed = false,
                type = null,
                actionRequired = null,
                limit = 20,
                offset = 0
            } = req.query;

            const notifications = await notificationService.getUserNotifications(userId, {
                includeRead: includeRead === 'true',
                includeDismissed: includeDismissed === 'true',
                type,
                actionRequired: actionRequired === 'true' ? true : actionRequired === 'false' ? false : null,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                success: true,
                data: notifications
            });

        } catch (error) {
            console.error('Error fetching user notifications:', error);
            res.status(500).json({
                success: false,
                message: req.i18n.__('errors.api.operations.failedToRetrieve', req.i18n.__('errors.api.resources.notifications')),
                error: error.message
            });
        }
    }

    /**
     * Get notification counts for user
     */
    async getNotificationCounts(req, res) {
        try {
            const userId = req.auth.userId;
            const counts = await notificationService.getUserNotificationCounts(userId);

            res.json({
                success: true,
                data: counts
            });

        } catch (error) {
            console.error('Error fetching notification counts:', error);
            res.status(500).json({
                success: false,
                message: req.i18n.__('errors.api.operations.failedToRetrieve', req.i18n.__('errors.api.resources.notifications')),
                error: error.message
            });
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const userId = req.auth.userId;

            const success = await notificationService.markAsRead(parseInt(id), userId);

            if (!success) {
                return res.status(404).json({
                    success: false,
                    message: req.i18n.__('errors.api.operations.failedToRetrieve', req.i18n.__('errors.api.resources.notification'))
                });
            }

            res.json({
                success: true,
                message: 'Notification marked as read'
            });

        } catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({
                success: false,
                message: req.i18n.__('errors.api.operations.failedToUpdate', req.i18n.__('errors.api.resources.notification')),
                error: error.message
            });
        }
    }

    /**
     * Mark multiple notifications as read
     */
    async markMultipleAsRead(req, res) {
        try {
            const { notificationIds } = req.body;
            const userId = req.auth.userId;

            const updatedCount = await notificationService.markMultipleAsRead(notificationIds, userId);

            res.json({
                success: true,
                message: `${updatedCount} notifications marked as read`,
                data: { updatedCount }
            });

        } catch (error) {
            console.error('Error marking notifications as read:', error);
            res.status(500).json({
                success: false,
                message: req.i18n.__('errors.api.operations.failedToUpdate', req.i18n.__('errors.api.resources.notifications')),
                error: error.message
            });
        }
    }

    /**
     * Dismiss notification
     */
    async dismissNotification(req, res) {
        try {
            const { id } = req.params;
            const userId = req.auth.userId;

            const success = await notificationService.dismissNotification(parseInt(id), userId);

            if (!success) {
                return res.status(404).json({
                    success: false,
                    message: req.i18n.__('errors.api.operations.failedToRetrieve', req.i18n.__('errors.api.resources.notification'))
                });
            }

            res.json({
                success: true,
                message: 'Notification dismissed'
            });

        } catch (error) {
            console.error('Error dismissing notification:', error);
            res.status(500).json({
                success: false,
                message: req.i18n.__('errors.api.operations.failedToUpdate', req.i18n.__('errors.api.resources.notification')),
                error: error.message
            });
        }
    }

    /**
     * Get notification by ID
     */
    async getNotificationById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.auth.userId;

            const notifications = await notificationService.getUserNotifications(userId, {
                includeRead: true,
                includeDismissed: true,
                limit: 1,
                offset: 0
            });

            const notification = notifications.find(n => n.id === parseInt(id));

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: req.i18n.__('errors.api.operations.failedToRetrieve', req.i18n.__('errors.api.resources.notification'))
                });
            }

            res.json({
                success: true,
                data: notification
            });

        } catch (error) {
            console.error('Error fetching notification:', error);
            res.status(500).json({
                success: false,
                message: req.i18n.__('errors.api.operations.failedToRetrieve', req.i18n.__('errors.api.resources.notification')),
                error: error.message
            });
        }
    }
}

module.exports = new NotificationController();