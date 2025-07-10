const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');
const statusController = require('../controllers/statusController');
const authMiddleware = require('../middleware/authentication');


router.use('/auth', (req, res, next) => {
    res.locals.layout = 'layouts/auth';
    next();
})

router.get('/auth/login', authMiddleware.nonAuth, indexController.login);

router.get('/auth/register', authMiddleware.nonAuth, indexController.register);

router.get('/auth/logout', authMiddleware.authenticate, indexController.logout);

router.get('/', indexController.home);

// Public status page with optional authentication
router.get('/status', authMiddleware.optionalAuth, statusController.statusPage);

// Status data API (for AJAX updates)
router.get('/status/data', statusController.getStatusData);

// Legal pages
router.get('/privacy', indexController.privacyPolicy);
router.get('/terms', indexController.termsOfService);
router.get('/compliance', indexController.compliance);

module.exports = router;