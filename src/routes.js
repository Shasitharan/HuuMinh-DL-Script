'use strict';
var nconf = require('nconf');
var winston = require('winston');
var path = require('path');
var async = require('async');
var meta = require('./meta');
var controllers = require('./controllers');

module.exports = function (app, middleware, callback) {
    var checkLoggedMiddleware = [middleware.redirectToLoginFormIfNotLoggedIn];
    app.get('/', checkLoggedMiddleware, controllers.home);

    var loginRegisterMiddleware = [middleware.redirectToAccountIfLoggedIn];
    app.get('/login', loginRegisterMiddleware, controllers.login);
    app.post('/login', middleware.applyCSRF, controllers.user.login);
    app.get('/logout', controllers.user.logout);

    app.get('/profile', checkLoggedMiddleware, controllers.profile);
    app.delete('/profile/delete-session', middleware.applyCSRF, checkLoggedMiddleware, controllers.user.deleteSession);

    app.get('/settings', checkLoggedMiddleware, controllers.settings);
    app.get('/accounts', checkLoggedMiddleware, controllers.accounts);
    app.get('/files', checkLoggedMiddleware, controllers.files);

    app.post('/settings', checkLoggedMiddleware, controllers.updateSettings);
    callback();
};