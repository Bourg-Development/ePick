// controllers/administrationController.js
const authService = require('../services/authService');

/**
 * Administration Controller
 * Handles system administrator-only pages
 */

/**
 * Render mailing lists management page
 */
const mailingLists = async (req, res) => {
    try {
        // Check if user is a system administrator
        if (req.auth.role !== 'system_admin') {
            return res.status(403).render('errors/unauthorized', {
                title: 'Access Denied',
                layout: 'layouts/restricted'
            });
        }

        res.render('dashboard/mailing-lists', {
            title: 'Mailing Lists',
            layout: 'layouts/restricted',
            styles: ['/pages/restricted/dashboard/mailing-lists.css'],
            scripts: ['/pages/restricted/dashboard/mailing-lists.js']
        });
    } catch (error) {
        console.error('Error rendering mailing lists page:', error);
        res.status(500).render('errors/500', {
            title: 'Server Error',
            layout: 'layouts/restricted'
        });
    }
};

/**
 * Render email campaigns management page
 */
const emailCampaigns = async (req, res) => {
    try {
        // Check if user is a system administrator
        if (req.auth.role !== 'system_admin') {
            return res.status(403).render('errors/unauthorized', {
                title: 'Access Denied',
                layout: 'layouts/restricted'
            });
        }

        res.render('dashboard/email-campaigns', {
            title: 'Email Campaigns',
            layout: 'layouts/restricted',
            styles: ['/pages/restricted/dashboard/email-campaigns.css'],
            scripts: ['/pages/restricted/dashboard/email-campaigns.js']
        });
    } catch (error) {
        console.error('Error rendering email campaigns page:', error);
        res.status(500).render('errors/500', {
            title: 'Server Error',
            layout: 'layouts/restricted'
        });
    }
};

/**
 * Render mailing analytics page
 */
const mailingAnalytics = async (req, res) => {
    try {
        // Check if user is a system administrator
        if (req.auth.role !== 'system_admin') {
            return res.status(403).render('errors/unauthorized', {
                title: 'Access Denied',
                layout: 'layouts/restricted'
            });
        }

        res.render('dashboard/mailing-analytics', {
            title: 'Mailing Analytics',
            layout: 'layouts/restricted',
            styles: ['/pages/restricted/dashboard/mailing-analytics.css'],
            scripts: ['/pages/restricted/dashboard/mailing-analytics.js']
        });
    } catch (error) {
        console.error('Error rendering mailing analytics page:', error);
        res.status(500).render('errors/500', {
            title: 'Server Error',
            layout: 'layouts/restricted'
        });
    }
};

/**
 * Render system administration page
 */
const system = async (req, res) => {
    try {
        // Check if user is a system administrator
        if (req.auth.role !== 'system_admin') {
            return res.status(403).render('errors/unauthorized', {
                title: 'Access Denied',
                layout: 'layouts/restricted'
            });
        }

        res.render('dashboard/system', {
            title: 'System Administration',
            layout: 'layouts/restricted',
            styles: ['/pages/restricted/dashboard/system.css'],
            scripts: ['/pages/restricted/dashboard/system.js']
        });
    } catch (error) {
        console.error('Error rendering system administration page:', error);
        res.status(500).render('errors/500', {
            title: 'Server Error',
            layout: 'layouts/restricted'
        });
    }
};

module.exports = {
    mailingLists,
    emailCampaigns,
    mailingAnalytics,
    system
};