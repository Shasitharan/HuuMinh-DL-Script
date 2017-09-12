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
        'cookie': 'language=en_us;',
        "Referer": "http://www.yunfile.com/",
    },
});
rp = rp.defaults({
    jar: true,
    headers:{
        'Accept': "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        'User-Agent': meta.config.userAgent,
        'cookie': 'language=en_us;',
        "Referer": "http://www.yunfile.com/",
    },
    simple: false,
    json: false
});

var Host = module.exports;

Host.login = function (username, password, callback) {
    var j = rp.jar(),
        loginUrl = "http://www.yunfile.com/view";

    var options = {
        uri: loginUrl,
        method: 'POST',
        form: {
            module: 'member',
            action: 'validateLogin',
            username: username,
            password: password,
            remember: 1,
        },
        jar: j
    };
    rp(options).then(function (body) {
        var cookie = j.getCookieString(loginUrl);
        callback(null, cookie);
    }).catch(function (err) {
        callback(new Error('Could not connect to yunfile.com'));
    });
};

Host.check = function (cookie, callback) {
    rp = rp.defaults({
        headers: {
            cookie: cookie
        }
    });
    rp('http://www.yunfile.com/user/edit.html').then(function (body) {
        if(/Premium Member/.test(body)) {
            const regex = /\(Expire:(.*)\)/g;
            var match = regex.exec(body);

            if(typeof match[1] !== 'undefined') {
                return callback(null, true, match[1].trim());
            } else {
                return callback(null, true, "Unknown");
            }
        }
        return callback(null, false, false);
    }).catch(function (err) {
        callback(new Error("Could not connect to yunfile.com"));
    });
};

Host.download = function (url, cookie, callback) {
    var j = rp.jar();
    request = request.defaults({
        jar: j,
        headers: {
            cookie: cookie,
            "Referer": url,
        },
        followRedirect: false,
    });
    async.waterfall([
        function (next) {
            request.get(url, function (err, res, body) {
                var filecookie = j.getCookieString(url);
                var regex = /href="(.*)"\sonclick="setCookie\('(.*)',\s'(.*)'/g;
                var match = regex.exec(body);
                if(match) {
                    filecookie = filecookie +"; "+ match[2]+"="+match[3]+';';
                    filecookie = filecookie.split(';');
                    cookie = cookie.split(';');
                    var result = {};
                    for (var i = 0; i < cookie.length; i++) {
                        var cur = cookie[i].split('=');
                        if(cur[0].length > 0){
                            result[cur[0].trim()] = cur[1];
                        }
                    }

                    for (var i = 0; i < filecookie.length; i++) {
                        var cur = filecookie[i].split('=');
                        if(cur[0].length > 0){
                            result[cur[0].trim()] = cur[1];
                        }
                    }
                    var cookie_str = Object.keys(result).map(function (k) {
                        return k+"="+result[k];
                    }).join('; ');

                    return callback(null, {
                        download: match[1],
                        cookie: cookie_str,
                    });
                } else {
                    callback(new Error('Could not connect to yunfile.com'));
                }
            });
        }
    ], callback);
};