'use strict';

var app = window.app || {};

(function () {
    toastr.options = {
        timeOut: 3000
    };

    app.load = function () {
        Visibility.change(function (event, state) {
            if (state === 'visible') {
                app.isFocused = true;
            } else if (state === 'hidden') {
                app.isFocused = false;
            }
        });

        socket.removeAllListeners('event:huuminh.ready');

        helpers.register();

        $(window).trigger('action:app.load');
    }

    app.enterRoom = function (room, callback) {
        callback = callback || function () {};
        if (socket && app.logged_id && app.currentRoom !== room) {
            var previousRoom = app.currentRoom;
            app.currentRoom = room;
            socket.emit('meta.rooms.enter', {
                enter: room,
            }, function (err) {
                if (err) {
                    app.currentRoom = previousRoom;
                    return toastr.error(err.message);
                }
                callback();
            });
        }
    };

    app.leaveCurrentRoom = function () {
        if (!socket) {
            return;
        }
        var previousRoom = app.currentRoom;
        app.currentRoom = '';
        socket.emit('meta.rooms.leaveCurrent', function (err) {
            if (err) {
                app.currentRoom = previousRoom;
                return toastr.error(err.message);
            }
        });
    };

    app.handleInvalidSession = function () {
        return toastr.error("Session invalid, please try login again!");
    };

    $('#addAccountButton').click(function (e) {
        e.preventDefault();
        var me = $(this),
            type= me.data('type'),
            btnShowText = me.data('show'),
            btnHideText = me.data('hide');
        if(type === 'show') {
            $('.account-form').slideDown('slow', function () {
                me.text(btnHideText).removeClass('.btn-primary').addClass('btn-danger').data('type', 'hide');
            });
        } else {
            $('.account-form').slideUp('slow', function () {
                me.text(btnShowText).removeClass('.btn-danger').addClass('btn-primary').data('type', 'show');;
            });
        }
    });

    $('.ajax-form').ajaxForm({
        headers: {
            'x-csrf-token': config.csrf_token,
        },
        beforeSubmit:  function (data, jqF, opt) {
            $('button[type=submit]', jqF).prop('disabled', true);
        },
        success: function (res, status, xhr, $form) {
            $('button[type=submit]', $form).prop('disabled', false);
            if(res.error) {
                toastr.error(res.error_message);
            } else {
                toastr.success(res.message);
            }
        },
        error: function (xhr, status, err, $form) {
            $('button[type=submit]', $form).prop('disabled', false);
            toastr.error(status);
        }
    });

    $('.ajax-update-form').ajaxForm({
        type: "PUT",
        headers: {
            'x-csrf-token': config.csrf_token,
        },
        beforeSubmit:  function (data, jqF, opt) {
            $('button[type=submit]', jqF).prop('disabled', true);
        },
        success: function (res, status, xhr, $form) {
            $('button[type=submit]', $form).prop('disabled', false);
            if(res.error) {
                toastr.error(res.error_message);
            } else {
                toastr.success(res.message);
            }
        },
        error: function (xhr, status, err, $form) {
            $('button[type=submit]', $form).prop('disabled', false);
            toastr.error(status);
        }
    })

    $('#login-form').ajaxForm({
        headers: {
            'x-csrf-token': config.csrf_token,
        },
        beforeSubmit:  function (data, jqF, opt) {
            $('button[type=submit]', jqF).prop('disabled', true);
        },
        success: function (res, status, xhr, $form) {
            window.location.href = res;
        },
        error: function (xhr, status, err, $form) {
            toastr.error(xhr.responseText);
            $('button[type=submit]', $form).prop('disabled', false);
        }
    });
})();

function disconnectSession(e) {
    var me = $(e),
        sid = me.data('sid');
    $.ajax({
        url: './profile/delete-session',
        data: {sid: sid},
        type: 'DELETE',
        headers: {
            'x-csrf-token': config.csrf_token,
        },
        success: function (res) {
            if(!res.error) {
                toastr.success(res.message);
                me.parents('tr').fadeOut(function () {
                   $(this).remove();
                });
            } else {
                toastr.error(res.error_message);
            }
        },
        error: function (xhr, status, err) {
            toastr.error(xhr.responseText);
        }
    });
}