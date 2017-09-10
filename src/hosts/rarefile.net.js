'use strict';

var Host = module.exports;

Host.login = function (username, password, callback) {

};

Host.check = function (cookie, callback) {

};

Host.download = function (url, cookie, callback) {
    if(typeof cookie === 'function') callback = cookie;

};

