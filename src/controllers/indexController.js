module.exports = {
    login: (req, res, next) => {
        res.render('auth/login.ejs', { title: 'Login'} );
    },
    register: (req, res, next) => {
        res.render('auth/register.ejs', { title: 'register' });
    }

}