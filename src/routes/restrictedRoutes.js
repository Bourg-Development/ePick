const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const dateHelpers = require('../middleware/dateHelpers');
const dashboardController = require('../controllers/dashboardController');
const administrationController = require('../controllers/administrationController');

router.use(authMiddleware.authenticate);
router.use(dateHelpers); // Add date helpers after authentication
router.use((req, res, next) => {
    res.locals.layout = 'layouts/restricted.ejs';
    // Make user permissions available to frontend
    res.locals.userPermissions = req.auth?.permissions || [];
    res.locals.userRole = req.auth?.role || '';
    next()
})

router.get('/dashboard', (req, res) => {
    res.render('dashboard/home', { 
        layout: 'layouts/restricted.ejs', 
        title: 'Dashboard', 
        styles: [ '/pages/restricted/dashboard/home.css' ],
        scripts: [ '/pages/restricted/dashboard/home.js' ]
    });
})

router.get('/dashboard/analyses', dashboardController.analyses)
router.get('/dashboard/users', dashboardController.users)
router.get('/dashboard/archive', dashboardController.archive)
router.get('/dashboard/security', dashboardController.security)
router.get('/dashboard/data-management', dashboardController.dataManagement)

// Prescription verification route
router.get('/prescriptions/verify/:recurringAnalysisId', (req, res) => {
    res.render('dashboard/prescription-verify', {
        title: 'Verify Prescription',
        styles: ['/pages/restricted/dashboard/prescription-verify.css'],
        scripts: ['/pages/restricted/dashboard/prescription-verify.js']
    });
})

// Settings routes
router.get('/settings/org-settings', dashboardController.org_settings)
router.get('/settings/rooms', dashboardController.rooms)
router.get('/settings/services', dashboardController.services)
router.get('/settings/patients', dashboardController.patients)

// Administration routes
router.get('/administration/mailing-lists', administrationController.mailingLists)
router.get('/administration/email-campaigns', administrationController.emailCampaigns)
router.get('/administration/mailing-analytics', administrationController.mailingAnalytics)
router.get('/administration/system', administrationController.system)





module.exports = router;