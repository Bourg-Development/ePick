// routes/api/mailingListRoutes.js
const express = require('express');
const router = express.Router();
const MailingListController = require('../../controllers/api/mailingListController');
const EmailCampaignController = require('../../controllers/api/emailCampaignController');
const authMiddleware = require('../../middleware/authentication');
const { requirePermission, requireRole } = require('../../middleware/authorization');

// All routes require authentication
router.use(authMiddleware.authenticate);

// Debug: Log all requests to this router (can be removed in production)
router.use((req, res, next) => {
    console.log(`[DEBUG] Mailing router hit: ${req.method} ${req.originalUrl}`);
    console.log(`[DEBUG] Route path: ${req.path}`);
    next();
});

// Initialize controllers
const mailingListController = new MailingListController();
const emailCampaignController = new EmailCampaignController();

// ========================================
// GENERAL CAMPAIGN ROUTES - Must come FIRST to avoid conflicts with /:listId
// ========================================

/**
 * @route GET /api/mailing/campaigns-all
 * @desc Get all campaigns with pagination and filtering
 * @access Requires mailing.view_campaigns or system mailing permissions
 */
router.get('/campaigns-all',
    requireRole('system_admin'),
    emailCampaignController.getCampaigns.bind(emailCampaignController)
);

/**
 * @route GET /api/mailing/campaign/:campaignId
 * @desc Get campaign by ID with detailed tracking information
 * @access Requires mailing.view_campaigns or system mailing permissions
 */
router.get('/campaign/:campaignId',
    requireRole('system_admin'),
    EmailCampaignController.validateCampaignId(),
    emailCampaignController.getCampaignById.bind(emailCampaignController)
);

/**
 * @route PUT /api/mailing/campaign/:campaignId
 * @desc Update campaign (only drafts can be updated)
 * @access Requires mailing.create_campaigns or system mailing permissions
 */
router.put('/campaign/:campaignId',
    requireRole('system_admin'),
    EmailCampaignController.validateUpdateCampaign(),
    emailCampaignController.updateCampaign.bind(emailCampaignController)
);

/**
 * @route POST /api/mailing/campaign/:campaignId/send
 * @desc Send campaign immediately
 * @access Requires mailing.send_campaigns or system mailing permissions
 */
router.post('/campaign/:campaignId/send',
    requireRole('system_admin'),
    EmailCampaignController.validateCampaignId(),
    emailCampaignController.sendCampaign.bind(emailCampaignController)
);

/**
 * @route POST /api/mailing/campaign/:campaignId/schedule
 * @desc Schedule campaign for later sending
 * @access Requires mailing.send_campaigns or system mailing permissions
 */
router.post('/campaign/:campaignId/schedule',
    requireRole('system_admin'),
    EmailCampaignController.validateScheduleCampaign(),
    emailCampaignController.scheduleCampaign.bind(emailCampaignController)
);

/**
 * @route POST /api/mailing/campaign/:campaignId/cancel
 * @desc Cancel scheduled or sending campaign
 * @access Requires mailing.send_campaigns or system mailing permissions
 */
router.post('/campaign/:campaignId/cancel',
    requireRole('system_admin'),
    EmailCampaignController.validateCampaignId(),
    emailCampaignController.cancelCampaign.bind(emailCampaignController)
);

/**
 * @route GET /api/mailing/campaign/:campaignId/analytics
 * @desc Get detailed campaign analytics
 * @access Requires mailing.view_analytics or system mailing permissions
 */
router.get('/campaign/:campaignId/analytics',
    requireRole('system_admin'),
    EmailCampaignController.validateCampaignId(),
    emailCampaignController.getCampaignAnalytics.bind(emailCampaignController)
);

// ========================================
// MAILING LIST ROUTES
// ========================================

/**
 * @route GET /api/mailing-lists
 * @desc Get all mailing lists with pagination and filtering
 * @access Requires mailing.view_lists or system mailing permissions
 */
router.get('/',
    requireRole('system_admin'),
    mailingListController.getMailingLists.bind(mailingListController)
);

/**
 * @route POST /api/mailing-lists
 * @desc Create a new mailing list
 * @access Requires mailing.create_lists or system mailing permissions
 */
router.post('/',
    requireRole('system_admin'),
    MailingListController.validateCreateMailingList(),
    mailingListController.createMailingList.bind(mailingListController)
);

/**
 * @route GET /api/mailing-lists/:listId
 * @desc Get mailing list by ID with detailed information
 * @access Requires mailing.view_lists or system mailing permissions
 */
router.get('/:listId',
    requireRole('system_admin'),
    MailingListController.validateListId(),
    mailingListController.getMailingListById.bind(mailingListController)
);

/**
 * @route PUT /api/mailing-lists/:listId
 * @desc Update mailing list
 * @access Requires mailing.edit_lists or system mailing permissions
 */
router.put('/:listId',
    requireRole('system_admin'),
    MailingListController.validateUpdateMailingList(),
    mailingListController.updateMailingList.bind(mailingListController)
);

/**
 * @route DELETE /api/mailing-lists/:listId
 * @desc Delete (deactivate) mailing list
 * @access Requires mailing.delete_lists or system mailing permissions
 */
router.delete('/:listId',
    requireRole('system_admin'),
    MailingListController.validateListId(),
    mailingListController.deleteMailingList.bind(mailingListController)
);

// ========================================
// SUBSCRIBER MANAGEMENT ROUTES
// ========================================

/**
 * @route POST /api/mailing-lists/:listId/subscribers
 * @desc Add subscriber to mailing list
 * @access Requires mailing.manage_subscribers or system mailing permissions
 */
router.post('/:listId/subscribers',
    requireRole('system_admin'),
    MailingListController.validateAddSubscriber(),
    mailingListController.addSubscriber.bind(mailingListController)
);

/**
 * @route DELETE /api/mailing-lists/:listId/subscribers/:subscriberId
 * @desc Remove subscriber from mailing list
 * @access Requires mailing.manage_subscribers or system mailing permissions
 */
router.delete('/:listId/subscribers/:subscriberId',
    requireRole('system_admin'),
    MailingListController.validateRemoveSubscriber(),
    mailingListController.removeSubscriber.bind(mailingListController)
);

/**
 * @route GET /api/mailing-lists/:listId/available-users
 * @desc Get available users for subscription
 * @access Requires mailing.view_subscribers or system mailing permissions
 */
router.get('/:listId/available-users',
    requireRole('system_admin'),
    MailingListController.validateListId(),
    mailingListController.getAvailableUsers.bind(mailingListController)
);

/**
 * @route GET /api/mailing-lists/:listId/available-services
 * @desc Get available services for subscription
 * @access Requires mailing.view_subscribers or system mailing permissions
 */
router.get('/:listId/available-services',
    requireRole('system_admin'),
    MailingListController.validateListId(),
    mailingListController.getAvailableServices.bind(mailingListController)
);

// ========================================
// CAMPAIGN MANAGEMENT ROUTES (List-specific)
// ========================================

/**
 * @route GET /api/mailing-lists/:listId/campaigns
 * @desc Get campaigns for a specific mailing list
 * @access Requires mailing.view_campaigns or system mailing permissions
 */
router.get('/:listId/campaigns',
    requireRole('system_admin'),
    MailingListController.validateListId(),
    emailCampaignController.getCampaignsByList.bind(emailCampaignController)
);

/**
 * @route POST /api/mailing-lists/:listId/campaigns
 * @desc Create a new email campaign for mailing list
 * @access Requires mailing.create_campaigns or system mailing permissions
 */
router.post('/:listId/campaigns',
    requireRole('system_admin'),
    EmailCampaignController.validateCreateCampaign(),
    emailCampaignController.createCampaign.bind(emailCampaignController)
);

// ========================================
// SYSTEM-ONLY ROUTES (Higher Permissions Required)
// ========================================

/**
 * @route GET /api/mailing-lists/internal
 * @desc Get internal system mailing lists
 * @access Requires system.mailing_access_internal permission
 */
router.get('/internal',
    requirePermission('system.mailing_access_internal'),
    mailingListController.getInternalMailingLists.bind(mailingListController)
);

/**
 * @route POST /api/mailing-lists/bulk-operations
 * @desc Perform bulk operations on subscribers
 * @access Requires system.mailing_bulk_operations permission
 */
router.post('/bulk-operations',
    requirePermission('system.mailing_bulk_operations'),
    mailingListController.performBulkOperations.bind(mailingListController)
);

/**
 * @route GET /api/mailing/campaigns-analytics/overview
 * @desc Get system-wide campaign analytics overview
 * @access Requires system.mailing_view_analytics permission
 */
router.get('/campaigns-analytics/overview',
    requirePermission('system.mailing_view_analytics'),
    emailCampaignController.getSystemAnalytics.bind(emailCampaignController)
);

// ========================================
// PUBLIC TRACKING ROUTES (No Authentication Required)
// ========================================

/**
 * @route GET /api/mailing/track/open/:trackingId
 * @desc Track email open (tracking pixel)
 * @access Public (no authentication required)
 */
router.get('/track/open/:trackingId', 
    emailCampaignController.trackOpen.bind(emailCampaignController)
);

/**
 * @route GET /api/mailing/track/click/:trackingId
 * @desc Track email click
 * @access Public (no authentication required)
 */
router.get('/track/click/:trackingId',
    emailCampaignController.trackClick.bind(emailCampaignController)
);

/**
 * @route GET /api/mailing/unsubscribe/:token
 * @desc Unsubscribe using token
 * @access Public (no authentication required)
 */
router.get('/unsubscribe/:token',
    mailingListController.unsubscribeByToken.bind(mailingListController)
);

/**
 * @route POST /api/mailing/unsubscribe/:token
 * @desc Process unsubscribe form submission
 * @access Public (no authentication required)
 */
router.post('/unsubscribe/:token',
    mailingListController.processUnsubscribe.bind(mailingListController)
);

module.exports = router;