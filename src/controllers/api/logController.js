// controllers/logController.js
const logService = require('../../services/logService');
const { requirePermission } = require('../../middleware/authorization');

/**
 * Controller for log and security event management
 */
class LogController {
    /**
     * Get user's personal audit logs
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getPersonalLogs(req, res) {
        try {
            const { userId } = req.auth;

            // Parse query parameters
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const filters = {
                userId,  // Only show this user's logs
                eventType: req.query.eventType,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };

            // Get personal audit logs
            const result = await logService.getAuditLogs(filters, page, limit);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get personal logs error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve personal logs'
            });
        }
    }

    /**
     * Get audit logs (admin function)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAuditLogs(req, res) {
        try {
            // Check permissions (this is also done at the route level)
            if (!req.auth.permissions.includes('read.logs') &&
                !req.auth.permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Parse query parameters
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 100;
            const filters = {
                userId: req.query.userId ? parseInt(req.query.userId) : null,
                eventType: req.query.eventType,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };

            // Get audit logs
            const result = await logService.getAuditLogs(filters, page, limit);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get audit logs error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve audit logs'
            });
        }
    }

    /**
     * Get security logs (security admin function)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getSecurityLogs(req, res) {
        try {
            // Check permissions (this is also done at the route level)
            if (!req.auth.permissions.includes('read.logs') &&
                !req.auth.permissions.includes('admin') &&
                !req.auth.permissions.includes('access.security')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Parse query parameters
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 100;
            const filters = {
                severity: req.query.severity,
                eventType: req.query.eventType,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };

            // Get security logs
            const result = await logService.getSecurityLogs(filters, page, limit);

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get security logs error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve security logs'
            });
        }
    }

    /**
     * Verify log integrity (security admin function)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async verifyLogIntegrity(req, res) {
        try {
            // Check permissions (this is also done at the route level)
            if (!req.auth.permissions.includes('access.security') &&
                !req.auth.permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { logType = 'audit', startId, endId } = req.query;

            // Verify log integrity
            const result = await logService.verifyLogIntegrity(
                logType,
                startId ? parseInt(startId) : null,
                endId ? parseInt(endId) : null
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Verify log integrity error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to verify log integrity'
            });
        }
    }

    /**
     * Get event type statistics
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getEventStats(req, res) {
        try {
            // Check permissions
            if (!req.auth.permissions.includes('read.logs') &&
                !req.auth.permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            const { startDate, endDate, logType = 'audit' } = req.query;

            // Get event statistics
            const result = await logService.getEventTypeStats(
                logType,
                startDate,
                endDate
            );

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get event stats error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve event statistics'
            });
        }
    }

    /**
     * Get security alerting status
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getSecurityAlertStatus(req, res) {
        try {
            // Check permissions
            if (!req.auth.permissions.includes('access.security') &&
                !req.auth.permissions.includes('admin')) {
                return res.status(403).json({
                    success: false,
                    message: 'Permission denied'
                });
            }

            // Get security alert status
            const result = await logService.getSecurityAlertStatus();

            return res.status(200).json(result);
        } catch (error) {
            console.error('Get security alert status error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve security alert status'
            });
        }
    }
}

module.exports = new LogController();