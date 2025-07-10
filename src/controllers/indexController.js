module.exports = {
    login: (req, res, next) => {
        let error = null;
        if (req.query.error === 'session_expired') {
            error = 'Your session has expired. Please log in again.';
        }
        
        res.render('auth/login.ejs', { 
            title: 'Login',
            query: req.query,
            error: error
        });
    },
    register: (req, res, next) => {
        res.render('auth/register.ejs', { title: 'register' });
    },
    logout: (req, res) => {
        res.redirect('/api/auth/logout')
    },
    home: (req, res) => {
        res.render('public/home.ejs', { title: 'Home', styles: [ '/pages/public/home.css' ], scripts: [ '/pages/public/home.js' ] })
    },

    privacyPolicy: async (req, res) => {
        try {
            res.render('legal/privacy', {
                title: 'Privacy Policy',
                layout: 'layouts/public'
            });
        } catch (error) {
            console.error('Error rendering privacy policy:', error);
            res.status(500).render('errors/500', {
                title: 'Server Error',
                layout: 'layouts/public'
            });
        }
    },

    termsOfService: async (req, res) => {
        try {
            res.render('legal/terms', {
                title: 'Terms of Service',
                layout: 'layouts/public'
            });
        } catch (error) {
            console.error('Error rendering terms of service:', error);
            res.status(500).render('errors/500', {
                title: 'Server Error',
                layout: 'layouts/public'
            });
        }
    },

    compliance: async (req, res) => {
        try {
            res.render('legal/compliance', {
                title: 'Compliance',
                layout: 'layouts/public'
            });
        } catch (error) {
            console.error('Error rendering compliance page:', error);
            res.status(500).render('errors/500', {
                title: 'Server Error',
                layout: 'layouts/public'
            });
        }
    }

}