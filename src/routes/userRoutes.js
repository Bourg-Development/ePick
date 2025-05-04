// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authentication');
const { apiRateLimit } = require('../middleware/rateLimit');
const validation = require('../middleware/validation');

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
    validation.validateProfileUpdate,
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
    validation.validatePreferences,
    userController.updatePreferences
);

module.exports = router;