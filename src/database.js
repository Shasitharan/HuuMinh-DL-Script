'use strict';

var nconf = require('nconf');
var databaseName = nconf.get('database');
var winston = require('winston');

if (!databaseName) {
	winston.error(new Error('Database type not set! Run ./huuminh-dl setup'));
	process.exit();
}

var primaryDB = require('./database/' + databaseName);

module.exports = primaryDB;
