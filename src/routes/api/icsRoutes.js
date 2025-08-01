const express = require('express');
const router = express.Router();
const icsController = require('../../controllers/api/icsController');
const { authenticate } = require('../../middleware/authentication');
const { requirePermission } = require('../../middleware/authorization');
const { generalRateLimit, settingsRateLimit } = require('../../middleware/rateLimit');

// Authenticated routes - users can manage their own ICS feeds
router.post('/enable',
    settingsRateLimit,
    authenticate,
    icsController.enableFeed
);

router.post('/disable',
    settingsRateLimit,
    authenticate,
    icsController.disableFeed
);

router.get('/url',
    generalRateLimit,
    authenticate,
    icsController.getFeedUrl
);

// Public feed route (authenticated by token in URL)
router.get('/feed/:userId/:token',
    generalRateLimit,
    icsController.serveFeed
);

module.exports = router;