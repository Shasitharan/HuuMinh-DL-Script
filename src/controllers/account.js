'use strict';

var async = require('async');
var winston = require('winston');
var db = require('../database');

var Account = module.exports;

Account.list = function (req, res, callback) {
    var data = {};
    data.title = "Accounts";
    data.navActive = "accounts";
    res.render('accounts', data);
}