'use strict';

var async = require('async');
var path = require('path');
var csrf = require('csurf');
var validator = require('validator');
var nconf = require('nconf');
var ensureLoggedIn = require('connect-ensure-login');
var toobusy = require('toobusy-js');
var meta = require('../meta');
var file = require('../file');
var middleware = module.exports;

middleware.applyCSRF = csrf();
middleware.ensureLoggedIn = ensureLoggedIn.ensureLoggedIn(nconf.get('relative_path') + '/login');

require('./headers')(middleware);
require('./render')(middleware);

middleware.redirectToAccountIfLoggedIn = function (req, res, next) {
    if (req.session.forceLogin || !req.uid) {
        return next();
    }
    res.redirect('/');

};

middleware.redirectToLoginFormIfNotLoggedIn = function (req, res, next) {
    if (req.uid) {
        return next();
    }
    res.redirect('/login');
}