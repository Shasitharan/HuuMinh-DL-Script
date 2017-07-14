'use strict';

var app = window.app || {};
var socket;
app.isConnected = false;

(function () {
    var reconnecting = false;
    var ioParams = {
        reconnectionAttempts: config.maxReconnectionAttempts,
        reconnectionDelay: config.reconnectionDelay,
        transports: config.socketioTransports,
        path: config.relative_path + '/socket.io',
    };

    socket = io(config.websocketAddress, ioParams);

    socket.on('connect', onConnect);

    socket.on('reconnecting', onReconnecting);

    socket.on('disconnect', onDisconnect);

    socket.on('reconnect_failed', function () {
        setTimeout(socket.connect.bind(socket), parseInt(config.reconnectionDelay, 10) * 10);
    });

    socket.on('checkSession', function (uid) {
        if (parseInt(uid, 10) !== parseInt(app.logged_id, 10)) {
            window.location.reload();
        }
    });

    socket.on('reloadData', function (ips) {
        window.location.reload();
    });

    function onConnect() {
        app.isConnected = true;
        if (!reconnecting) {
            toastr.remove()
            $(window).trigger('action:connected');
        }

        if (reconnecting) {
            reJoinCurrentRoom();
            socket.emit('meta.reconnected');
            $(window).trigger('action:reconnected');
        }
    }

    function reJoinCurrentRoom() {
        var	url_parts = window.location.pathname.slice(config.relative_path.length).split('/').slice(1);
        var room;
        switch (url_parts[0]) {
            case 'user':
                room = 'user';
                break;
            case 'download':
                room = 'download';
                break;
        }
        app.currentRoom = '';
        app.enterRoom(room);
    }

    function onReconnecting() {
        reconnecting = true;
        toastr.info('Reconnecting to server...');
    }

    function onDisconnect() {
        $(window).trigger('action:disconnected');
        app.isConnected = false;
    }
}());
