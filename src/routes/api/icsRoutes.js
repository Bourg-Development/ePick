const express = require('express');
const router = express.Router();
const icsController = require('../../controllers/api/icsController');
const { authenticate } = require('../../middleware/authentication');
const { requirePermission } = require('../../middleware/authorization');
const { generalRateLimit, settingsRateLimit } = require('../../middleware/rateLimit');

// Authenticated routes
router.post('/enable',
    settingsRateLimit,
    authenticate,
    requirePermission(['read.own']),
    icsController.enableFeed
);

router.post('/disable',
    settingsRateLimit,
    authenticate,
    requirePermission(['read.own']),
    icsController.disableFeed
);

router.get('/url',
    generalRateLimit,
    authenticate,
    requirePermission(['read.own']),
    icsController.getFeedUrl
);

// Public feed route (authenticated by token in URL)
router.get('/feed/:userId/:token',
    generalRateLimit,
    icsController.serveFeed
);

module.exports = router;