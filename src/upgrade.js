'use strict';

var async = require('async');
var path = require('path');
var semver = require('semver');
var readline = require('readline');
var db = require('./database');
var file = require('./file');
var Upgrade = {};

Upgrade.getAll = function (callback) {
    async.waterfall([
        async.apply(file.walk, path.join(__dirname, './upgrades')),
        function (files, next) {
            var versionA;
            var versionB;
            setImmediate(next, null, files.filter(function (file) {
                return path.basename(file) !== 'TEMPLATE';
            }).sort(function (a, b) {
                versionA = path.dirname(a).split('/').pop();
                versionB = path.dirname(b).split('/').pop();

                return semver.compare(versionA, versionB);
            }));
        },
    ], callback);
};

Upgrade.check = function (callback) {
    async.waterfall([
        async.apply(Upgrade.getAll),
        function (files, next) {
            db.getSortedSetRange('schemaLog', 0, -1, function (err, executed) {
                if (err) {
                    return callback(err);
                }

                var remainder = files.filter(function (name) {
                    return executed.indexOf(path.basename(name, '.js')) === -1;
                });

                next(remainder.length > 0 ? new Error('schema-out-of-date') : null);
            });
        },
    ], callback);
};
module.exports = Upgrade;