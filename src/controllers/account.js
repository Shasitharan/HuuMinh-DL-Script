'use strict';

var async = require('async');
var winston = require('winston');
var db = require('../database');
var Hosts = require('../hosts');
var Account = module.exports;

Account.list = function (req, res, callback) {
    var data = {};
    data.title = "Accounts";
    data.navActive = "accounts";
    var hostAccounts = [];
    async.waterfall([
        function (next) {
            Hosts.preSupport(next);
        },
        function (supportList, next) {
            data.supportList = supportList;
            db.getSortedSetRevRange('accounts:sorted', 0, -1, next);
        },
        function (accountIds, next) {
            if(!accountIds) {
                next(null, false);
            } else {
                var ids = accountIds.map(function (t) {
                    return 'account:'+t;
                });
                db.getObjects(ids, next);
            }
        },
        function (accounts) {
            data.accounts = accounts;
            res.render('accounts', data);
        }
    ], callback);
};