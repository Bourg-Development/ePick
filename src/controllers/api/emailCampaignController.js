// controllers/api/emailCampaignController.js
const emailCampaignService = require('../../services/emailCampaignService');
const { body, param, query, validationResult } = require('express-validator');

/**
 * Controller for email campaign management operations
 */
class EmailCampaignController {

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
     * Create a new email campaign
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async createCampaign(req, res) {
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
            const { userId: createdBy } = req.auth;
            const context = this._getRequestContext(req);

            // Add list_id to campaign data
            const campaignData = {
                ...req.body,
                list_id: parseInt(listId)
            };

            const result = await emailCampaignService.createCampaign(
                campaignData,
                createdBy,
                context
            );

            return res.status(result.success ? 201 : 400).json(result);
        } catch (error) {
            console.error('Create campaign error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to create campaign'
            });
        }
    }

    /**
     * Get all campaigns
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getCampaigns(req, res) {
        try {
            console.log('[DEBUG] EmailCampaignController.getCampaigns called');
            const options = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
                search: req.query.search,
                status: req.query.status,
                list_id: req.query.list_id ? parseInt(req.query.list_id) : undefined,
                campaign_type: req.query.campaign_type
            };

            const result = await emailCampaignService.getCampaigns(options);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Get campaigns error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve campaigns'
            });
        }
    }

    /**
     * Get campaigns for specific mailing list
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getCampaignsByList(req, res) {
        try {
            const { listId } = req.params;
            const options = {
                ...req.query,
                list_id: parseInt(listId)
            };

            const result = await emailCampaignService.getCampaigns(options);

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Get campaigns by list error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve campaigns'
            });
        }
    }

    /**
     * Get campaign by ID
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getCampaignById(req, res) {
        try {
            const { campaignId } = req.params;

            const result = await emailCampaignService.getCampaignById(parseInt(campaignId));

            return res.status(result.success ? 200 : 404).json(result);
        } catch (error) {
            console.error('Get campaign by ID error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve campaign'
            });
        }
    }

    /**
     * Update campaign (draft only)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async updateCampaign(req, res) {
        try {
            // Note: Update functionality would need to be implemented in emailCampaignService
            return res.status(501).json({
                success: false,
                message: 'Campaign update not yet implemented'
            });
        } catch (error) {
            console.error('Update campaign error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to update campaign'
            });
        }
    }

    /**
     * Send campaign immediately
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async sendCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const { userId: sentBy } = req.auth;
            const context = this._getRequestContext(req);

            const result = await emailCampaignService.sendCampaign(
                parseInt(campaignId),
                sentBy,
                context,
                true // sendNow = true
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Send campaign error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to send campaign'
            });
        }
    }

    /**
     * Schedule campaign for later sending
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async scheduleCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const { userId: sentBy } = req.auth;
            const context = this._getRequestContext(req);

            const result = await emailCampaignService.sendCampaign(
                parseInt(campaignId),
                sentBy,
                context,
                false // sendNow = false
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Schedule campaign error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to schedule campaign'
            });
        }
    }

    /**
     * Cancel campaign
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async cancelCampaign(req, res) {
        try {
            const { campaignId } = req.params;
            const { userId: cancelledBy } = req.auth;
            const context = this._getRequestContext(req);

            const result = await emailCampaignService.cancelCampaign(
                parseInt(campaignId),
                cancelledBy,
                context
            );

            return res.status(result.success ? 200 : 400).json(result);
        } catch (error) {
            console.error('Cancel campaign error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to cancel campaign'
            });
        }
    }

    /**
     * Get campaign analytics
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getCampaignAnalytics(req, res) {
        try {
            const { campaignId } = req.params;

            const result = await emailCampaignService.getCampaignById(parseInt(campaignId));

            if (!result.success) {
                return res.status(404).json(result);
            }

            // Extract analytics data
            const campaign = result.data;
            const analytics = {
                campaign_id: campaign.id,
                campaign_name: campaign.name,
                status: campaign.status,
                sent_at: campaign.sent_at,
                total_recipients: campaign.total_recipients,
                total_sent: campaign.total_sent,
                total_delivered: campaign.total_delivered,
                total_bounced: campaign.total_bounced,
                total_opened: campaign.total_opened,
                total_clicked: campaign.total_clicked,
                open_rate: campaign.open_rate,
                click_rate: campaign.click_rate,
                bounce_rate: campaign.bounce_rate,
                tracking_details: campaign.tracking || []
            };

            return res.status(200).json({
                success: true,
                data: analytics
            });
        } catch (error) {
            console.error('Get campaign analytics error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve campaign analytics'
            });
        }
    }

    /**
     * Get system-wide analytics overview
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async getSystemAnalytics(req, res) {
        try {
            // Note: System analytics would need to be implemented
            return res.status(501).json({
                success: false,
                message: 'System analytics not yet implemented'
            });
        } catch (error) {
            console.error('Get system analytics error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve system analytics'
            });
        }
    }

    /**
     * Track email open (public endpoint)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async trackOpen(req, res) {
        try {
            const { trackingId } = req.params;

            await emailCampaignService.trackOpen(trackingId);

            // Return 1x1 transparent PNG pixel
            const pixel = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                'base64'
            );

            res.set({
                'Content-Type': 'image/png',
                'Content-Length': pixel.length,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });

            return res.send(pixel);
        } catch (error) {
            console.error('Track open error:', error);
            // Return pixel even on error to avoid broken images
            const pixel = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                'base64'
            );
            res.set('Content-Type', 'image/png');
            return res.send(pixel);
        }
    }

    /**
     * Track email click (public endpoint)
     * @param {Object} req - Express request
     * @param {Object} res - Express response
     */
    async trackClick(req, res) {
        try {
            const { trackingId } = req.params;
            const { url } = req.query;

            const result = await emailCampaignService.trackClick(trackingId, url);

            if (result.success && result.redirectUrl) {
                return res.redirect(result.redirectUrl);
            } else {
                return res.status(404).json({
                    success: false,
                    message: 'Invalid tracking link'
                });
            }
        } catch (error) {
            console.error('Track click error:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to track click'
            });
        }
    }

    /**
     * Validation rules for creating campaign
     */
    static validateCreateCampaign() {
        return [
            param('listId')
                .isInt({ min: 1 })
                .withMessage('Invalid list ID'),
            body('name')
                .trim()
                .isLength({ min: 2, max: 200 })
                .withMessage('Name must be between 2 and 200 characters'),
            body('subject')
                .trim()
                .isLength({ min: 1, max: 255 })
                .withMessage('Subject must be between 1 and 255 characters'),
            body('content_html')
                .optional()
                .isLength({ min: 1 })
                .withMessage('HTML content cannot be empty if provided'),
            body('content_text')
                .optional()
                .isLength({ min: 1 })
                .withMessage('Text content cannot be empty if provided'),
            body('sender_email')
                .optional()
                .isEmail()
                .withMessage('Sender email must be valid'),
            body('sender_name')
                .optional()
                .trim()
                .isLength({ min: 1, max: 100 })
                .withMessage('Sender name must be between 1 and 100 characters'),
            body('reply_to')
                .optional()
                .isEmail()
                .withMessage('Reply-to must be a valid email'),
            body('campaign_type')
                .optional()
                .isIn(['newsletter', 'announcement', 'alert', 'system', 'marketing'])
                .withMessage('Invalid campaign type'),
            body('scheduled_at')
                .optional()
                .isISO8601()
                .withMessage('Scheduled date must be in ISO 8601 format'),
            // Custom validation to ensure at least one content type
            body().custom((body) => {
                if (!body.content_html && !body.content_text) {
                    throw new Error('Either HTML or text content is required');
                }
                return true;
            })
        ];
    }

    /**
     * Validation rules for updating campaign
     */
    static validateUpdateCampaign() {
        return [
            param('campaignId')
                .isInt({ min: 1 })
                .withMessage('Invalid campaign ID'),
            body('name')
                .optional()
                .trim()
                .isLength({ min: 2, max: 200 })
                .withMessage('Name must be between 2 and 200 characters'),
            body('subject')
                .optional()
                .trim()
                .isLength({ min: 1, max: 255 })
                .withMessage('Subject must be between 1 and 255 characters'),
            body('content_html')
                .optional()
                .isLength({ min: 1 })
                .withMessage('HTML content cannot be empty if provided'),
            body('content_text')
                .optional()
                .isLength({ min: 1 })
                .withMessage('Text content cannot be empty if provided')
        ];
    }

    /**
     * Validation rules for scheduling campaign
     */
    static validateScheduleCampaign() {
        return [
            param('campaignId')
                .isInt({ min: 1 })
                .withMessage('Invalid campaign ID'),
            body('scheduled_at')
                .isISO8601()
                .withMessage('Scheduled date must be in ISO 8601 format')
                .custom((value) => {
                    if (new Date(value) <= new Date()) {
                        throw new Error('Scheduled date must be in the future');
                    }
                    return true;
                })
        ];
    }

    /**
     * Validation rules for campaign ID parameter
     */
    static validateCampaignId() {
        return [
            param('campaignId')
                .isInt({ min: 1 })
                .withMessage('Invalid campaign ID')
        ];
    }
}

module.exports = EmailCampaignController;