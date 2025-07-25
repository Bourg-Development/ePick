const organizationSettingsService = require('../services/organizationSettingsService');

module.exports = {
    profile: async (req, res) => {
        try {
            // Get the self_service setting to determine if profile is editable
            const selfServiceSetting = await organizationSettingsService.getSetting('self_service');

            // Default to false if setting doesn't exist or there's an error
            let editableProfile = false;

            if (selfServiceSetting.success && selfServiceSetting.setting) {
                editableProfile = selfServiceSetting.setting.value;
            }

            res.render('userArea/profile', {
                title: 'My Profile - ePick',
                styles: ['/pages/me/profile.css'],
                scripts: ['/pages/me/profile.js'],
                editableProfile: editableProfile
            });
        } catch (error) {
            console.error('Error loading profile page:', error);

            // On error, default to non-editable profile
            res.render('userArea/profile', {
                title: 'My Profile - ePick',
                styles: ['/pages/me/profile.css'],
                scripts: ['/pages/me/profile.js'],
                editableProfile: false
            });
        }
    },

    accountSettings: async (req, res) => {
        try {
            // Get the self_service setting to determine if account is editable
            const selfServiceSetting = await organizationSettingsService.getSetting('self_service');
            let editableAccount = false;

            if (selfServiceSetting.success && selfServiceSetting.setting) {
                editableAccount = selfServiceSetting.setting.value;
            }

            res.render('userArea/account', {
                title: 'Account Settings - ePick',
                styles: ['/pages/me/account.css'],
                scripts: ['/pages/me/account.js'],
                editableAccount: editableAccount
            });
        } catch (error) {
            console.error('Error loading account settings page:', error);
            res.status(500).render('errors/500', {
                title: 'Server Error'
            });
        }
    },

    privacySettings: async (req, res) => {
        try {
            res.render('userArea/privacy', {
                title: 'Privacy & Security - ePick',
                styles: ['/pages/me/privacy.css'],
                scripts: ['/pages/me/privacy.js']
            });
        } catch (error) {
            console.error('Error loading privacy settings page:', error);
            res.status(500).render('errors/500', {
                title: 'Server Error'
            });
        }
    },

    integrations: async (req, res) => {
        try {
            res.render('userArea/integrations', {
                title: 'Integrations & Notifications - ePick',
                styles: ['/pages/me/integrations.css'],
                scripts: ['/pages/me/integrations.js'],
                locale: req.locale || 'en'
            });
        } catch (error) {
            console.error('Error loading integrations page:', error);
            res.status(500).render('errors/500', {
                title: 'Server Error'
            });
        }
    }
}