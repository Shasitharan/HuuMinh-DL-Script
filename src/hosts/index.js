'use strict';

var fs = require('fs');
var async = require('async');
var winston = require('winston');
const url = require('url');

var db = require('../database');

var Hosts = module.exports;
var HostSupport = {};

Hosts.init = function (callback) {
    requireModules();
    callback();
};

Hosts.generate = function (link, callback) {
    if(!link) return callback('Invalid data');
    winston.info('Generating download link');

    var urlParse = url.parse(link);
    if(!urlParse.hostname) return callback('Invalid url');
    var hostname = urlParse.hostname;
    async.waterfall([
        function (next) {
            Hosts.checkSupport(hostname, next);
        },
        function (status, next) {
            if(!status) return callback(new Error(hostname+' is not supported'));
        }
    ], callback);
};

Hosts.preSupport = function (callback) {
    var SupportList = [];
    Object.keys(HostSupport).map(function (t) {
        var module = HostSupport[t];
        if(typeof module.login === 'function' || typeof module.check === 'function') {
            SupportList.push(t);
        }
    });
    callback(null, SupportList);
};

Hosts.getSupport = function (callback) {
    var support = Object.keys(HostSupport);
    callback(null, support);
};

Hosts.checkSupport = function(hostname, callback) {
    if(!hostname) return callback(null, false);
    var module = HostSupport[hostname];
    if(!module) return callback(null, false);
    if(typeof module.login === 'function' || typeof module.check === 'function') {
        return callback(null, true);
    } else {
        return callback(null, false);
    }
};

Hosts.addAccount = function (data, callback) {
    winston.info('Add filehost account');

    var hostname    = data.hostname,
        account     = data.account,
        type        = 'account',
        accountArr  = account.split(':');

    if(typeof accountArr[1] === 'undefined') {
        type = 'cookie';
    }

    var module = HostSupport[hostname],
        cookie = "";

    async.waterfall([
        function(next) {
            if(type === 'account') {
                module.login(accountArr[0], accountArr[1], next);
            } else {
                next(null, account);
            }
        },
        function (c, next) {
            cookie = c;
            module.check(cookie, next);
        },
        function (status, expire, next) {
            if(!status) {
                return callback(new Error("Account Invalid"));
            } else {
                var accountObj = {
                    id: 0,
                    type: type,
                    hostname: hostname,
                    data: data.account,
                    status: 'valid',
                    expire: expire
                };
                async.waterfall([
                    function (next) {
                        db.incrObjectField('global', 'nextAccountId', next);
                    },
                    function (_id, next) {
                        accountObj.id = _id;
                        db.setObject('account:'+accountObj.id, accountObj, next);
                    },
                    function (next) {
                        async.parallel([
                            async.apply(db.sortedSetAdd, 'accounts:'+hostname, 0, accountObj.id),
                            async.apply(db.sortedSetAdd, 'accounts:sorted', 0, accountObj.id),
                            async.apply(db.set, 'cookies:'+accountObj.id, cookie)
                        ],next);
                    },
                    function () {
                        return callback(null, accountObj);
                    }
                ], next);
            }
        }
    ], callback);
};

Hosts.checkAccount = function (id, callback) {
    var module,
        cookie = "",
        account;
    async.waterfall([
        function (next) {
            db.getObject("account:"+id, next);
        },
        function (_account, next) {
            if(!_account) return callback(new Error("Invalid Account Data"));
            account = _account;
            module = HostSupport[account.hostname];
            if(account.type === "account") {
                var accountArr  = account.data.split(':');
                module.login(accountArr[0], accountArr[1], next);
            } else {
                next(null, account.data);
            }
        },
        function (_cookie, next) {
            cookie = _cookie;
            module.check(cookie, next);
        },
        function (valid, expire) {
            var status = "invalid";
            if(valid){
                db.set('cookies:'+account.id, cookie);
                status = "valid";
            }
            db.setObjectField('account:'+account.id, 'status', status);
            callback(null, {
                'status': status,
                'expire': expire
            });
        }
    ], callback);
};

Hosts.removeAccount = function(id, callback) {
    async.waterfall([
        function (next) {
            db.getObject('account:'+id, next);
        },
        function (account, next) {
            if(!account) return callback(new Error("Invalid account id"));
            async.parallel([
                async.apply(db.delete, 'account:'+id),
                async.apply(db.delete, 'cookies:'+id),
                async.apply(db.sortedSetRemove,'accounts:sorted', id),
                async.apply(db.sortedSetRemove,'accounts:'+account.hostname, id),
            ], next);
        }
    ], callback);
};

function requireModules() {
    async.waterfall([
        function (next) {
            fs.readdir(__dirname, function(err, filenames) {
                next(null, filenames);
            });
        },
        function (files, next) {
            if(!files) return false;

            files.forEach(function (file) {
                if(file !== 'index.js') {
                    var module = file.replace('.js', '');
                    HostSupport[module] = require('./' + module);
                }
            });
        }
    ], function (err, results) {
        if(err) return false;
    });

}


