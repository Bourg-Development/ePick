// routes/api/forensicsRoutes.js
const express = require('express');
const forensicsController = require('../../controllers/api/forensicsController');
const authMiddleware = require('../../middleware/authentication');
const authorizationMiddleware = require('../../middleware/authorization');
const rateLimitMiddleware = require('../../middleware/rateLimit');

const router = express.Router();

// Apply authentication to all forensics routes
router.use(authMiddleware.authenticate);

// Apply rate limiting to forensics endpoints (stricter limits due to sensitive nature)
router.use(rateLimitMiddleware.rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20, // Limit to 20 requests per 15 minutes
    errorMessage: 'Too many forensics requests from this IP, please try again later.',
    logType: 'forensics'
}));

/**
 * @route GET /api/forensics/dashboard
 * @desc Get real-time security dashboard data
 * @access System Admin, Security Analyst
 */
router.get('/dashboard',
    authorizationMiddleware.requirePermission(['forensics.dashboard']),
    forensicsController.getSecurityDashboard
);

/**
 * @route GET /api/forensics/user/:userId/behavior/:days
 * @desc Analyze user behavior patterns for anomalies
 * @access System Admin, Security Analyst
 */
router.get('/user/:userId/behavior/:days',
    authorizationMiddleware.requirePermission(['forensics.analyze']),
    forensicsController.analyzeUserBehavior
);

/**
 * @route GET /api/forensics/user/:userId/behavior
 * @desc Analyze user behavior patterns for anomalies (default 30 days)
 * @access System Admin, Security Analyst
 */
router.get('/user/:userId/behavior',
    authorizationMiddleware.requirePermission(['forensics.analyze']),
    forensicsController.analyzeUserBehavior
);

/**
 * @route POST /api/forensics/investigate
 * @desc Investigate suspicious activity across the system
 * @access System Admin, Security Analyst
 */
router.post('/investigate',
    authorizationMiddleware.requirePermission(['forensics.investigate']),
    forensicsController.investigateSuspiciousActivity
);

/**
 * @route POST /api/forensics/audit-report
 * @desc Generate comprehensive audit report
 * @access System Admin, Compliance Officer
 */
router.post('/audit-report',
    authorizationMiddleware.requirePermission(['forensics.audit_report']),
    forensicsController.generateAuditReport
);

/**
 * @route POST /api/forensics/verify-integrity
 * @desc Verify audit log integrity and detect tampering
 * @access System Admin only
 */
router.post('/verify-integrity',
    authorizationMiddleware.requirePermission(['forensics.verify_integrity']),
    forensicsController.verifyAuditIntegrity
);

module.exports = router;