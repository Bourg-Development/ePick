module.exports = {
    login: (req, res, next) => {
        let error = null;
        if (req.query.error === 'session_expired') {
            error = 'Your session has expired. Please log in again.';
        }
        
        res.render('auth/login.ejs', { 
            title: 'Login - ePick',
            query: req.query,
            error: error
        });
    },
    register: (req, res, next) => {
        res.render('auth/register.ejs', { title: 'Register - ePick' });
    },
    logout: (req, res) => {
        res.redirect('/api/auth/logout')
    },
    home: (req, res) => {
        res.render('public/home.ejs', { title: 'ePick - Blood Analysis Management System', styles: [ '/pages/public/home.css' ], scripts: [ '/pages/public/home.js' ] })
    },

    privacyPolicy: async (req, res) => {
        try {
            res.render('legal/privacy', {
                title: 'Privacy Policy - ePick',
                layout: 'layouts/public'
            });
        } catch (error) {
            console.error('Error rendering privacy policy:', error);
            res.status(500).render('errors/500', {
                title: 'Server Error - ePick',
                layout: 'layouts/public'
            });
        }
    },

    termsOfService: async (req, res) => {
        try {
            res.render('legal/terms', {
                title: 'Terms of Service - ePick',
                layout: 'layouts/public'
            });
        } catch (error) {
            console.error('Error rendering terms of service:', error);
            res.status(500).render('errors/500', {
                title: 'Server Error - ePick',
                layout: 'layouts/public'
            });
        }
    },

    compliance: async (req, res) => {
        try {
            res.render('legal/compliance', {
                title: 'Compliance - ePick',
                layout: 'layouts/public'
            });
        } catch (error) {
            console.error('Error rendering compliance page:', error);
            res.status(500).render('errors/500', {
                title: 'Server Error - ePick',
                layout: 'layouts/public'
            });
        }
    }

}