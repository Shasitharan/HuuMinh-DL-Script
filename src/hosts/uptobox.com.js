'use strict';

var request = require('request'),
    meta = require('../meta'),
    rp = require('request-promise'),
    async = require('async');

request = request.defaults({
    jar: true,
    headers:{
        'User-Agent': meta.config.userAgent,
    },
});
rp = rp.defaults({
    jar: true,
    headers:{
        'User-Agent': meta.config.userAgent,
        'cookie': 'lang=english;'
    },
    simple: false,
    json: false
});

var Host = module.exports;

Host.login = function (username, password, callback) {
    var j = rp.jar(),
        loginUrl = "https://login.uptobox.com/logarithme";

    var options = {
        uri: loginUrl,
        method: 'POST',
        form: {
            login: username,
            password: password,
            op: 'login',
        },
        jar: j
    };

    rp(options).then(function (body) {
        var cookie = j.getCookieString(loginUrl);
        callback(null, cookie);
    }).catch(function (err) {
        callback(new Error('Could not connect to uptobox.com'));
    });
};

Host.check = function (cookie, callback) {
    rp = rp.defaults({
        headers: {
            cookie: cookie
        }
    });
    rp('https://uptobox.com/?op=my_account').then(function (body) {
        if(/Premium-Account expire/.test(body)) {
            const regex = /Premium-Account expire:(.*)<\/strong><\/div>/g;
            var match = regex.exec(body);

            if(typeof match[1] !== 'undefined') {
                return callback(null, true, match[1].trim());
            } else {
                return callback(null, true, "Unknown");
            }
        }
        return callback(null, false, false);
    }).catch(function (err) {
        callback(new Error("Could not connect to uptobox.com"));
    });
};

Host.download = function (url, cookie, callback) {
    var options = {
        url: url,
        headers:{
            'User-Agent': meta.config.userAgent,
            'cookie': cookie
        },
        followRedirect: false,
    };
    async.waterfall([
        function (next) {
            request.get(options, function (err, res) {
                if(err) return callback(null, err.message);
                if(res.headers['location']) {
                    if(/404\.html/.test(res.headers['location'])) return callback(new Error('Link dead'));
                    next(null, res.headers['location']);
                } else {
                    next(null, false);
                }
            });
        },
        function (redirect) {
            if(redirect) return callback(null, redirect);
            callback(null, false);
        }
    ], callback);
};