// controllers/api/mailingListController.js
const mailingListService = require('../../services/mailingListService');
const emailCampaignService = require('../../services/emailCampaignService');
const { body, param, query, validationResult } = require('express-validator');

/**
 * Controller for mailing list management operations
 */
class MailingListController {

    /**
     * Get request context for logging
     * @private
     * @param {Object} req - Express request object
     * @returns {Object} Request context
     */
    _getRequestContext(req) {
        return {
            ip: req.ip,
            deviceFingerprint: req.get('X-Device-Fingerprint') || null,
            userAgent: req.headers['user-agent'] || 'unknown'
        };
    }

    /**
     * Create a new mailing list
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async createMailingList(req, res) {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { userId: createdBy } = req.auth;
            const context = this._getRequestContext(req);

            const result = await mailingListService.createMailingList(
                req.body,
                createdBy,
                context
            );

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create mailing list error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create mailing list'
            });
        }
    }

    /**
     * Get all mailing lists
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getMailingLists(req, res) {
        try {
            const options = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
                search: req.query.search,
                is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
                is_internal: req.query.is_internal !== undefined ? req.query.is_internal === 'true' : undefined
            };

            const result = await mailingListService.getMailingLists(options);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Get mailing lists error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve mailing lists'
            });
        }
    }

    /**
     * Get mailing list by ID
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getMailingListById(req, res) {
        try {
            const { listId } = req.params;

            const result = await mailingListService.getMailingListById(parseInt(listId));

            return res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
            console.error('Get mailing list by ID error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve mailing list'
            });
        }
    }

    /**
     * Update mailing list
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateMailingList(req, res) {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { listId } = req.params;
            const { userId: updatedBy } = req.auth;
            const context = this._getRequestContext(req);

            const result = await mailingListService.updateMailingList(
                parseInt(listId),
                req.body,
                updatedBy,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Update mailing list error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update mailing list'
            });
        }
    }

    /**
     * Delete mailing list
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async deleteMailingList(req, res) {
        try {
            const { listId } = req.params;
            const { userId: deletedBy } = req.auth;
            const context = this._getRequestContext(req);

            const result = await mailingListService.deleteMailingList(
                parseInt(listId),
                deletedBy,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Delete mailing list error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to delete mailing list'
            });
        }
    }

    /**
     * Add subscriber to mailing list
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async addSubscriber(req, res) {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { listId } = req.params;
            const { userId: addedBy } = req.auth;
            const context = this._getRequestContext(req);

            const result = await mailingListService.addSubscriber(
                parseInt(listId),
                req.body,
                addedBy,
                context
            );

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Add subscriber error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to add subscriber'
            });
        }
    }

    /**
     * Remove subscriber from mailing list
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async removeSubscriber(req, res) {
        try {
            const { listId, subscriberId } = req.params;
            const { userId: removedBy } = req.auth;
            const context = this._getRequestContext(req);

            const result = await mailingListService.removeSubscriber(
                parseInt(listId),
                parseInt(subscriberId),
                removedBy,
                context
            );

            return res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
            console.error('Remove subscriber error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to remove subscriber'
            });
        }
    }

    /**
     * Get available users for subscription
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAvailableUsers(req, res) {
        try {
            const { listId } = req.params;
            const { search } = req.query;

            const result = await mailingListService.getAvailableUsers(parseInt(listId), search);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Get available users error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve available users'
            });
        }
    }

    /**
     * Get available services for subscription
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getAvailableServices(req, res) {
        try {
            const { listId } = req.params;
            const { search } = req.query;

            const result = await mailingListService.getAvailableServices(parseInt(listId), search);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Get available services error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve available services'
            });
        }
    }

    /**
     * Validation rules for creating mailing list
     */
    static validateCreateMailingList() {
        return [
            body('name')
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Name must be between 2 and 100 characters'),
            body('description')
                .optional()
                .trim()
                .isLength({ max: 1000 })
                .withMessage('Description must be less than 1000 characters'),
            body('is_internal')
                .optional()
                .isBoolean()
                .withMessage('is_internal must be a boolean'),
            body('auto_subscribe_roles')
                .optional()
                .isArray()
                .withMessage('auto_subscribe_roles must be an array'),
            body('auto_subscribe_roles.*')
                .optional()
                .isString()
                .withMessage('Each role must be a string'),
            body('sender_email')
                .optional()
                .isEmail()
                .withMessage('sender_email must be a valid email'),
            body('sender_name')
                .optional()
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('sender_name must be between 1 and 100 characters'),
            body('max_subscribers')
                .optional()
                .isInt({ min: 1 })
                .withMessage('max_subscribers must be a positive integer'),
            body('subscription_requires_approval')
                .optional()
                .isBoolean()
                .withMessage('subscription_requires_approval must be a boolean')
        ];
    }

    /**
     * Validation rules for updating mailing list
     */
    static validateUpdateMailingList() {
        return [
            param('listId')
                .isInt({ min: 1 })
                .withMessage('Invalid list ID'),
            body('name')
                .optional()
                .trim()
                .isLength({ min: 2, max: 100 })
                .withMessage('Name must be between 2 and 100 characters'),
            body('description')
                .optional()
                .trim()
                .isLength({ max: 1000 })
                .withMessage('Description must be less than 1000 characters'),
            body('is_active')
                .optional()
                .isBoolean()
                .withMessage('is_active must be a boolean'),
            body('auto_subscribe_roles')
                .optional()
                .isArray()
                .withMessage('auto_subscribe_roles must be an array'),
            body('sender_email')
                .optional()
                .isEmail()
                .withMessage('sender_email must be a valid email'),
            body('sender_name')
                .optional()
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('sender_name must be between 1 and 100 characters'),
            body('max_subscribers')
                .optional()
                .isInt({ min: 1 })
                .withMessage('max_subscribers must be a positive integer'),
            body('subscription_requires_approval')
                .optional()
                .isBoolean()
                .withMessage('subscription_requires_approval must be a boolean')
        ];
    }

    /**
     * Validation rules for adding subscriber
     */
    static validateAddSubscriber() {
        return [
            param('listId')
                .isInt({ min: 1 })
                .withMessage('Invalid list ID'),
            body('user_id')
                .optional()
                .isInt({ min: 1 })
                .withMessage('user_id must be a positive integer'),
            body('service_id')
                .optional()
                .isInt({ min: 1 })
                .withMessage('service_id must be a positive integer'),
            body('external_email')
                .optional()
                .isEmail()
                .withMessage('external_email must be a valid email'),
            body('external_name')
                .optional()
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('external_name must be between 1 and 100 characters'),
            // Custom validation to ensure exactly one subscriber type
            body().custom((body) => {
                const subscriberTypes = [body.user_id, body.service_id, body.external_email].filter(Boolean);
                if (subscriberTypes.length !== 1) {
                    throw new Error('Must specify exactly one of: user_id, service_id, or external_email');
                }
                return true;
            })
        ];
    }

    /**
     * Validation rules for removing subscriber
     */
    static validateRemoveSubscriber() {
        return [
            param('listId')
                .isInt({ min: 1 })
                .withMessage('Invalid list ID'),
            param('subscriberId')
                .isInt({ min: 1 })
                .withMessage('Invalid subscriber ID')
        ];
    }

    /**
     * Get internal mailing lists (system-only)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getInternalMailingLists(req, res) {
        try {
            const options = {
                ...req.query,
                is_internal: true
            };

            const result = await mailingListService.getMailingLists(options);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Get internal mailing lists error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve internal mailing lists'
            });
        }
    }

    /**
     * Perform bulk operations on subscribers
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async performBulkOperations(req, res) {
        try {
            // Note: Bulk operations would need to be implemented in mailingListService
            return res.status(501).json({
                success: false,
                message: 'Bulk operations not yet implemented'
            });
        } catch (error) {
            console.error('Perform bulk operations error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to perform bulk operations'
            });
        }
    }

    /**
     * Unsubscribe using token (public endpoint)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async unsubscribeByToken(req, res) {
        try {
            const { token } = req.params;

            // Note: Unsubscribe functionality would need to be implemented in mailingListService
            return res.status(501).json({
                success: false,
                message: 'Unsubscribe functionality not yet implemented'
            });
        } catch (error) {
            console.error('Unsubscribe by token error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to process unsubscribe request'
            });
        }
    }

    /**
     * Process unsubscribe form submission
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async processUnsubscribe(req, res) {
        try {
            const { token } = req.params;

            // Note: Process unsubscribe would need to be implemented in mailingListService
            return res.status(501).json({
                success: false,
                message: 'Unsubscribe processing not yet implemented'
            });
        } catch (error) {
            console.error('Process unsubscribe error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to process unsubscribe'
            });
        }
    }

    /**
     * Validation rules for list ID parameter
     */
    static validateListId() {
        return [
            param('listId')
                .isInt({ min: 1 })
                .withMessage('Invalid list ID')
        ];
    }
}

module.exports = MailingListController;