module.exports = {
    login: (req, res, next) => {
        res.render('auth/login.ejs', { title: 'Login'} );
    },
    register: (req, res, next) => {
        res.render('auth/register.ejs', { title: 'register' });
    },
    logout: (req, res) => {
        res.redirect('/api/auth/logout')
    },
    home: (req, res) => {
        res.render('public/home.ejs', { title: 'Home', styles: [ '/pages/public/home.css' ], scripts: [ '/pages/public/home.js' ] })
    }

}