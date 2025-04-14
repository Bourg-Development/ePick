require('dotenv').config()

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const ejsLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const loggerMiddleware = require('./middleware/loggerMiddleware');
const path = require("node:path");


const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/restricted.ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
//app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(loggerMiddleware);
app.use(ejsLayouts);

const residentRouter = require('./routes/residentsRoutes');
const dashboardRouter = require('./routes/dashboardRoutes');
const apiRouter = require('./routes/apiRoutes');

app.use('/api', apiRouter)
app.use('/static', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', {title: 'MedTrack'}, );
})

app.get('/login', (req, res) => {
    res.render('auth/login', {title: 'MedTrack', layout: 'layouts/auth.ejs'} );
})

app.get('/register', (req, res) => {
    res.render('auth/register', {title: 'MedTrack', layout: 'layouts/auth.ejs'} );
})

module.exports = app;