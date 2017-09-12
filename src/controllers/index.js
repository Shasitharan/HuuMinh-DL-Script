'use strict';

var async = require('async');
var db = require('../database');
var Hosts = require('../hosts');

var Controllers = module.exports;

Controllers.user = require('./user');
Controllers.account = require('./account');

Controllers.download = function (req, res, next) {
    // Do download file by req id
    Hosts.download(req, res, next);
};

Controllers.apiCreate = function (req, res, callback) {
    if(!req.query.link) {
        res.json({
            error: true,
            error_message: "Invalid data"
        });
    } else {
        var data = {
            link: req.query.link,
            ip: req.ip
        };

        async.waterfall([
            function (next) {
                Hosts.generate(data, next);
            },
            function (result, next) {
                if(result) {
                    res.json({
                        error: false,
                        download: result.download_url,
                        filename: result.filename,
                        filesize: result.filesize
                    });
                } else {
                    res.json({
                        error: true,
                        error_message: "Could not connect to server",
                    });
                }
            }
        ], function (err) {
            if(err) {
                res.json({
                    error: true,
                    error_message: err.message,
                });
            } else {
                callback();
            }
        });
    }
};


Controllers.home = function (req, res, next) {
    var data = {};
    data.title = "Download";
    data.navActive = "generate";

    async.waterfall([
        function (next) {
            Hosts.getSupport(next);
        },
        function (supportList, next) {
            data.supportList = supportList;
            res.render('index', data);
        }
    ], next);
};

Controllers.login = function (req, res, next) {
    var data = {};
    var errorText;

    if (req.query.error === 'csrf-invalid') {
        errorText = 'csrf-invalid';
    } else if (req.query.error) {
        errorText = validator.escape(String(req.query.error));
    }

    data.error = req.flash('error')[0] || errorText;
    data.title = "Login";
    res.render('login', data);
}

Controllers.settings = function (req, res, callback) {
    var data = {};
    data.title = "Settings";
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
    data.navActive = "files";
    res.render('index', data);
};

Controllers.accounts = function (req, res, next) {
    var data = {};
    data.title = "Accounts - HuuMinh DL Script";
    res.render('index', data);
};

Controllers.profile = function (req, res, callback) {
    var data = {};
    data.title = "Settings - HuuMinh DL Script";
    data.navActive = "profile";
    async.waterfall([
        function (next) {
            Controllers.user.getUserFields(req.uid, ['username', 'email', 'lastonline'], next);
        },
        function (userdata, next) {
            data.user = userdata;
            Controllers.user.getUserSessions(req.uid, req.sessionID, next);
        },
        function (session, next) {
            data.userSessions = session;
            res.render('profile', data);
        }
    ], callback);
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