'use strict';

var async = require('async');
var db = require('../database');
var passport = require('passport');
var passportLocal = require('passport-local').Strategy;
var nconf = require('nconf');
var winston = require('winston');
var utils = require('../utils');
var bcrypt = require('bcryptjs');
var validator = require('validator');
var Password = require('../password');
var meta = require('../meta');
var _ = require('lodash');
var sockets = require('../socket.io');

var User = module.exports;
require('./online')(User);
require('./auth')(User);

User.initialize = function (app, middleware) {
    app.use(passport.initialize());
    app.use(passport.session());

    passport.serializeUser(function(user, done) {
        done(null, user);
    });

    passport.deserializeUser(function(user, done) {
        done(null, user);
    });

    app.use(function (req, res, next) {
        req.uid = req.user ? parseInt(req.user.uid, 10) : 0;
        next();
    });

    User.app = app;
    User.middleware = middleware;
};

User.deleteSession = function (req, res, next) {
    if(req.xhr) {
        if(!req.body.sid){
            res.json({
                error: true,
                error_message: "Data invalid!",
            });
        } else {
            async.waterfall([
                function (next) {
                    User.auth.revokeSession(req.body.sid, req.uid, next);
                },
                function (next) {
                    sockets.in('sess_' + req.body.sid).emit('reloadData', req.uid);
                    res.json({
                        error: false,
                        message: "Your changes have been saved!"
                    });
                }
            ], next);
        }
    }
};

User.updateProfile = function (req, res, next) {
    if(!req.xhr) {
        return callback(new Error("Access Denied"));
    }

    if(!req.body.username) {
        return res.json({
            error: true,
            error_message: "Username is required!"
        });
    }

    if(!req.body.email) {
        return res.json({
            error: true,
            error_message: "Email is required!"
        });
    }

    var userData = {};
    userData.username = req.body.username.trim();
    userData.username = validator.escape(userData.username ? userData.username.toString() : '');

    if (userData.email !== undefined) {
        userData.email = validator.escape(String(data.email).trim());
    }

    if(req.body.password) {
        if(req.body.password !== req.body.confirm_password) {
            return res.json({
                error: true,
                error_message: "Your password and confirm password must match before you can apply"
            });
        } else {
            var password = req.body.password;

            if (!password || !utils.isPasswordValid(password)) {
                return res.json({
                    error: true,
                    error_message: "Invalid password"
                });
            }

            if (password.length > 4096) {
                return res.json({
                    error: true,
                    error_message: "Password too long"
                });
            }
        }
    }

    async.waterfall([
        function (next) {
            if(password){
                User.hashPassword(password, next);
            } else {
                next(null, false);
            }
        },
        function (password, next) {
            if(password) {
                console.log(password);
                userData.password = password;
            }
            User.getUserField(req.uid, 'username', next);
        },
        function (username, next) {
            async.parallel([
                function (next) {
                    db.sortedSetRemove('username:uid', username, next);
                },
                function (next) {
                    User.setUserFields(req.uid, userData, next);
                },
                function (next) {
                    db.sortedSetAdd('username:uid', req.uid, userData.username, next);
                }
            ], next);
        },
        function (next) {
            res.json({
                error: false,
                message: "Your changes have been saved !",
            });
        }
    ], next);
};

User.login = function (req, res, next) {
    passport.use(new passportLocal({ passReqToCallback: true }, User.localLogin));

    if (req.body.username) {
        continueLogin(req, res, next);
    } else {
        res.status(500).send('wrong-login-type');
    }
};

User.logout = function (req, res, next) {
    if (!req.uid || !req.sessionID) {
        return res.redirect('/login');
    }

    async.waterfall([
        function (next) {
            User.auth.revokeSession(req.sessionID, req.uid, next);
        },
        function (next) {
            req.logout();
            req.session.destroy();
            User.setUserField(req.uid, 'lastonline', Date.now() - 300000, next);
        },
        function () {
            sockets.in('sess_' + req.sessionID).emit('checkSession', 0);
            res.redirect('/login');
        },
    ], next);
}

User.localLogin = function (req, username, password, next) {
    if (!username) {
        return next(new Error('invalid-username'));
    }

    var uid;
    var userData = {};

    if (!password || !utils.isPasswordValid(password)) {
        return next(new Error('invalid-password'));
    }

    if (password.length > 4096) {
        return next(new Error('password-too-long'));
    }

    async.waterfall([
        function (next) {
            User.getUidByUsername(username, next);
        },
        function (_uid, next) {
            uid = _uid;
            async.parallel({
                userData: function (next) {
                    db.getObjectFields('user:' + uid, ['password'], next);
                }
            }, next);
        },
        function (result, next) {
            userData = result.userData;
            userData.uid = uid;
            Password.compare(password, userData.password, next);
        },
        function (passwordMatch, next) {
            if (!passwordMatch) {
                async.waterfall([
                    function (next) {
                        User.logAttempt(req, next);
                    },
                    function (next) {
                        return next(new Error('Username or password incorect'));
                    }
                ], next);
            } else {
                next(null, userData, 'Authentication successful');
            }
        },
    ], next);
};

User.logAttempt = function(req, callback) {
    var ip = req.ip;
    async.waterfall([
        function (next) {
            db.exists('lockout:' + ip, next);
        },
        function (exists, next) {
            if (exists) {
                sockets.in('sess_' + req.sessionID).emit('reloadData', ip);
                return callback(new Error('Your IP has been banned!'));
            } else {
                async.waterfall([
                    function (next) {
                        db.get('loginAttempts:' + ip, next);
                    },
                    function (attemps, next) {
                        db.set('loginAttempts:' + ip, attemps+1);
                        next(null, attemps+1);
                    }
                ], next);
            }
        },
        function (attemps, next) {
            var loginAttempts = parseInt(meta.config.loginAttempts, 10) || 5;
            if (attemps <= loginAttempts) {
                return db.pexpire('loginAttempts:' + ip, 1000 * 60 * 60, callback);
            }
            db.set('lockout:' + ip, '', next);
        },
        function (next) {
            var duration = 1000 * 60 * (meta.config.lockoutDuration || 2880);
            db.delete('loginAttempts:' + ip);
            db.pexpire('lockout:' + ip, duration);
            return sockets.in('sess_' + req.sessionID).emit('reloadData', ip);
        },
    ], callback);
}

function continueLogin(req, res, next) {
    passport.authenticate('local', function (err, userData, info) {
        if (err) {
            return res.status(403).send(err.message);
        }

        if (!userData) {
            if (typeof info === 'object') {
                info = 'Username or password incorect';
            }
            return res.status(403).send(info);
        }

        // Alter user cookie depending on passed-in option
        if (req.body.remember === 'on') {
            var duration = 1000 * 60 * 60 * 24 * 14;
            req.session.cookie.maxAge = duration;
            req.session.cookie.expires = new Date(Date.now() + duration);
        } else {
            req.session.cookie.maxAge = false;
            req.session.cookie.expires = false;
        }

        User.doLogin(req, userData.uid, function (err) {
            if (err) {
                return res.status(403).send(err.message);
            }

            if (!req.session.returnTo) {
                res.status(200).send(nconf.get('relative_path') + '/');
            } else {
                var next = req.session.returnTo;
                delete req.session.returnTo;
                res.status(200).send(next);
            }
        });
    })(req, res, next);
}

User.doLogin = function (req, uid, callback) {
    if (!uid) {
        return callback();
    }
    async.waterfall([
        function (next) {
            req.login({ uid: uid }, next);
        },
        function (next) {
            User.onSuccessfulLogin(req, uid, next);
        }
    ], callback);
};

User.onSuccessfulLogin = function (req, uid, callback) {
    callback = callback || function () {};
    var uuid = utils.generateUUID();

    req.session.meta = {};

    delete req.session.forceLogin;

    // Associate IP used during login with user account
    User.logIP(uid, req.ip);
    req.session.meta.ip = req.ip;

    // Associate metadata retrieved via user-agent
    req.session.meta = _.extend(req.session.meta, {
        uuid: uuid,
        datetime: Date.now(),
        platform: req.useragent.platform,
        browser: req.useragent.browser,
        version: req.useragent.version,
    });

    async.waterfall([
        function (next) {
            async.parallel([
                function (next) {
                    User.auth.addSession(uid, req.sessionID, next);
                },
                function (next) {
                    db.setObjectField('uid:' + uid + ':sessionUUID:sessionId', uuid, req.sessionID, next);
                },
                function (next) {
                    User.updateLastOnlineTime(uid, next);
                },
            ], function (err) {
                next(err);
            });
        },
        function (next) {
            sockets.in('sess_' + req.sessionID).emit('checkSession', uid);
            next();
        },
    ], callback);
};

User.create = function (data, callback) {
    var userData;
    data.username = data.username.trim();
    if (data.email !== undefined) {
        data.email = validator.escape(String(data.email).trim());
    }
    var timestamp = data.timestamp || Date.now();
    async.waterfall([
        function (next) {
            userData = {
                username: data.username,
                email: data.email || '',
                joindate: timestamp,
                lastonline: timestamp
            };
            User.uniqueUsername(userData, next);
        },
        function (exist, next) {
            if(exist === true) return callback(new Error("user-exists"));
            db.incrObjectField('global', 'nextUid', next);
        },
        function (uid, next) {
            userData.uid = uid;
            db.setObject('user:' + uid, userData, next);
        },
        function (next) {
            async.parallel([
                function (next) {
                    db.incrObjectField('global', 'userCount', next);
                },
                function (next) {
                    db.sortedSetAdd('username:uid', userData.uid, userData.username, next);
                }
            ], next)
        },
        function (next) {
            if (!data.password) {
                return next();
            }

            User.hashPassword(data.password, function (err, hash) {
                if (err) {
                    return next(err);
                }
                async.parallel([
                    async.apply(User.setUserField, userData.uid, 'password', hash)
                ], next);
            });
        },
        function (next) {
            next(null, userData);
        }
    ], callback);
};

User.uniqueUsername = function (data, callback) {
    async.waterfall([
        function (next) {
            User.getUidByUsername(data.username, function (err, exists) {
                next(err, !!exists);
            });
        },
        function (exists) {
            if (!exists) {
                return callback(null, false);
            }
            return callback(null, true);
        },
    ], callback);
};

User.getUidByUsername = function (username, callback) {
    if (!username) {
        return callback(null, 0);
    }
    db.sortedSetScore('username:uid', username, callback);
};

User.setUserField = function (uid, field, value, callback) {
    callback = callback || function () {};
    async.waterfall([
        function (next) {
            db.setObjectField('user:' + uid, field, value, next);
        }
    ], callback);
};

User.logIP = function (uid, ip) {
    var now = Date.now();
    db.sortedSetAdd('uid:' + uid + ':ip', now, ip || 'Unknown');
    if (ip) {
        db.sortedSetAdd('ip:' + ip + ':uid', now, uid);
    }
};

User.hashPassword = function (password, callback) {
    if (!password) {
        return callback(null, password);
    }
    Password.hash(nconf.get('bcrypt_rounds') || 12, password, callback);
};

User.getUserField = function (uid, field, callback) {
    User.getUserFields(uid, [field], function (err, user) {
        callback(err, user ? user[field] : null);
    });
};

User.getUserFields = function (uid, fields, callback) {
    User.getUsersFields([uid], fields, function (err, users) {
        callback(err, users ? users[0] : null);
    });
};

User.getUsersFields = function (uids, fields, callback) {
    if (!Array.isArray(uids) || !uids.length) {
        return callback(null, []);
    }

    uids = uids.map(function (uid) {
        return isNaN(uid) ? 0 : uid;
    });

    var fieldsToRemove = [];
    function addField(field) {
        if (fields.indexOf(field) === -1) {
            fields.push(field);
            fieldsToRemove.push(field);
        }
    }

    if (fields.length && fields.indexOf('uid') === -1) {
        fields.push('uid');
    }

    if (fields.indexOf('status') !== -1) {
        addField('lastonline');
    }

    var uniqueUids = uids.filter(function (uid, index) {
        return index === uids.indexOf(uid);
    });

    async.waterfall([
        function (next) {
            if (fields.length) {
                db.getObjectsFields(uidsToUserKeys(uniqueUids), fields, next);
            } else {
                db.getObjects(uidsToUserKeys(uniqueUids), next);
            }
        },
        function (users, next) {
            users = uidsToUsers(uids, uniqueUids, users);

            modifyUserData(users, fieldsToRemove, next);
        },
    ], callback);
};

User.getMultipleUserFields = function (uids, fields, callback) {
    winston.warn('[deprecated] User.getMultipleUserFields is deprecated please use User.getUsersFields');
    User.getUsersFields(uids, fields, callback);
};

User.getUserData = function (uid, callback) {
    User.getUsersData([uid], function (err, users) {
        callback(err, users ? users[0] : null);
    });
};

User.getUsersData = function (uids, callback) {
    User.getUsersFields(uids, [], callback);
};

function uidsToUsers(uids, uniqueUids, usersData) {
    var ref = uniqueUids.reduce(function (memo, cur, idx) {
        memo[cur] = idx;
        return memo;
    }, {});
    var users = uids.map(function (uid) {
        return usersData[ref[uid]];
    });
    return users;
}

function uidsToUserKeys(uids) {
    return uids.map(function (uid) {
        return 'user:' + uid;
    });
}

function modifyUserData(users, fieldsToRemove, callback) {
    users.forEach(function (user) {
        if (!user) {
            return;
        }

        if (user.hasOwnProperty('username')) {
            user.username = validator.escape(user.username ? user.username.toString() : '');
        }

        if (user.password) {
            user.password = undefined;
        }

        if (!parseInt(user.uid, 10)) {
            user.uid = 0;
            user.username = '[[global:guest]]';
        }

        for (var i = 0; i < fieldsToRemove.length; i += 1) {
            user[fieldsToRemove[i]] = undefined;
        }

        if (user.hasOwnProperty('joindate')) {
            user.joindateISO = utils.toISOString(user.joindate);
        }

        if (user.hasOwnProperty('lastonline')) {
            user.lastonlineISO = utils.toISOString(user.lastonline) || user.joindateISO;
        }
    });

    callback(null, users);
}

User.setUserField = function (uid, field, value, callback) {
    callback = callback || function () {};
    async.waterfall([
        function (next) {
            db.setObjectField('user:' + uid, field, value, next);
        },
    ], callback);
};

User.setUserFields = function (uid, data, callback) {
    callback = callback || function () {};
    async.waterfall([
        function (next) {
            db.setObject('user:' + uid, data, next);
        }
    ], callback);
};

User.incrementUserFieldBy = function (uid, field, value, callback) {
    incrDecrUserFieldBy(uid, field, value, 'increment', callback);
};

User.decrementUserFieldBy = function (uid, field, value, callback) {
    incrDecrUserFieldBy(uid, field, -value, 'decrement', callback);
};

User.getUserSessions = function (uid, sid, callback) {
    async.waterfall([
        function (next) {
            db.getSortedSetRangeWithScores('uid:'+uid+':sessions', 0, -1, next);
        },
        function (sessions, next) {
            if(!sessions) return callback(null, false);
            async.map(sessions, function(session, cb) {
                db.get("sess:"+session.value, function (err, data) {
                    if (err) return cb(err);
                    data = JSON.parse(data);
                    var sess = {};
                    sess['sid'] = session.value;
                    sess['active'] = (sid == session.value) || false;
                    sess['meta'] = data.meta;
                    cb(null, sess);
                });
            }, next);
        },
        function (sessionsData, next) {
            next(null, sessionsData);
        },
    ], callback);
};

function incrDecrUserFieldBy(uid, field, value, type, callback) {
    callback = callback || function () {};
    async.waterfall([
        function (next) {
            db.incrObjectFieldBy('user:' + uid, field, value, next);
        }
    ], callback);
}