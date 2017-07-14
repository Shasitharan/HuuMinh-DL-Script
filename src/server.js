
'use strict';

var fs = require('fs');
var path = require('path');
var nconf = require('nconf');
var express = require('express');
var app = express();
var server;
var winston = require('winston');
var async = require('async');
var flash = require('connect-flash');
var compression = require('compression');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var useragent = require('express-useragent');
var hbs = require('express-hbs');
var meta = require('./meta');
var db = require('./database');
var logger = require('./logger');
var routes = require('./routes');
var helpers = require('./helpers');
var user = require('./controllers/user');

if (nconf.get('ssl')) {
    server = require('https').createServer({
        key: fs.readFileSync(nconf.get('ssl').key),
        cert: fs.readFileSync(nconf.get('ssl').cert),
    }, app);
} else {
    server = require('http').createServer(app);
}

module.exports.server = server;

server.on('error', function (err) {
    winston.error(err);
    if (err.code === 'EADDRINUSE') {
        winston.error('HuuMinh DL address in use, exiting...');
        process.exit(1);
    } else {
        throw err;
    }
});

module.exports.listen = function (callback) {
    callback = callback || function () { };

    async.waterfall([
        function (next) {
            setupExpressApp(app, next);
        },
        function (next) {
            helpers.register();
            logger.init(app);
            initializeHuuMinhDL(next);
        },
        function (next) {
            winston.info('HuuMinh DL Script Ready');
            require('./socket.io').server.emit('event:nodebb.ready', {
                'cache-buster': meta.config['cache-buster'],
            });

            listen(next);
        },
    ], callback);
};

function initializeHuuMinhDL(callback) {
    var middleware = require('./middleware');
    async.waterfall([
        function (next) {
            routes(app, middleware, next);
        }
    ], function (err) {
        callback(err);
    });
}

function setupExpressApp(app, callback) {
    var middleware = require('./middleware');

    var relativePath = nconf.get('relative_path');

    app.engine('hbs', hbs.express4({
        defaultLayout: __dirname + '/views/layout',
        partialsDir: __dirname + '/views/partials'
    }));
    app.set('view engine', 'hbs');
    app.set('views', nconf.get('views_dir'));


    app.set('json spaces', process.env.NODE_ENV === 'development' ? 4 : 0);
    app.use(flash());

    app.enable('view cache');

    if (global.env !== 'development') {
        app.enable('cache');
        app.enable('minification');
    }

    app.use(compression());

    app.get(relativePath + '/ping', ping);
    app.get(relativePath + '/sping', ping);

    //setupFavicon(app);

    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.use(cookieParser());
    app.use(useragent.express());

    app.use(session({
        store: db.sessionStore,
        secret: nconf.get('secret'),
        key: nconf.get('sessionKey'),
        cookie: setupCookie(),
        resave: true,
        saveUninitialized: true,
    }));

    app.use(express.static('public'));

    app.use(middleware.checkBanned);
    app.use(middleware.addHeaders);
    app.use(middleware.renderTemplate);

    user.initialize(app, middleware);

    var toobusy = require('toobusy-js');
    toobusy.maxLag(100);
    toobusy.interval(500);
    callback();
}

function listen(callback) {
    callback = callback || function () { };
    var port = parseInt(nconf.get('port'), 10);
    var isSocket = isNaN(port);
    var socketPath = isSocket ? nconf.get('port') : '';
    if (Array.isArray(port)) {
        if (!port.length) {
            winston.error('[startup] empty ports array in config.json');
            process.exit();
        }

        winston.warn('[startup] If you want to start HuuMinh DL Script on multiple ports please use loader.js');
        winston.warn('[startup] Defaulting to first port in array, ' + port[0]);
        port = port[0];
        if (!port) {
            winston.error('[startup] Invalid port, exiting');
            process.exit();
        }
    }

    if ((port !== 80 && port !== 443) || nconf.get('trust_proxy') === true) {
        winston.info('Enabling \'trust proxy\'');
        app.enable('trust proxy');
    }

    if ((port === 80 || port === 443) && process.env.NODE_ENV !== 'development') {
        winston.info('Using ports 80 and 443 is not recommend; use a proxy instead. See README.md');
    }

    var bind_address = ((nconf.get('bind_address') === '0.0.0.0' || !nconf.get('bind_address')) ? '0.0.0.0' : nconf.get('bind_address'));
    var args = isSocket ? [socketPath] : [port, bind_address];
    var oldUmask;

    args.push(function (err) {
        if (err) {
            winston.info('[startup] HuuMinh DL Script was unable to listen on: ' + bind_address + ':' + port);
            process.exit();
        }

        winston.info('HuuMinh DL Script is now listening on: ' + (isSocket ? socketPath : bind_address + ':' + port));
        if (oldUmask) {
            process.umask(oldUmask);
        }
        callback();
    });

    // Alter umask if necessary
    if (isSocket) {
        oldUmask = process.umask('0000');
        module.exports.testSocket(socketPath, function (err) {
            if (!err) {
                server.listen.apply(server, args);
            } else {
                winston.error('[startup] HuuMinh DL Script was unable to secure domain socket access (' + socketPath + ')');
                winston.error('[startup] ' + err.message);
                process.exit();
            }
        });
    } else {
        server.listen.apply(server, args);
    }
}

module.exports.testSocket = function (socketPath, callback) {
    if (typeof socketPath !== 'string') {
        return callback(new Error('invalid socket path : ' + socketPath));
    }
    var net = require('net');
    var file = require('./file');
    async.series([
        function (next) {
            file.exists(socketPath, function (err, exists) {
                if (exists) {
                    next();
                } else {
                    callback(err);
                }
            });
        },
        function (next) {
            var testSocket = new net.Socket();
            testSocket.on('error', function (err) {
                next(err.code !== 'ECONNREFUSED' ? err : null);
            });
            testSocket.connect({ path: socketPath }, function () {
                // Something's listening here, abort
                callback(new Error('port-in-use'));
            });
        },
        async.apply(fs.unlink, socketPath),	// The socket was stale, kick it out of the way
    ], callback);
};

function ping(req, res) {
    res.status(200).send(req.path === '/sping' ? 'healthy' : '200');
}


function setupCookie() {
    var ttl = meta.getSessionTTLSeconds() * 1000;

    var cookie = {
        maxAge: ttl,
    };

    if (nconf.get('cookieDomain') || meta.config.cookieDomain) {
        cookie.domain = nconf.get('cookieDomain') || meta.config.cookieDomain;
    }

    if (nconf.get('secure')) {
        cookie.secure = true;
    }

    var relativePath = nconf.get('relative_path');
    if (relativePath !== '') {
        cookie.path = relativePath;
    }

    return cookie;
}

module.exports.testSocket = function (socketPath, callback) {
    if (typeof socketPath !== 'string') {
        return callback(new Error('invalid socket path : ' + socketPath));
    }
    var net = require('net');
    var file = require('./file');
    async.series([
        function (next) {
            file.exists(socketPath, function (err, exists) {
                if (exists) {
                    next();
                } else {
                    callback(err);
                }
            });
        },
        function (next) {
            var testSocket = new net.Socket();
            testSocket.on('error', function (err) {
                next(err.code !== 'ECONNREFUSED' ? err : null);
            });
            testSocket.connect({ path: socketPath }, function () {
                // Something's listening here, abort
                callback(new Error('port-in-use'));
            });
        },
        async.apply(fs.unlink, socketPath),	// The socket was stale, kick it out of the way
    ], callback);
};