'use strict';

var app = window.app || {};

(function () {
    toastr.options = {
        timeOut: 3000
    };

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

    $('#login-form').ajaxForm({
        headers: {
            'x-csrf-token': config.csrf_token,
        },
        beforeSubmit:  function (data, jqF, opt) {
            $('button[type=submit]', jqF).prop('disabled', true);
        },
        success: function (res, status, xhr, $form) {
            window.location.href = res;
            $('button[type=submit]', jqF).prop('disabled', false);
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