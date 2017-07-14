'use strict';
var async = require('async');
var db = require('../database');

var Controllers = module.exports;

Controllers.home = function (req, res, next) {
    var data = {};
    data.title = "HuuMinh DL Script";
    res.render('index', data);
};

Controllers.settings = function (req, res, callback) {
    var data = {};
    data.title = "Settings - HuuMinh DL Script";
    data.navActive = "settings";

    async.waterfall([
        function (next) {
            db.getObject('settings', next);
        },
        function (settings, next) {
            data = extend({}, data, settings);
            res.render('settings', data);
        }
    ], callback);
};

Controllers.updateSettings = function (req, res, next) {
    if(req.xhr) {
        req.body.maintenanceMode = req.body.maintenanceMode || "no";
        req.body.realtimeAnalytics = req.body.realtimeAnalytics || "no";

        async.waterfall([
            function (next) {
                db.setObject('settings', req.body, next);
            },
            function (next) {
                res.json({
                    error: false,
                    message: "Your changes have been saved!"
                });
            }
        ], next);
    } else {
        res.json({
            error: true,
            error_message: "Access Denied"
        })
    }
};

Controllers.files = function (req, res, next) {
    var data = {};
    data.title = "Server Files - HuuMinh DL Script";
    res.render('index', data);
};

Controllers.accounts = function (req, res, next) {
    var data = {};
    data.title = "Accounts - HuuMinh DL Script";
    res.render('index', data);
};

Controllers.profile = function (req, res, next) {
    var data = {};
    data.title = "Profile - HuuMinh DL Script";
    res.render('index', data);
};

Controllers.logout = function (req, res, next) {
    var data = {};
    data.title = "Accounts - HuuMinh DL Script";
    res.render('index', data);
};

function extend(target) {
    var sources = [].slice.call(arguments, 1);
    sources.forEach(function (source) {
        for (var prop in source) {
            target[prop] = source[prop];
        }
    });
    return target;
}