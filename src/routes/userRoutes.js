const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const dateHelpers = require('../middleware/dateHelpers');
const userController = require('../controllers/userController');

router.use(authMiddleware.authenticate);
router.use(dateHelpers); // Add date helpers after authentication
router.use((req, res, next) => {
    res.locals.layout = 'layouts/userArea.ejs';
    next()
})

router.get('/profile', userController.profile);
router.get('/settings/account', userController.accountSettings);
router.get('/settings/privacy', userController.privacySettings);
router.get('/settings/notifications', userController.notificationSettings);
router.get('/settings/preferences', userController.preferences);

module.exports = router;