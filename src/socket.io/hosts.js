'use strict';
var async = require('async');
var hosts = require('../hosts');

var HostsSocket = module.exports;

HostsSocket.addAccount = function (socket, data, callback) {
    if(!data && !data.account && !data.hostname) {
        return callback(new Error('Invalid data'));
    }

    async.waterfall([
        function (next) {
            hosts.checkSupport(data.hostname, next);
        },
        function (status, next) {
            if(!status) return callback(new Error('Filehost is not supported right now'));
            hosts.addAccount(data, next);
        },
        function (result, next) {
            if(!result) return callback(new Error('Could not add new account, please try again'));
            callback(null, result);
        }
    ], callback);
};

HostsSocket.checkAccount = function (socket, data, callback) {
    if(!data.id) return callback(new Error('Invalid Account ID'));
    async.waterfall([
        function (next) {
            hosts.checkAccount(data.id, next);
        },
        function (data) {
            callback(null, data);
        }
    ], callback);
};

HostsSocket.removeAccount = function (socket, data, callback) {
    if(!data.id) return callback(new Error('Invalid Account ID'));
    async.waterfall([
        function (next) {
            hosts.removeAccount(data.id, next);
        },
        function () {
            callback(null, "Account have been deleted!");
        }
    ], callback);
};

HostsSocket.generate = function (socket, data, callback) {
    if(!data.link) return callback(new Error('Invalid data'));
    hosts.generate(data.link, callback);
};