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
    };

    app.handleInvalidSession = function () {
        return toastr.error("Session invalid, please try login again!");
    };

    $('#generate-button').click(function (e) {
        e.stopImmediatePropagation();
        var $textarea = $('#generate-area'),
            $linkBox = $textarea.val().trim(),
            $btn = $(this),
            $btnText = $(this).text();

        if($btn.hasClass('disabled') || $linkBox.length === 0) return false;
        $('#result').empty();
        $btn.addClass('disabled').text('Downloading...');
        var linksArr = $linkBox.split("\n");
        var links = [];
        $.each(linksArr, function(i, el){
            if($.inArray(el, links) === -1) links.push(el);
        });

        //$textarea.val('');

        for(var i, i=0; i < links.length; i++) {
            if(ValidURL(links[i])) {
                var xhtml = tmpl("tmpl-generate", {"link": links[i]});
                $('#result').append(xhtml);
            }
        }

        var $linkWrap = $('#result a');
        if($linkWrap.length === 0) {
            $btn.removeClass('disabled').text($btnText);
            return false;
        }

        $linkWrap.each(function () {
            var $el = $(this),
                link = $el.attr('href');
            socket.emit('hosts.generate', {link: link}, function (err, result) {
                if(err) {
                    $el.find('.fa').removeClass('fa-refresh fa-spin').addClass('fa-exclamation-circle text-danger');
                    $el.addClass('bg-danger').append('<span class="pull-right badge error">'+err.message+'</span>');
                    return false;
                }

                console.log(result);
            });
        });


        $btn.removeClass('disabled').text($btnText);
    });

    $('#addAccount').click(function (e) {
        e.preventDefault();
        var hostname = $('#hostname').val(),
            account = $('#account').val();
        if(account.length === 0) {
            toastr.error("Account is required!");
            return false;
        }

        socket.emit('hosts.addAccount', {account: account, hostname:hostname}, function (err, result) {
            if ( err ) {
                toastr.error(err.message);
                return false;
            }
            toastr.success('Account have been added successfully!')
        });
    });

    $(document).on('click', '.checkAccBtn', function (e) {
        e.stopImmediatePropagation();
        var $el = $(this).parents('tr'),
            id = $el.data('id');
        if(!id) return false;
        return checkAcc(id);
    });

    $(document).on('click', '.deleteAccBtn', function (e) {
        e.stopImmediatePropagation();
        if(!confirm('Are you sure you want delete this account?')){ return false; }
        var $el = $(this).parents('tr'),
            id = $el.data('id');
        socket.emit('hosts.removeAccount', {id: id}, function (err, result) {
            if(err) return toastr.error(err.message);
            toastr.success(result);
            $el.fadeOut('slow', function () {
                $(this).remove();
            });
        });
    });

    function checkAcc(id) {
        if(!id) return false;
        var $el = $('#acc-'+id),
            $status = $el.find('.account-status span'),
            $expire = $el.find('.account-expire');
        $status.removeClass('label-success').removeClass('label-danger').addClass('label-info').text('checking...');
        socket.emit('hosts.checkAccount', {id:id}, function (err, result) {
            if(err) return toastr.error(err.message);
            if(result.status === 'valid') {
                $status.removeClass('label-info').addClass('label-success').text(result.status);
                $expire.text(result.expire);
            } else {
                $status.removeClass('label-info').addClass('label-danger').text(result.status);
                $expire.text('');
            }
        });
    }

    function ValidURL(str) {
        var regex = /(http|https):\/\/(\w+:{0,1}\w*)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%!\-\/]))?/;
        if(!regex .test(str)) {
            return false;
        } else {
            return true;
        }
    }

    $('#addAccountButton').click(function (e) {
        e.preventDefault();
        var me = $(this),
            type= me.data('type'),
            btnShowText = me.data('show'),
            btnHideText = me.data('hide');
        if(type === 'show') {
            $('.account-form').slideDown('slow', function () {
                me.text(btnHideText).removeClass('btn-primary').addClass('btn-danger').data('type', 'hide');
            });
        } else {
            $('.account-form').slideUp('slow', function () {
                me.text(btnShowText).removeClass('btn-danger').addClass('btn-primary').data('type', 'show');;
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