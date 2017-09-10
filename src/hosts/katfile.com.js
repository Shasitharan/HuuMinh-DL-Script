'use strict';

var request = require('request'),
    meta = require('../meta'),
    rp = require('request-promise');

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
        loginUrl = "http://katfile.com/";

    var options = {
        uri: loginUrl,
        method: 'POST',
        form: {
            login: username,
            password: password,
            op: 'login',
            redirect: 'http://katfile.com/&rand=&token='
        },
        jar: j
    };

    rp(options).then(function (body) {
        var cookie = j.getCookieString(loginUrl);
        callback(null, cookie);
    }).catch(function (err) {
        callback(new Error('Could not connect to katfile.com'));
    });
};

Host.check = function (cookie, callback) {
    rp = rp.defaults({
        headers: {
            cookie: cookie
        }
    });
    rp('http://katfile.com/?op=my_account').then(function (body) {
        if(/Extend Premium account/.test(body)) {
            const regex = /account expire<\/TD><TD><b>(.*)<\/b>/g;
            var match = regex.exec(body);
            if(typeof match[1] !== 'undefined') {
                return callback(null, true, match[1]);
            } else {
                return callback(null, true, "Unknown");
            }
        }
        return callback(null, false, false);
    }).catch(function (err) {
        callback(new Error("Could not connect to katfile.com"));
    });
};

Host.download = function () {
    
};
