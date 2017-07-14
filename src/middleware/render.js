'use strict';
var async = require('async');
var meta = require('../meta');
var hbs = require('express-hbs');
var nconf = require('nconf');

module.exports = function (middleware) {
    middleware.renderTemplate = function (req, res, next) {
        var render = res.render;
        res.render = function (template, options, fn) {
            var self = this;
            var req = this.req;
            var defaultFn = function (err, str) {
                if (err) {
                    return next(err);
                }
                self.send(str);
            };

            options = options || {};
            if (typeof options === 'function') {
                fn = options;
                options = {};
            }
            if (typeof fn !== 'function') {
                fn = defaultFn;
            }

            async.waterfall([
                function (next) {
                    middleware.applyCSRF(req, res, next);
                },
                meta.configs.list,
                function (configs, next) {
                    options.loggedIn = !!req.uid;
                    options.relative_path = nconf.get('relative_path');
                    options._locals = undefined;
                    options.configs = options.configs || {};
                    options.templateJS = options.templateJS || {};
                    options.csrf_token = req.csrfToken();
                    options.configs.app = {
                        url: configs.url,
                        name: configs.siteName,
                        maintenance: configs.maintenanceMode,
                        version: configs.version
                    };
                    options.templateJS.app = JSON.stringify(options.configs.app);
                    options.templateJS.configs = {
                        file_prefix: configs.downloadPrefix,
                        file_suffix: configs.downloadSuffix,
                        maxReconnectionAttempts: configs.maxReconnectionAttempts,
                        recaptchaKey: configs.recaptchaKey,
                        realtimeAnalytics: configs.realtimeAnalytics,
                        csrf_token: options.csrf_token,
                    }
                    options.templateJS.configs = JSON.stringify(options.templateJS.configs);
                    async.parallel({
                        header: function (next) {
                            options.layout = '';
                            req.app.render('header', options, next);
                        },
                        content: function (next) {
                            options.layout = 'layout';
                            render.call(self, template, options, next);
                        },                        footer: function (next) {
                            options.layout = '';
                            req.app.render('footer', options, next);
                        }
                    }, next);
                },
                function (results, next) {
                    var html = results.header + results.content + results.footer;
                    next(null, html);
                }
            ], fn);
        }
        next();
    }
}
