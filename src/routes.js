'use strict';
var nconf = require('nconf');
var winston = require('winston');
var path = require('path');
var async = require('async');
var meta = require('./meta');
var controllers = require('./controllers');

module.exports = function (app, middleware, callback) {
    app.get('/', controllers.home);
    app.get('/settings', controllers.settings);
    app.get('/accounts', controllers.accounts);
    app.get('/files', controllers.files);
    app.get('/logout', controllers.logout);
    app.get('/profile', controllers.profile);

    app.post('/settings', controllers.updateSettings);

    callback();
};