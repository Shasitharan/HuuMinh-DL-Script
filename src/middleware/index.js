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

require('./headers')(middleware);
require('./render')(middleware);