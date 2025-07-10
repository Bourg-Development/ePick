// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/api/authController');
const authMiddleware = require('../../middleware/authentication');
const { authRateLimit, refreshRateLimit } = require('../../middleware/rateLimit');
const validation = require('../../middleware/validation');

/**
 * Public authentication routes (no authentication required)
 * IMPORTANT: These MUST come before any router.use() middleware
 */

// Login with username and password
router.post('/login',
    authRateLimit,
    validation.validateLogin,
    authController.login
);

// Verify TOTP for 2FA
router.post('/verify-totp',
    authRateLimit,
    validation.validateTOTP,
    authController.verifyTOTP
);

// Verify WebAuthn for 2FA
router.post('/verify-webauthn',
    authRateLimit,
    validation.validateWebAuthn,
    authController.verifyWebAuthn
);

// Refresh token - CRITICAL: This must be defined BEFORE any auth middleware
router.get('/refresh-token',
    refreshRateLimit,
    validation.validateRefreshToken,
    authController.refreshToken
);

// Register with reference code
router.post('/register',
    authRateLimit,
    validation.validateRegistration,
    authController.register
);

// Validate reference code
router.get('/reference-code/:code',
    authRateLimit,
    authController.validateReferenceCode
);

// Get available authentication methods for a username
router.post('/auth-methods',
    authRateLimit,
    validation.validateUsername,
    authController.listAuthMethods
);

/**
 * Protected authentication routes (authentication required)
 * Apply auth middleware to specific routes instead of using router.use()
 */

// Logout
router.get('/logout',
    authMiddleware.authenticate,
    authController.logout
);

// Change password
router.post('/change-password',
    authMiddleware.authenticate,
    validation.validatePasswordChange,
    authController.changePassword
);

// Setup TOTP for 2FA
router.post('/setup-totp',
    authMiddleware.authenticate,
    authController.setupTOTP
);

// Enable TOTP after verification
router.post('/enable-totp',
    authMiddleware.authenticate,
    validation.validateTOTP,
    authController.enableTOTP
);

// Check authentication status
router.get('/status',
    authMiddleware.authenticate,
    authController.checkAuthStatus
);

// WebAuthn registration - step 1: get options
router.post('/webauthn-register-options',
    authMiddleware.authenticate,
    authController.requestWebAuthnRegistration
);

// WebAuthn registration - step 2: verify and save credential
router.post('/webauthn-register-complete',
    authMiddleware.authenticate,
    validation.validateWebAuthnRegistration,
    authController.completeWebAuthnRegistration
);

module.exports = router;