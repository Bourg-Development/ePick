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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
//app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(loggerMiddleware);
app.use(ejsLayouts);

const residentRouter = require('./routes/residentsRoutes');
const dashboardRouter = require('./routes/dashboardRoutes');
const apiRouter = require('./routes/apiRoutes');
const indexRouter = require('./routes/indexRoutes');
const restrictedRouter = require('./routes/restrictedRoutes')

app.use('/api', apiRouter)
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/restricted', restrictedRouter)
app.use('/', indexRouter);

module.exports = app;