'use strict';

var async = require('async');
var nconf = require('nconf');
var db = require('../database');
var User = module.exports;

User.checkBanned = function(ip, callback) {
    db.exists('lockout:' + ip, callback);
}