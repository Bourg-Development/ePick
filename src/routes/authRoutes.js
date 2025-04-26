// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authenticate = require('../middleware/authentication');
const { authRateLimit } = require('../middleware/rateLimit');
const validation = require('../middleware/validation');

/**
 * Public authentication routes (no authentication required)
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

// Refresh token
router.post('/refresh-token',
    authRateLimit,
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
 */

// Logout
router.post('/logout',
    authenticate,
    authController.logout
);

// Change password
router.post('/change-password',
    authenticate,
    validation.validatePasswordChange,
    authController.changePassword
);

// Setup TOTP for 2FA
router.post('/setup-totp',
    authenticate,
    authController.setupTOTP
);

// Enable TOTP after verification
router.post('/enable-totp',
    authenticate,
    validation.validateTOTP,
    authController.enableTOTP
);

// Check authentication status
router.get('/status',
    authenticate,
    authController.checkAuthStatus
);

// WebAuthn registration - step 1: get options
router.post('/webauthn-register-options',
    authenticate,
    authController.requestWebAuthnRegistration
);

// WebAuthn registration - step 2: verify and save credential
router.post('/webauthn-register-complete',
    authenticate,
    validation.validateWebAuthnRegistration,
    authController.completeWebAuthnRegistration
);

module.exports = router;