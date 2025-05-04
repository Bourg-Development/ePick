const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authentication');

router.use(authMiddleware.authenticate);

router.get('/dashboard', (req, res) => {
    res.render('dashboard/home', { layout: 'layouts/restricted.ejs', title: 'test', styles: [ '/pages/restricted/dashboard/home.css' ] });
})


module.exports = router;