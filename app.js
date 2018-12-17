const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
require('./app/helpers/logHandler');
const errorHandle = require('./app/helpers/errors/errorHandle');
const reqEndLog = require('./app/helpers/reqEndLog');
const ApiErrorHandler = require('./app/helpers/errors/ApiErrorHandler');

// middleware
require('./app/helpers/elasticsearchHandler');

const indexRouter = require('./app/routes/indexRouter');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'app/views'));
app.set('view engine', 'ejs');

//
// // mongoDB setup
// const mongoHandler = require('./app/helpers/mongooseHandler');
// mongoHandler.connect();

// app use setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(reqEndLog);

app.use('/', indexRouter, ApiErrorHandler);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(errorHandle);

module.exports = app;
