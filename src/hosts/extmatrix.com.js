'use strict';

var request = require('request'),
    meta = require('../meta'),
    rp = require('request-promise'),
    async = require('async');

request = request.defaults({
    jar: true,
    headers:{
        'Accept': "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        'User-Agent': meta.config.userAgent,
    },
});
rp = rp.defaults({
    jar: true,
    headers:{
        'Accept': "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        'User-Agent': meta.config.userAgent,
        'cookie': 'lang=english;'
    },
    simple: false,
    json: false
});

var Host = module.exports;

Host.check = function (cookie, callback) {
    var j = rp.jar();
    rp = rp.defaults({
        jar: j,
        headers: {
            cookie: cookie
        }
    });
    rp('https://www.extmatrix.com/').then(function (body) {
        //var cookie = j.getCookieString('https://www.extmatrix.com/');
        if(/Premium Member/.test(body)) {
            if(body) {
                var match = body.match(/<td>(.*)<\/td>/g);
                if(match && typeof match[7] !== 'undefined') {
                    var expire = match[7].replace('<td>', '').replace('</td>', '');
                    return callback(null, true, expire);
                } else {
                    return callback(null, true, "Unknown");
                }
            }
        }
        return callback(null, false, false);
    }).catch(function (err) {
        callback(new Error(err.message));
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
            request.get(options, function (err, res, body) {
                if(err) return callback(null, err.message);
                if(/requested does not exists/.test(res.body)) {
                    return callback(new Error('Link dead'));
                } else if(/default\/images\/buy_now\.gif/.test(res.body)) {
                    return callback(new Error('Account limit'));
                }
                if(res.headers['location'])
                    next(null, res.headers['location']);
                else {
                    var regex = /id='jd_support' href="(.*)"><\/a>/g;
                    var match = regex.exec(body);
                    if(match) {
                        next(null, match[1].trim());
                    }else {
                        return callback(new Error('Could not connect to extmatrix.com'));
                    }
                }
            });
        },
        function (redirect) {
            if(redirect) return callback(null, redirect);
            callback(null, false);
        }
    ], callback);
};