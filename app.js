require("dotenv").config();

var createError = require('http-errors');
var express = require('express');
var expresshbs = require('express-handlebars');
var session = require('express-session');
var path = require('path');
var cookieParser = require('cookie-parser');
const { errorHandler } = require('./utils/errorHandler')
const { authentication } = require('./middlewares')
var logger = require('morgan');
var multer = require('multer');
var app = express();

const authRouter = require('./routes/auth');
const amhRouter = require('./routes/amh');
const liquidacionRouter = require('./routes/liquidacion');
const initRouter = require('./routes/desktop');
const cartolaRouter = require('./routes/cartola');

var upload = multer({
    dest: __dirname + '/public/upload/'
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));

app.engine('.hbs', expresshbs({
    defaultLayout: 'main',
    layoutsDir: path.join(app.get('views'), 'layouts'),
    partialsDir: path.join(app.get('views'), 'partials'),
    extname: '.hbs',
    helpers: require('./lib/handlebars')
}));

app.set('view engine', 'hbs');
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(session({
    secret: process.env.JWT_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

function ignoreFavicon(req, res, next) {
    if (req.originalUrl === '/favicon.ico') {
        res.status(204).json({ nope: true });
    } else {
        next();
    }
}

app.use(ignoreFavicon);

app.use(authRouter);
//middleware
app.use(authentication);
app.use(initRouter);
app.use(amhRouter);
app.use(liquidacionRouter);
app.use(cartolaRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

app.use(errorHandler);

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    if (err)
        console.log("Este es el error::", err);

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;