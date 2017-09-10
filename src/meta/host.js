'use strict';

var async = require('async');
var nconf = require('nconf');

var Host = module.exports;

Host.getSupport = function (callback) {
    var dir = path.
    async.waterfall([
        function (next) {
            fs.readdir(dir, (err, files) => {
                next(null, files);
            });
        },
        function (files, next) {

        }
    ], callback);
};