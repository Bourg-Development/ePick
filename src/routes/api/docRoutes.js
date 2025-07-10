// routes/docRoutes.js
const express = require('express');
const router = express.Router();
const docController = require('../../controllers/api/docController');
const authMiddleware = require('../../middleware/authentication');
const { apiRateLimit, heavyRateLimit } = require('../../middleware/rateLimit');
const validation = require('../../middleware/validation');

/**
 * All document routes require authentication
 */
router.use(authMiddleware.authenticate);

/**
 * Template information routes
 */

// Get available templates
router.get('/templates',
    apiRateLimit,
    docController.getTemplates
);

// Validate template data
router.post('/validate',
    apiRateLimit,
    validation.validateDocumentData,
    docController.validateTemplate
);

/**
 * Document generation routes
 */

// Generate document from template
router.post('/generate',
    validation.validateDocumentGeneration,
    docController.generateDocument
);

// Preview document (HTML only)
router.post('/preview',
    apiRateLimit,
    validation.validateDocumentData,
    docController.previewDocument
);

module.exports = router;