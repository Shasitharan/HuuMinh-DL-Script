'use strict';

var fs = require('fs');
var async = require('async');
var winston = require('winston');
var request = require('request');
var meta = require('../meta');
var utils = require('../utils');
var nconf = require('nconf');
const url = require('url');


var db = require('../database');

var Hosts = module.exports;
var HostSupport = {};

Hosts.init = function (callback) {
    requireModules();
    callback();
};

Hosts.generate = function (data, callback) {
    if(!data.link) return callback('Invalid data');
    winston.info('Generating download link');
    var link = data.link;
    var urlParse = url.parse(link);
    if(!urlParse.hostname) return callback('Invalid url');
    var hostname = urlParse.hostname.toLowerCase();
    async.waterfall([
        function (next) {
            Hosts.checkSupport(hostname, next);
        },
        function (status, next) {
            var module = HostSupport[hostname];
            if(!status || !module) return callback(new Error(hostname+' is not supported'));

            if(typeof module.login === 'function' || typeof module.check === 'function') {
                // Premium Leeching
                premiumGenerate(module, data, next);
            } else {
                // Free Leeching
            }
        },
        function (result, next) {
            if(result) {
                var resp = {
                    'download_url': nconf.get('url') + 'download/' + result.id,
                    'filename': result.filename,
                    'filesize': result.filesize
                };
                callback(null, resp);
            }
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

function premiumGenerate(module, data, callback) {
    var link = data.link;
    var urlParse = url.parse(link);
    if(!urlParse.hostname) return callback('Invalid url');
    var hostname = urlParse.hostname.toLowerCase();
    var cookie, download_url;
    async.waterfall([
        function (next) {
            db.getSortedSetRevRange('accounts:'+hostname, 0, -1, next);
        },
        function (ids, next) {
            if(ids.length === 0) return callback(new Error("No account for "+hostname+" was found!"));
            var keys = ids.map(function (id) {
                return 'account:'+id;
            });
            db.getObjects(keys, next);
        },
        function (accounts, next) {
            getCookie(accounts, next);
        },
        function (_cookie, next) {
            cookie = _cookie;
            module.download(link, cookie, next);
        },
        function (result, next) {
            if(!result) return callback(new Error('Generate link error'));
            download_url = result;
            getFile(download_url, cookie, next);
        },
        function (filename, filesize, next) {
            if(filename === 'unknown') {
                var downloadUrlParse = download_url.split('/');
                if(downloadUrlParse[downloadUrlParse.length-1]) filename = downloadUrlParse[downloadUrlParse.length-1];
            }
            var download_id = utils.generateUUID();
            var download = {
                id: download_id,
                download: download_url,
                cookie: cookie,
                filename: filename,
                filesize: filesize,
                original: link,
                ip: data.ip
            };

            db.setObject('download:'+download_id, download);
            db.expire('download:'+download_id, 3600);
            callback(null, download);
        }
    ], callback);
}

function getFile(url, cookie, callback) {
    request = request.defaults({
        'User-Agent': meta.config.userAgent,
        'cookie': cookie
    });
    var regexp = /filename=\"(.*)\"/gi;

    request.head(url, function (err, res) {
        var filesize = res.headers['content-length'];
        var matche = regexp.exec( res.headers['content-disposition'] );
        var filename = "unknown";
        if(matche) filename = matche[1].trim();
        callback(null, filename, filesize);
    });
}

function getCookie(accounts, callback) {
    if(typeof accounts[0] === 'undefined') return callback(null, false);
    var account = accounts[0];
    async.waterfall([
        function (next) {
            db.get('accounts:errors:'+account.id, next);
        },
        function (err, next) {
            if(err) {
                return getCookie(accounts.splice(0), callback);
            }
            db.get('cookies:'+account.id, next);
        },
        function (cookie, next) {
            return callback(null, cookie);
        }
    ], callback);
}

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


