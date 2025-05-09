const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');
const dashboardController = require('../controllers/dashboardController')

router.use(authMiddleware.authenticate);
router.use((req, res, next) => {
    res.locals.layout = 'layouts/restricted.ejs';
    next()
})

router.get('/dashboard', (req, res) => {
    res.render('dashboard/home', { layout: 'layouts/restricted.ejs', title: 'test', styles: [ '/pages/restricted/dashboard/home.css' ] });
})

router.get('/dashboard/analyses', dashboardController.analyses)


module.exports = router;