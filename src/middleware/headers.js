'use strict';

var meta = require('../meta');
var async = require('async');

module.exports = function (middleware) {
    middleware.addHeaders = function (req, res, next) {
        var headers = {
            'X-Powered-By': "HuuMinh DL Script",
            'X-Frame-Options': meta.config['allow-from-uri'] ? 'ALLOW-FROM ' + encodeURI(meta.config['allow-from-uri']) : 'SAMEORIGIN',
            'Access-Control-Allow-Methods': encodeURI(meta.config['access-control-allow-methods'] || ''),
            'Access-Control-Allow-Headers': encodeURI(meta.config['access-control-allow-headers'] || ''),
        };

        if (meta.config['access-control-allow-origin']) {
            headers['Access-Control-Allow-Origin'] = encodeURI(meta.config['access-control-allow-origin']);
        }

        for (var key in headers) {
            if (headers.hasOwnProperty(key) && headers[key]) {
                res.setHeader(key, headers[key]);
            }
        }
        next();
    };

    middleware.checkBanned = function (req, res, next) {
        async.waterfall([
            function (next) {
                meta.user.checkBanned(req.ip, next);
            },
            function (isBanned, next) {
                if(isBanned) return res.status(403).send('Your IP has been banned!');
                next();
            }
        ], next);
    }

    middleware.addExpiresHeaders = function (req, res, next) {
        if (req.app.enabled('cache')) {
            res.setHeader('Cache-Control', 'public, max-age=5184000');
            res.setHeader('Expires', new Date(Date.now() + 5184000000).toUTCString());
        } else {
            res.setHeader('Cache-Control', 'public, max-age=0');
            res.setHeader('Expires', new Date().toUTCString());
        }

        next();
    };
};