'use strict';
const crypto = require('crypto');
const mega = require('megajs');
var async = require('async');
var Host = module.exports;

Host.download = function (link, callback) {
    async.waterfall([
        function (next) {
            const file = mega.file(link);
            file.loadAttributes((error, attr) => {
                if(typeof attr === "undefined") {
                return callback(new Error('Link dead'));
            }
            return next(null, attr);
            });
        },
        function (file, next) {
            if(typeof file !== 'object' || typeof file.name === 'undefined' || typeof file.size === 'undefined') return callback(new Error('Link dead'));
            next(null, {
                filename: file.name,
                filesize: file.size,
                url: link,
            });
        }
    ], callback);
};