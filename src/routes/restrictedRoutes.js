const express = require('express');
const router = express.Router();
const auth = require('../middleware/authentication');

router.use(auth);

router.get('/', (req, res) => {
    res.render('dashboard/home', { layout: 'layouts/restricted.ejs', title: 'test' });
})


module.exports = router;