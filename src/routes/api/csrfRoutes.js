// routes/api/csrfRoutes.js
const express = require('express');
const router = express.Router();
const csrfController = require('../../controllers/api/csrfController');
const { authenticate, optionalAuth } = require('../../middleware/authentication');
const { verifyCSRFToken } = require('../../middleware/csrf');
const { generalRateLimit } = require('../../middleware/rateLimit');

/**
 * CSRF token management routes
 */

// Apply rate limiting to all CSRF routes
router.use(generalRateLimit);

/**
 * @route   GET /api/csrf/token
 * @desc    Get a new CSRF token
 * @access  Public (but rate limited)
 */
router.get('/token', csrfController.getToken);

/**
 * @route   GET /api/csrf/status
 * @desc    Get CSRF protection status
 * @access  Public (but rate limited)
 */
router.get('/status', csrfController.getStatus);

/**
 * @route   POST /api/csrf/verify
 * @desc    Verify CSRF token (for testing)
 * @access  Public (but rate limited)
 */
router.post('/verify', verifyCSRFToken, csrfController.verifyToken);

module.exports = router;