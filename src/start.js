'use strict';

var async = require('async');
var nconf = require('nconf');
var url = require('url');
var winston = require('winston');

var start = module.exports;

start.start = function () {
    var db = require('./database');
    var meta = require('./meta');

    setupConfigs();

    printStartupInfo();

    addProcessHandlers();

    async.waterfall([
        function (next) {
            db.init(next);
        },
        function (next) {
            async.parallel([
                async.apply(db.checkCompatibility),
                async.apply(meta.configs.init),
                function (next) {
                    setImmediate(next);
                },
                function (next) {
                    require('./upgrade').check(next);
                },
            ], function (err) {
                next(err);
            });
        },
        function (next) {
            db.initSessionStore(next);
        },
        function (next) {
            var webserver = require('./server');
            require('./socket.io').init(webserver.server);
            webserver.listen(next);
        },
    ], function (err) {
        if (err) {
            switch (err.message) {
                case 'schema-out-of-date':
                    winston.error('Your HuuMinh DL Script schema is out-of-date. Please run the following command to bring your dataset up to spec:');
                    winston.error('    ./huuminh-dl upgrade');
                    break;
                case 'dependencies-out-of-date':
                    winston.error('One or more of HuuMinh DL Script\'s dependent packages are out-of-date. Please run the following command to update them:');
                    winston.error('    ./huuminh-dl upgrade');
                    break;
                case 'dependencies-missing':
                    winston.error('One or more of HuuMinh DL Script\'s dependent packages are missing. Please run the following command to update them:');
                    winston.error('    ./huuminh-dl upgrade');
                    break;
                default:
                    winston.error(err);
                    break;
            }

            // Either way, bad stuff happened. Abort start.
            process.exit();
        }

        if (process.send) {
            process.send({
                action: 'listening',
            });
        }
    });
};

function setupConfigs() {
    // nconf defaults, if not set in config
    if (!nconf.get('sessionKey')) {
        nconf.set('sessionKey', 'huuminh.sid');
    }
    // Parse out the relative_url and other goodies from the configured URL
    var urlObject = url.parse(nconf.get('url'));
    var relativePath = urlObject.pathname !== '/' ? urlObject.pathname : '';
    nconf.set('base_url', urlObject.protocol + '//' + urlObject.host);
    nconf.set('secure', urlObject.protocol === 'https:');
    nconf.set('use_port', !!urlObject.port);
    nconf.set('relative_path', relativePath);
    nconf.set('port', urlObject.port || nconf.get('port') || (nconf.get('PORT_ENV_VAR') ? nconf.get(nconf.get('PORT_ENV_VAR')) : false) || 3000);
}

function printStartupInfo() {
    if (nconf.get('isPrimary') === 'true') {
        winston.info('Initializing HuuMinh DL Script v%s', nconf.get('version'));

        var host = nconf.get(nconf.get('database') + ':host');
        var storeLocation = host ? 'at ' + host + (host.indexOf('/') === -1 ? ':' + nconf.get(nconf.get('database') + ':port') : '') : '';

        winston.verbose('* using %s store %s', nconf.get('database'), storeLocation);
        winston.verbose('* using themes stored in: %s', nconf.get('themes_path'));
    }
}


function addProcessHandlers() {
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGHUP', restart);

    process.on('uncaughtException', function (err) {
        winston.error(err);
        shutdown(1);
    });
}

function restart() {
    if (process.send) {
        winston.info('[app] Restarting...');
        process.send({
            action: 'restart',
        });
    } else {
        winston.error('[app] Could not restart server. Shutting down.');
        shutdown(1);
    }
}

function shutdown(code) {
    winston.info('[app] Shutdown (SIGTERM/SIGINT) Initialised.');
    require('./database').close();
    winston.info('[app] Database connection closed.');
    require('./server').server.close();
    winston.info('[app] Web server closed to connections.');

    winston.info('[app] Shutdown complete.');
    process.exit(code || 0);
}