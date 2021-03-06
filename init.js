'use strict';

var	nconf = require('nconf');
var fs = require('fs');
var url = require('url');
var path = require('path');
var fork = require('child_process').fork;
var async = require('async');
var logrotate = require('logrotate-stream');

var pkg = require('./package.json');
nconf.argv().env().file({
    file: path.join(__dirname, 'config.json'),
});
var	pidFilePath = path.join(__dirname, 'pidfile');
var outputLogFilePath = path.join(__dirname, 'logs/output.log');
var output = logrotate({ file: outputLogFilePath, size: '1m', keep: 3, compress: true });
var silent = nconf.get('silent') === 'false' ? false : nconf.get('silent') !== false;
var numProcs;
var workers = [];

var AppInit = {
    timesStarted: 0,
};
var appPath = path.join(__dirname, 'app.js');

AppInit.init = function (callback) {
    if (silent) {
        console.log = function () {
            var args = Array.prototype.slice.call(arguments);
            output.write(args.join(' ') + '\n');
        };
    }
    process.on('SIGHUP', AppInit.restart);
    process.on('SIGUSR2', AppInit.reload);
    process.on('SIGTERM', AppInit.stop);
    callback();
};

AppInit.displayStartupMessages = function (callback) {
    console.log('');
    console.log('HuuMinh Generate Scripts v' + pkg.version + ' Copyright (C) 2017 HuuMinh Technologies.');
    console.log('This program comes with ABSOLUTELY NO WARRANTY.');
    console.log('This is free software, and you are welcome to redistribute it under certain conditions.');
    console.log('For the full license, please visit: http://www.gnu.org/copyleft/gpl.html');
    console.log('');
    callback();
};

AppInit.addWorkerEvents = function (worker) {
    worker.on('exit', function (code, signal) {
        if (code !== 0) {
            if (AppInit.timesStarted < numProcs * 3) {
                AppInit.timesStarted += 1;
                if (AppInit.crashTimer) {
                    clearTimeout(AppInit.crashTimer);
                }
                AppInit.crashTimer = setTimeout(function () {
                    AppInit.timesStarted = 0;
                }, 10000);
            } else {
                console.log((numProcs * 3) + ' restarts in 10 seconds, most likely an error on startup. Halting.');
                process.exit();
            }
        }

        console.log('[cluster] Child Process (' + worker.pid + ') has exited (code: ' + code + ', signal: ' + signal + ')');
        if (!(worker.suicide || code === 0)) {
            console.log('[cluster] Spinning up another process...');

            forkWorker(worker.index, worker.isPrimary);
        }
    });

    worker.on('message', function (message) {
        if (message && typeof message === 'object' && message.action) {
            switch (message.action) {
                case 'restart':
                    console.log('[cluster] Restarting...');
                    AppInit.restart();
                    break;
                case 'reload':
                    console.log('[cluster] Reloading...');
                    AppInit.reload();
                    break;
            }
        }
    });
};

AppInit.start = function (callback) {
    numProcs = getPorts().length;
    console.log('Clustering enabled: Spinning up ' + numProcs + ' process(es).\n');

    for (var x = 0; x < numProcs; x += 1) {
        forkWorker(x, x === 0);
    }

    if (callback) {
        callback();
    }
};

function forkWorker(index, isPrimary) {
    var ports = getPorts();
    var args = [];

    if (!ports[index]) {
        return console.log('[cluster] invalid port for worker : ' + index + ' ports: ' + ports.length);
    }

    process.env.isPrimary = isPrimary;
    process.env.isCluster = ports.length > 1;
    process.env.port = ports[index];

    var worker = fork(appPath, args, {
        silent: silent,
        env: process.env,
    });

    worker.index = index;
    worker.isPrimary = isPrimary;

    workers[index] = worker;

    AppInit.addWorkerEvents(worker);

    if (silent) {
        var output = logrotate({ file: outputLogFilePath, size: '1m', keep: 3, compress: true });
        worker.stdout.pipe(output);
        worker.stderr.pipe(output);
    }
}

function getPorts() {
    var _url = nconf.get('url');
    if (!_url) {
        console.log('[cluster] url is undefined, please check your config.json');
        process.exit();
    }
    var urlObject = url.parse(_url);
    var port = nconf.get('port') || urlObject.port || 4567;
    if (!Array.isArray(port)) {
        port = [port];
    }
    return port;
}

AppInit.restart = function () {
    killWorkers();

    var pathToConfig = path.join(__dirname, '/config.json');
    nconf.remove('file');
    nconf.use('file', { file: pathToConfig });

    fs.readFile(pathToConfig, { encoding: 'utf-8' }, function (err, configFile) {
        if (err) {
            console.log('Error reading config : ' + err.message);
            process.exit();
        }

        var conf = JSON.parse(configFile);

        nconf.stores.env.readOnly = false;
        nconf.set('url', conf.url);
        nconf.stores.env.readOnly = true;

        AppInit.start();
    });
};

AppInit.reload = function () {
    workers.forEach(function (worker) {
        worker.send({
            action: 'reload',
        });
    });
};

AppInit.stop = function () {
    killWorkers();

    // Clean up the pidfile
    fs.unlinkSync(pidFilePath);
};

function killWorkers() {
    workers.forEach(function (worker) {
        worker.suicide = true;
        worker.kill();
    });
}

AppInit.notifyWorkers = function (msg, worker_pid) {
    worker_pid = parseInt(worker_pid, 10);
    workers.forEach(function (worker) {
        if (parseInt(worker.pid, 10) !== worker_pid) {
            try {
                worker.send(msg);
            } catch (e) {
                console.log('[cluster/notifyWorkers] Failed to reach pid ' + worker_pid);
            }
        }
    });
};

fs.open(path.join(__dirname, 'config.json'), 'r', function (err) {
    if (!err) {
        if (nconf.get('daemon') !== 'false' && nconf.get('daemon') !== false) {
            if (fs.existsSync(pidFilePath)) {
                try {
                    var	pid = fs.readFileSync(pidFilePath, { encoding: 'utf-8' });
                    process.kill(pid, 0);
                    process.exit();
                } catch (e) {
                    fs.unlinkSync(pidFilePath);
                }
            }

            require('daemon')({
                stdout: process.stdout,
                stderr: process.stderr,
            });

            fs.writeFileSync(pidFilePath, process.pid);
        }

        async.series([
            AppInit.init,
            AppInit.displayStartupMessages,
            AppInit.start,
        ], function (err) {
            if (err) {
                console.log('[AppInit] Error during startup: ' + err.message);
            }
        });
    } else {
        // No config detected, kickstart web installer
        require('child_process').fork('app');
    }
});