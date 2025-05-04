const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');
const authMiddleware = require('../middleware/authentication');


router.use('/auth', (req, res, next) => {
    res.locals.layout = 'layouts/auth';
    next();
})

router.get('/auth/login', authMiddleware.nonAuth, indexController.login);

router.get('/auth/register', authMiddleware.nonAuth, indexController.register)

router.get('/', (req, res) => {
    res.render('public/home.ejs', { title: 'test' })
})

module.exports = router;