// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../../controllers/api/userController');
const authMiddleware = require('../../middleware/authentication');
const { apiRateLimit } = require('../../middleware/rateLimit');
const validation = require('../../middleware/validation');

/**
 * All user routes require authentication
 */
router.use(authMiddleware.authenticate);

/**
 * User profile routes
 */

// Get user profile
router.get('/profile',
    apiRateLimit,
    userController.getProfile
);

// Update user profile
router.put('/profile',
    apiRateLimit,
    userController.updateProfile
);

/**
 * Session and activity routes
 */

// Get current session info
router.get('/session',
    apiRateLimit,
    userController.getSessionInfo
);

// Get authentication activity
router.get('/auth-activity',
    apiRateLimit,
    userController.getAuthActivity
);

/**
 * User preferences routes
 */

// Get user preferences
router.get('/preferences',
    apiRateLimit,
    userController.getPreferences
);

// Update user preferences
router.put('/preferences',
    apiRateLimit,
    userController.updatePreferences
);

// Update user language
router.put('/language',
    apiRateLimit,
    validation.validateLanguageUpdate,
    userController.updateLanguage
);

// Get user display preferences
router.get('/display-preferences',
    apiRateLimit,
    userController.getDisplayPreferences
);

// Update user display preferences
router.put('/display-preferences',
    apiRateLimit,
    userController.updateDisplayPreferences
);

/**
 * Mailing list subscription routes
 */

// Get user's mailing list subscriptions
router.get('/mailing-lists',
    apiRateLimit,
    userController.getMailingListSubscriptions.bind(userController)
);

// Unsubscribe from a mailing list
router.delete('/mailing-lists/:listId',
    apiRateLimit,
    userController.unsubscribeFromList.bind(userController)
);

/**
 * Test notification route
 */

// Send test notification
router.post('/test-notification',
    apiRateLimit,
    userController.sendTestNotification
);

module.exports = router;