define("modules/login/controllers/index", [

    'underscore',
    'app',
    'lib/controller',
    'lib/history/popup',
    'modules/common/views/popup',
    'modules/common/models/current-user',
    'modules/login/views/auth-popup',
    'modules/login/views/forgot-password-popup',
    'modules/login/views/change-password-popup',
    'modules/login/views/resend-activation-popup',
    'modules/login/views/activation/activation-popup'

], function(_, app, Controller, popupHistory, popupView, currentUser, AuthPopupView, ForgotPasswordPopupView, ChangePasswordPopupView, ResendActivationPopupView, ActivationPopupView) {
    'use strict';

    return Controller.extend({
        signin: function(params) {
            var previousUser = currentUser.getPreviousFromStorage();
            var authPopup;
            var state;

            if (previousUser) {
                authPopup = new AuthPopupView({
                    user: previousUser
                });
                state = 'simpleAuth';
            } else {
                authPopup = new AuthPopupView();
                state = 'login';
            }

            popupView.open(authPopup, state);

            authPopup.setState(state);

            return false;
        },
        signup: function(params) {
            var authPopup = new AuthPopupView();

            popupView.open(authPopup, 'registration');
            authPopup.setState('registration');

            return false;
        },
        forgot: function(params) {
            return this.__commonPopup(params, ForgotPasswordPopupView, 'forgot-password');
        },
        restore: function(params) {
            return this.__commonPopup(params, ChangePasswordPopupView, 'restore-password');
        },
        resend: function(params) {
            currentUser.initialized.done(_.bind(this.__commonPopup, this, params, ResendActivationPopupView, 'resend-activation'));

            if (currentUser.isGuest()) {
                popupHistory.navigate('#signin', true);
            }
        },
        activate: function(params) {
            currentUser.initialized.done(_.bind(this.__commonPopup, this, params, ActivationPopupView, 'activation'));

            if (currentUser.isGuest()) {
                popupHistory.navigate('#signin', true);
            }
        },
        __commonPopup: function(params, NestedView, className) {
            popupView.open(new NestedView(params), className);

            return false;
        }
    });

});
define("modules/login/forms/activation", [

    'underscore',
    'lib/model'

], function(_, Model) {
    "use strict";

    return Model.extend({

    });
});

define("modules/login/forms/change-password", [

    'underscore',
    'lib/model'

], function(_, Model) {
    "use strict";

    return Model.extend({
        url: '/v1/users/restore-password',

        validation: {
            password: [{
                required: true,
                msg: 'form_validator_enter_password'
            }, {
                rangeLength: [3, 32],
                msg: 'form_validator_password_length'
            }]
        }
    });
});

define("modules/login/forms/forgot-password", [

    'underscore',
    'lib/model'

], function(_, Model) {
    "use strict";

    return Model.extend({
        url: '/v1/users/forgot-password',

        validation: {
            email: [{
                required: true,
                msg: 'form_validator_enter_email'
            }, {
                pattern: 'email',
                msg: 'form_validator_enter_email'
            }]
        }
    });
});

define("modules/login/forms/login", [

    'underscore',
    'lib/model'

], function(_, Model) {
    "use strict";

    return Model.extend({
        validation: {
            username: {
                required: true,
                msg: 'form_validator_enter_username'
            },
            password: [{
                required: true,
                msg: 'form_validator_enter_password'
            }, {
                rangeLength: [3, 32],
                msg: 'form_validator_password_length'
            }]
        }
    });
});

define("modules/login/forms/registration", [

    'underscore',
    'config',
    'XRegExpU',
    'lib/model',
    'modules/common/models/current-city',
    'modules/common/models/access-token',
    'modules/common/views/flash-message'

], function(_, config, XRegExpU, Model, currentCity, accessToken, flashMessageView) {
    "use strict";

    return Model.extend({
        url: '/v1/users',

        validation: {
            username: [{
                required: true,
                msg: 'form_validator_enter_names'
                }, {
                fn: '_loginIsValid'
            }],

            sex: [{
                required: true
            }],

            email: [{
                required: true,
                msg: 'form_validator_enter_email'
            }, {
                pattern: 'email',
                msg: 'form_validator_enter_email'
            }, {
                fn: '_emailNotExist'
            }],

            password: [{
                required: true,
                msg: 'form_validator_enter_password'
            }, {
                rangeLength: [3, 32],
                msg: 'form_validator_password_length'
            }]
        },

        _loginIsValid: function(value, attr) {
            var error;

            if (value.length > 1 && !XRegExpU('^[\\p{L}\\s-`]+$').test(value)) {
                return 'form_validator_names_rules';
            } else if (value.length === 1 && !XRegExpU('^[\\pL]+$').test(value)) {
                return 'form_validator_names_rules';
            } else if (value.split(/\s/).length < 2) {
                return 'form_validator_names_count';
            }
        },

        /**
         * Проверяем, что нет пользователя с введённым email
         *
         * @param {String} value
         * @param {String} attr
         */
        _emailNotExist: function(value, attr) {
            var self = this;

            if (value) {
                $.getJSON(config.apiURL + '/v1/users/check-email?callback=?&email=' + value, function(data) {
                    var error;
                    switch (data.data.status) {
                        case 0:

                            break;
                        case 1:
                            error = {};
                            error[attr] = 'form_validator_email_exist';
                            self.trigger('validated:invalid', self, error);

                            break;
                        case 2:
                            error = {};
                            error[attr] = 'form_validator_email_exist';
                            self.trigger('validated:invalid', self, error);
                            break;
                    }
                });
            }
        },

        /**
         * Регистрация пользователя через api
         *
         * Преобразуем введённые пользователем данные и отправляем на сервер методом save()
         * @param [options]
         * @return {Backbone.sync}
         */
        register: function(options) {
            var self = this;
            var userNamesArray = this.get('username').split(' ');

            this.set('cityId', currentCity.get('id'));
            this.set('firstName', userNamesArray[0]);
            this.set('lastName', userNamesArray[1]);
            this.set('approvePassword', this.get('password'));

            return this.save()
                .done(function() {
                    flashMessageView.success('flashMessage_registrationComplete_title',
                        "flashMessage_registrationComplete_title");

                    accessToken.receive({
                        username: self.get('email'),
                        password: self.get('password')
                    });
                });
        }
    });
});

define("modules/login/forms/resend-activation", [

    'underscore',
    'modules/common/models/current-user',
    'lib/model'

], function(_, currentUser, Model) {
    "use strict";

    return Model.extend({

        url: function() {//todo need test when it will be used
            return '/v1/users/' + currentUser.get('id') + '/resend-activation';
        },

        validation: {
            email: [{
                required: true,
                msg: 'form_validator_enter_email'
            }]
        }
    });
});
define("modules/login/forms/simple-auth", [

    'underscore',
    'config',
    'lib/model'

], function(_, config, Model) {
    "use strict";

    return Model.extend({
        validation: {
            password: [{
                required: true,
                msg: 'form_validator_enter_password'
            }, {
                rangeLength: [3, 32],
                msg: 'form_validator_password_length'
            }]
        },

        url: function() {
            return '/v1/users/' + this.get('id');
        }
    });
});

define("modules/login/locales/compiled/en", {"loginForm_title": "Вход на сайт", "loginForm_label_username": "Email или ник", "loginForm_label_password": "Пароль", "loginForm_link_remember": "Забыли пароль?", "loginForm_submit": "Войти", "registrationForm_title": "Регистрация", "registrationForm_label_username": "Имя и фамилия", "registrationForm_label_email": "E-mail", "registrationForm_label_password": "Пароль", "registrationForm_submit": "Зарегистрироваться", "simpleAuthForm_label_password": "Пароль", "simpleAuthForm_link_remember": "Забыли пароль?", "simpleAuthForm_submit": "Войти", "simpleAuth_footer_link": "Другой пользователь", "loginPopup_footer_link": "Вход", "loginPopup_footer_comment": "Уже зарегистрированы?", "registrationPopup_footer_link": "Регистрация", "registrationPopup_footer_comment": "Впервые на сайте?", "form_checkbox_sex_m_default": "Мужской", "form_checkbox_sex_f_default": "Женский", "form_checkbox_sex_m_selected": "Мужской пол", "form_checkbox_sex_f_selected": "Женский пол", "form_label_eula": function(MessageFormat, data) {return (function(d){
var r = "";
r += "Регистрируясь, вы принимаете условия ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LINK_START"];
r += "пользовательского соглашения";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LINK_END"];
return r;
})(data)}, "form_label_session": "Чужой компьютер", "forgotPasswordForm_label_email": "E-mail, указанный при регистрации", "forgotPasswordForm_submit": "Отправить", "flashMessage_checkMail_title": "Проверьте почту", "flashMessage_checkMail_description": "На ваш e-mail отправлена ссылка для восстановления пароля", "passwordForm_label_newPassword": "Новый пароль", "passwordForm_link_showPassword": "Показать пароль", "passwordForm_submit": "Сохранить", "flashMessage_passwordChanged_title": "Пароль изменён", "flashMessage_passwordChangedError_title": "Невозможно изменить пароль", "changePassword_header": "Изменение пароля", "forgotPassword_header": "Восстановление пароля", "forgotPassword_footer": "Назад", "activation_header": "Активация аккаунта", "activation_submit": "Активировать", "activation_error_isGuest": "Вы должны быть залогинены, чтобы активировать код", "activation_success": "Аккаунт активирован", "User already confirmed": "Пользователь уже активирован", "resend_activation_submit": "Отправить ещё раз", "flashMessage_resendActivation_title": "Проверьте почту", "flashMessage_resendActivation_description": "На ваш e-mail отправлена ссылка для активации аккаунта", "flashMessage_badCode_title": "Неверный код активации", "flashMessage_badCode_description": function(MessageFormat, data) {return (function(d){
var r = "";
r += "По какой-то причине ваш код не подходит. Мы можем вам ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LINK_START"];
r += "повторно выслать";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LINK_END"];
r += " код для активации";
return r;
})(data)}, "flashMessage_mailIsBusy": "Адрес уже занят"});
define("modules/login/locales/compiled/ru", {"loginForm_title": "Вход на сайт", "loginForm_label_username": "Email или ник", "loginForm_label_password": "Пароль", "loginForm_link_remember": "Забыли пароль?", "loginForm_submit": "Войти", "registrationForm_title": "Регистрация", "registrationForm_label_username": "Имя и фамилия", "registrationForm_label_email": "E-mail", "registrationForm_label_password": "Пароль", "registrationForm_submit": "Зарегистрироваться", "simpleAuthForm_label_password": "Пароль", "simpleAuthForm_link_remember": "Забыли пароль?", "simpleAuthForm_submit": "Войти", "simpleAuth_footer_link": "Другой пользователь", "loginPopup_footer_link": "Вход", "loginPopup_footer_comment": "Уже зарегистрированы?", "registrationPopup_footer_link": "Регистрация", "registrationPopup_footer_comment": "Впервые на сайте?", "form_checkbox_sex_m_default": "Мужской", "form_checkbox_sex_f_default": "Женский", "form_checkbox_sex_m_selected": "Мужской пол", "form_checkbox_sex_f_selected": "Женский пол", "form_label_eula": function(MessageFormat, data) {return (function(d){
var r = "";
r += "Регистрируясь, вы принимаете условия ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LINK_START"];
r += "пользовательского соглашения";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LINK_END"];
return r;
})(data)}, "form_label_session": "Чужой компьютер", "forgotPasswordForm_label_email": "E-mail, указанный при регистрации", "forgotPasswordForm_submit": "Отправить", "flashMessage_checkMail_title": "Проверьте почту", "flashMessage_checkMail_description": "На ваш e-mail отправлена ссылка для восстановления пароля", "passwordForm_label_newPassword": "Новый пароль", "passwordForm_link_showPassword": "Показать пароль", "passwordForm_submit": "Сохранить", "flashMessage_passwordChanged_title": "Пароль изменён", "flashMessage_passwordChangedError_title": "Невозможно изменить пароль", "changePassword_header": "Изменение пароля", "forgotPassword_header": "Восстановление пароля", "forgotPassword_footer": "Назад", "activation_header": "Активация аккаунта", "activation_submit": "Активировать", "activation_error_isGuest": "Вы должны быть залогинены, чтобы активировать код", "activation_success": "Аккаунт активирован", "User already confirmed": "Пользователь уже активирован", "resend_activation_submit": "Отправить ещё раз", "flashMessage_resendActivation_title": "Проверьте почту", "flashMessage_resendActivation_description": "На ваш e-mail отправлена ссылка для активации аккаунта", "flashMessage_badCode_title": "Неверный код активации", "flashMessage_badCode_description": function(MessageFormat, data) {return (function(d){
var r = "";
r += "По какой-то причине ваш код не подходит. Мы можем вам ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LINK_START"];
r += "повторно выслать";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["LINK_END"];
r += " код для активации";
return r;
})(data)}, "flashMessage_mailIsBusy": "Адрес уже занят", "form_validator_password_length": "Слишком короткий пароль"});
define("modules/login/templates/compiled/activation/activation-form", ["lib/locale!modules/login/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\r\n<div class=\"form-row\">\r\n    <input type=\"submit\" class=\"submit\" value=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "activation_submit", options) : helperMissing.call(depth0, "t", "activation_submit", options)))
    + "\">\r\n</div>\r\n";
  return buffer;
  }};});
define("modules/login/templates/compiled/activation/activation-popup", ["lib/locale!modules/login/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\r\n<article class=\"popup-noHeader\">\r\n    <section class=\"popup-body\">\r\n        <div class=\"popup-title\">\r\n            <h2>";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "activation_header", options) : helperMissing.call(depth0, "t", "activation_header", options)))
    + "</h2>\r\n        </div>\r\n        ";
  options = {hash:{
    'data': (depth0.data)
  },data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "activationForm", options) : helperMissing.call(depth0, "region", "activationForm", options)))
    + "\r\n    </section>\r\n</article>";
  return buffer;
  }};});
define("modules/login/templates/compiled/auth-popup", ["lib/style!modules/login/styles/compiled/main",, "lib/locale!modules/login/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n"
    + "\n<article class=\"popup-registration j-popup-registration\">\n    <section class=\"popup-body\">\n        <h2 class=\"popup-title\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "registrationForm_title", options) : helperMissing.call(depth0, "t", "registrationForm_title", options)))
    + "</h2>\n        ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "registrationForm", options) : helperMissing.call(depth0, "region", "registrationForm", options)))
    + "\n    </section>\n    <footer class=\"popup-footer\">\n        <p class=\"comment\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "registrationPopup_footer_comment", options) : helperMissing.call(depth0, "t", "registrationPopup_footer_comment", options)))
    + "</p>\n        <h2><span class=\"pseudoLink\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "registrationPopup_footer_link", options) : helperMissing.call(depth0, "t", "registrationPopup_footer_link", options)))
    + "</span></h2>\n    </footer>\n</article>\n<article class=\"popup-login j-popup-login\">\n    <section class=\"popup-body\">\n        <h2 class=\"popup-title\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "loginForm_title", options) : helperMissing.call(depth0, "t", "loginForm_title", options)))
    + "</h2>\n        ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "loginForm", options) : helperMissing.call(depth0, "region", "loginForm", options)))
    + "\n    </section>\n    <footer class=\"popup-footer\">\n        <p class=\"comment\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "loginPopup_footer_comment", options) : helperMissing.call(depth0, "t", "loginPopup_footer_comment", options)))
    + "</p>\n        <h2><span class=\"pseudoLink\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "loginPopup_footer_link", options) : helperMissing.call(depth0, "t", "loginPopup_footer_link", options)))
    + "</span></h2>\n    </footer>\n</article>\n<article class=\"popup-simpleAuth j-popup-simpleAuth\">\n    <section class=\"popup-body\">\n        ";
  options = {hash:{
    'user': (depth0.user)
  },data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "simpleAuthForm", options) : helperMissing.call(depth0, "region", "simpleAuthForm", options)))
    + "\n    </section>\n    <footer class=\"popup-footer\">\n        <h2><span class=\"pseudoLink j-popup-changeLogin\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "simpleAuth_footer_link", options) : helperMissing.call(depth0, "t", "simpleAuth_footer_link", options)))
    + "</span></h2>\n    </footer>\n</article>";
  return buffer;
  }};});
define("modules/login/templates/compiled/change-password-form", ["lib/locale!modules/login/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n<div class=\"form-row\">\n    <a href=\"?\" class=\"description j-showPassword\" tabindex=\"5\"></a>\n    <span class=\"field j-field\"><input type=\"password\" name=\"password\" id=\"password\" value=\"\" tabindex=\"1\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "passwordForm_link_showPassword", options) : helperMissing.call(depth0, "t", "passwordForm_link_showPassword", options)))
    + "\"></span>\n</div>\n<div class=\"form-row\">\n    <input type=\"submit\" class=\"submit\" value=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "passwordForm_submit", options) : helperMissing.call(depth0, "t", "passwordForm_submit", options)))
    + "\" tabindex=\"2\">\n</div>";
  return buffer;
  }};});
define("modules/login/templates/compiled/change-password-popup", ["lib/style!modules/login/styles/compiled/main", "lib/locale!modules/login/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n<article class=\"popup-changePassword popup-noHeader popup-noFooter\">\n    <section class=\"popup-body\">\n        <div class=\"popup-title\">\n            <h2>";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "changePassword_header", options) : helperMissing.call(depth0, "t", "changePassword_header", options)))
    + "</h2>\n        </div>\n        ";
  options = {hash:{
    'data': (depth0.data)
  },data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "changePasswordForm", options) : helperMissing.call(depth0, "region", "changePasswordForm", options)))
    + "\n    </section>\n</article>\n";
  return buffer;
  }};});
define("modules/login/templates/compiled/forgot-password-form", ["lib/locale!modules/login/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, functionType="function", escapeExpression=this.escapeExpression, helperMissing=helpers.helperMissing;


  buffer += "\n<div class=\"form-row\">\n    <label for=\"email\"></label>\n    <span class=\"field j-field\"><input type=\"text\" name=\"email\" id=\"email\" value=\"";
  if (stack1 = helpers.email) { stack1 = stack1.call(depth0, {hash:{},data:data}); }
  else { stack1 = depth0.email; stack1 = typeof stack1 === functionType ? stack1.apply(depth0) : stack1; }
  buffer += escapeExpression(stack1)
    + "\" tabindex=\"1\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "forgotPasswordForm_label_email", options) : helperMissing.call(depth0, "t", "forgotPasswordForm_label_email", options)))
    + "\"></span>\n</div>\n<div class=\"form-row\">\n    <input type=\"submit\" class=\"submit\" value=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "forgotPasswordForm_submit", options) : helperMissing.call(depth0, "t", "forgotPasswordForm_submit", options)))
    + "\" tabindex=\"2\">\n</div>";
  return buffer;
  }};});
define("modules/login/templates/compiled/forgot-password-popup", ["lib/style!modules/login/styles/compiled/main", "lib/locale!modules/login/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n<article class=\"popup-forgotPassword popup-noHeader\">\n    <section class=\"popup-body\">\n        <h2 class=\"popup-title\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "forgotPassword_header", options) : helperMissing.call(depth0, "t", "forgotPassword_header", options)))
    + "</h2>\n        ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "forgotPasswordForm", options) : helperMissing.call(depth0, "region", "forgotPasswordForm", options)))
    + "\n    </section>\n    <footer class=\"popup-footer j-forgotPasswordPopup-footer\">\n        <h2>";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "forgotPassword_footer", options) : helperMissing.call(depth0, "t", "forgotPassword_footer", options)))
    + "</h2>\n    </footer>\n</article>\n";
  return buffer;
  }};});
define("modules/login/templates/compiled/login-form", ["lib/locale!modules/login/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n<div class=\"form-row\">\n    <span class=\"field j-field\"><input type=\"text\" name=\"username\" id=\"username\" value=\"\" tabindex=\"1\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "loginForm_label_username", options) : helperMissing.call(depth0, "t", "loginForm_label_username", options)))
    + "\"></span>\n</div>\n<div class=\"form-row\">\n    <span class=\"field j-field\"><input type=\"password\" name=\"password\" id=\"password\" value=\"\" tabindex=\"2\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "loginForm_label_password", options) : helperMissing.call(depth0, "t", "loginForm_label_password", options)))
    + "\"></span>\n</div>\n<div class=\"form-row form-row-inline\">\n    ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "checkbox", depth0.controlsession, options) : helperMissing.call(depth0, "region", "checkbox", depth0.controlsession, options)))
    + "\n</div>\n<div class=\"form-row\">\n    <input type=\"submit\" class=\"submit\" value=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "loginForm_submit", options) : helperMissing.call(depth0, "t", "loginForm_submit", options)))
    + "\" tabindex=\"4\">\n</div>\n<div class=\"form-row additional\"><a href=\"#forgot-password\" class=\"j-forgotPassword-link\" tabindex=\"5\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "loginForm_link_remember", options) : helperMissing.call(depth0, "t", "loginForm_link_remember", options)))
    + "</a></div>";
  return buffer;
  }};});
define("modules/login/templates/compiled/registration-form", ["lib/locale!modules/login/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, stack2, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\n<div class=\"form-row\">\n    <label for=\"username\"></label>\n    <span class=\"field j-field\"><input type=\"text\" name=\"username\" id=\"username\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "registrationForm_label_username", options) : helperMissing.call(depth0, "t", "registrationForm_label_username", options)))
    + "\"></span>\n</div>\n<div class=\"form-row form-row-inline\">\n    ";
  options = {hash:{
    'data': (depth0.controlSex)
  },data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "radioGroup", options) : helperMissing.call(depth0, "region", "radioGroup", options)))
    + "\n</div>\n<div class=\"form-row\">\n    <span class=\"field j-field\"><input type=\"email\" name=\"email\" id=\"email\" value=\"\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "registrationForm_label_email", options) : helperMissing.call(depth0, "t", "registrationForm_label_email", options)))
    + "\"></span>\n</div>\n<div class=\"form-row\">\n    ";
  options = {hash:{
    'data': (depth0.controlPassword)
  },data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "password", options) : helperMissing.call(depth0, "region", "password", options)))
    + "\n</div>\n<div class=\"form-row\">\n    <input type=\"submit\" class=\"submit\" value=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "registrationForm_submit", options) : helperMissing.call(depth0, "t", "registrationForm_submit", options)))
    + "\">\n</div>\n<div class=\"form-row additional\">";
  options = {hash:{},data:data};
  stack2 = ((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, depth0.eulaLabel, options) : helperMissing.call(depth0, "t", depth0.eulaLabel, options));
  if(stack2 || stack2 === 0) { buffer += stack2; }
  buffer += "</div>";
  return buffer;
  }};});
define("modules/login/templates/compiled/resend-activation-form", ['lib/locale!modules/login/locales/compiled/'], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\r\n<div class=\"form-row\">\r\n    <label for=\"email\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "registrationForm_label_email", options) : helperMissing.call(depth0, "t", "registrationForm_label_email", options)))
    + "</label>\r\n    <span class=\"field j-field\"><input type=\"email\" name=\"email\" id=\"email\" value=\"\"></span>\r\n</div>\r\n<div class=\"form-row\">\r\n    <input type=\"submit\" class=\"submit\" value=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "resend_activation_submit", options) : helperMissing.call(depth0, "t", "resend_activation_submit", options)))
    + "\">\r\n</div>";
  return buffer;
  }};});
define("modules/login/templates/compiled/resend-activation-popup", ['lib/locale!modules/login/locales/compiled/'], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, options, helperMissing=helpers.helperMissing, escapeExpression=this.escapeExpression;


  buffer += "\r\n<article class=\"popup-noHeader\">\r\n    <section class=\"popup-body\">\r\n        <div class=\"popup-title\">\r\n            <h2>";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "activation_header", options) : helperMissing.call(depth0, "t", "activation_header", options)))
    + "</h2>\r\n        </div>\r\n        ";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers.region || depth0.region),stack1 ? stack1.call(depth0, "resendActivationForm", options) : helperMissing.call(depth0, "region", "resendActivationForm", options)))
    + "\r\n    </section>\r\n</article>";
  return buffer;
  }};});
define("modules/login/templates/compiled/simple-auth-form", ["lib/locale!modules/login/locales/compiled/"], function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, stack2, options, functionType="function", escapeExpression=this.escapeExpression, helperMissing=helpers.helperMissing;


  buffer += "\n<div class=\"previousUser\">\n    <span class=\"thumbnail\"><img src=\""
    + escapeExpression(((stack1 = ((stack1 = ((stack1 = depth0.avatar),stack1 == null || stack1 === false ? stack1 : stack1.thumbnail)),stack1 == null || stack1 === false ? stack1 : stack1.url)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "\" /></span>\n    <h2 class=\"previousUser-userName\">";
  if (stack2 = helpers.firstName) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.firstName; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + " ";
  if (stack2 = helpers.lastName) { stack2 = stack2.call(depth0, {hash:{},data:data}); }
  else { stack2 = depth0.lastName; stack2 = typeof stack2 === functionType ? stack2.apply(depth0) : stack2; }
  buffer += escapeExpression(stack2)
    + "</h2>\n</div>\n<div class=\"form-row\">\n    <span class=\"field j-field\"><input type=\"password\" name=\"password\" id=\"password\" value=\"\" tabindex=\"2\" placeholder=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "simpleAuthForm_label_password", options) : helperMissing.call(depth0, "t", "simpleAuthForm_label_password", options)))
    + "\"></span>\n</div>\n<div class=\"form-row\">\n    <input type=\"submit\" class=\"submit\" value=\"";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "simpleAuthForm_submit", options) : helperMissing.call(depth0, "t", "simpleAuthForm_submit", options)))
    + "\" tabindex=\"4\">\n</div>\n<div class=\"form-row additional\"><a href=\"#forgot-password\" class=\"j-forgotPassword-link\" tabindex=\"5\">";
  options = {hash:{},data:data};
  buffer += escapeExpression(((stack1 = helpers['t'] || depth0['t']),stack1 ? stack1.call(depth0, "simpleAuthForm_link_remember", options) : helperMissing.call(depth0, "t", "simpleAuthForm_link_remember", options)))
    + "</a></div>";
  return buffer;
  }};});
define("modules/login/templates/compiled/social-buttons", function() {return {dependencies: arguments, template: function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<p class=\"social-buttons\">\n    <a href=\"#login/social/vk\" class=\"social-button\"><img src=\"/img/icons/social/vk.png\"></a>\n    <a href=\"#login/social/fb\" class=\"social-button\"><img src=\"/img/icons/social/fb.png\"></a>\n    <a href=\"#login/social/tw\" class=\"social-button\"><img src=\"/img/icons/social/tw.png\"></a>\n    <a href=\"#login/social/mail-ru\" class=\"social-button\"><img src=\"/img/icons/social/mail-ru.png\"></a>\n</p>\n";
  }};});
define("modules/login/views/activation/activation-form", [

    'underscore',
    'lib/form/view',
    'modules/login/forms/activation',
    'modules/common/models/current-user',
    'modules/common/views/flash-message',
    'modules/common/views/popup',
    'lib/template!modules/login/templates/compiled/activation/activation-form'

], function(_, FormView, ActivationForm, currentUser, flashMessage, Popup, ActivationFormTemplate) {
    "use strict";

    return FormView.extend({
        template: ActivationFormTemplate,

        /**
         * Create new form model
         * @private
         */
        __getModel: function() {
            return new ActivationForm();
        },

        /**
         * Send form data to model
         * @return {boolean}
         */
        __submitHandler: function() {
            currentUser.activate(this.options.code)
                .done(function() {
                    flashMessage.success('modules/login/locales/compiled/activation_success');

                    Popup.close();
                })
                .fail(function(xhr, status, data) {
                    var message = data.message;

                    //TODO: избавиться от проверки по message
                    if (data.message === "Bad request") {
                        flashMessage.error("modules/login/locales/compiled/flashMessage_badCode_title",
                            {
                                key: "modules/login/locales/compiled/flashMessage_badCode_description",
                                data: {
                                    LINK_START: "<a href=\"#resend-activation\">",
                                    LINK_END: "</a>"
                                }
                            }, -1);
                    } else {
                        flashMessage.error('modules/login/locales/compiled/' + message);
                        Popup.close();
                    }
                });

            return false;
        }
    });
});

define("modules/login/views/activation/activation-popup", [

    'lib/view',
    'lib/template!modules/login/templates/compiled/activation/activation-popup',
    'modules/login/views/activation/activation-form'

], function(View, activationPopupTemplate, ActivationFormView) {
    "use strict";

    return View.extend({
        template: activationPopupTemplate,
        regions: {
            activationForm: ActivationFormView
        },

        serialize: function() {
            return {
                data: this.options
            };
        }
    });
});
define("modules/login/views/auth-popup", [

    'underscore',
    'lib/view',
    'lib/history/popup',
    'lib/template!modules/login/templates/compiled/auth-popup',
    'modules/common/models/current-user',
    'modules/common/views/flash-message',

    'modules/login/views/social-buttons',
    'modules/login/views/login-form',
    'modules/login/views/registration-form',
    'modules/login/views/simple-auth-form'

], function(_, View, popupHistory, authPopupTemplate, currentUser, flashMessageView, SocialButtons, LoginFormView, RegistrationFormView, SimpleAuthFormView) {
    "use strict";

    return View.extend({
        template: authPopupTemplate,
        regions: {
            //socialButtons: SocialButtons,
            loginForm: LoginFormView,
            registrationForm: RegistrationFormView,
            simpleAuthForm: SimpleAuthFormView
        },

        events: {
            'click .j-popup-login footer': '__loginHandler',
            'click .j-popup-registration footer':  '__registrationHandler',
            'click .j-popup-simpleAuth footer': '__simpleAuthHandler'
        },

        /**
         * Change state of popup
         * @param {String} state
         * @return {boolean}
         */
        setState: function(state) {
            var target = this.$('.j-popup-' + state);
            var stateClassName = ' state-' + state;
            var rStatePattern = /state\-[a-z0-9\-_]+($|\s+)/gi;

            this.el.className = this.el.className.replace(rStatePattern, "") + stateClassName;

            target
                .find('input')
                .eq(0)
                .focus();

            flashMessageView.hide();

            return false;
        },

        __loginHandler: function() {
            popupHistory.navigate('#signin', true);

            return false;
        },

        __registrationHandler: function() {
            popupHistory.navigate('#signup', true);

            return false;
        },

        __simpleAuthHandler: function() {
            currentUser.removePreviousFromStorage();

            this.setState('login');
        },

        serialize: function() {
            return {
                user: this.options.user
            };
        }
    });
});

define("modules/login/views/change-password-form", [

    'underscore',
    'lib/form/view',
    'modules/login/forms/change-password',
    'modules/common/models/access-token',
    'modules/common/views/flash-message',
    'lib/template!modules/login/templates/compiled/change-password-form'

], function(_, FormView, ChangePasswordForm, accessToken, flashMessageView, changePasswordTemplate) {
    "use strict";

    return FormView.extend({
        className: 'shortForm',
        template: changePasswordTemplate,

        /**
         * Create new form model
         * @private
         */
        __getModel: function() {
            return new ChangePasswordForm();
        },

        /**
         * Send form data to model
         * @return {boolean}
         */
        __submitHandler: function() {
            var self = this;
            var data = _.extend(this.serializeForm(), this.options);

            this.__removeAllErrorMessages();

            if (this.model.set(data, { validate: true })) {
                this.model
                    .save(this.model.toJSON())
                    .done(function() {
                        flashMessageView.success('modules/login/locales/compiled/flashMessage_passwordChanged_title');
                        accessToken.receive({
                            'username': self.model.get('email'),
                            'password': self.model.get('password')
                        });
                        self.popup.close();
                    })
                    .fail(function() {
                        self.popup.shake();
                        flashMessageView.error('modules/login/locales/compiled/flashMessage_passwordChangedError_title');
                    });
            }

            return false;
        }
    });
});

define("modules/login/views/change-password-popup", [

    'underscore',
    'lib/view',
    'modules/common/views/flash-message',
    'modules/login/views/change-password-form',
    'lib/template!modules/login/templates/compiled/change-password-popup'


], function(_, View, flashMessageView, ChangePasswordFormView, changePasswordTemplate) {
    "use strict";

    return View.extend({
        template: changePasswordTemplate,
        regions: {
            changePasswordForm: ChangePasswordFormView
        },

        serialize: function() {
            return this.options;
        },

        afterRender: function() {
            this.$el
                .find('input')
                .eq(0)
                .focus();
        }
    });
});

define("modules/login/views/forgot-password-form", [

    'underscore',
    'lib/form/view',
    'lib/storage',
    'lib/history/page',
    'modules/login/forms/forgot-password',
    'modules/common/models/access-token',
    'modules/common/views/flash-message',
    'lib/template!modules/login/templates/compiled/forgot-password-form'

], function(_, FormView,  storage, pageHistory, ForgotPasswordForm, accessToken, flashMessageView, forgotPasswordTemplate) {
    "use strict";

    return FormView.extend({
        className: 'form-common shortForm',
        template: forgotPasswordTemplate,

        /**
         * Create new form model
         * @private
         */
        __getModel: function() {
            return new ForgotPasswordForm();
        },

        /**
         * Send form data to model
         * @return {boolean}
         */
        __submitHandler: function() {
            var self = this;

            this.__removeAllErrorMessages();

            this.model.set('returnUrl', pageHistory.getFragment());

            if (this.model.set(this.serializeForm(), { validate: true })) {
                this.model
                    .save(self.model.toJSON())
                    .done(function() {
                        flashMessageView.success('modules/login/locales/compiled/flashMessage_checkMail_title',
                            'modules/login/locales/compiled/flashMessage_checkMail_description');
                        self.popup.close();
                    })
                    .fail(function(xhr, status, response) {
                        _.each(xhr.responseJSON && xhr.responseJSON.error.data.messages, function(message) {
                            self.showErrorMessage(message.field, {
                                message: message.type
                            });
                        });
                        self.popup.shake();
                    });
            }

            return false;
        },

        serialize: function() {
            return {
                email: storage.get('forgottenPasswordUsername', {
                    session: true
                })
            };
        }
    });
});

define("modules/login/views/forgot-password-popup", [

    'underscore',
    'lib/view',
    'lib/history/popup',
    'lib/template!modules/login/templates/compiled/forgot-password-popup',
    'modules/common/views/flash-message',
    "modules/login/views/forgot-password-form"

], function(_, View, popupHistory, forgotPasswordTemplate, flashMessageView, ForgotPasswordFormView) {
    "use strict";

    var ForgotPopupView = View.extend({
        template: forgotPasswordTemplate,
        regions: {
            forgotPasswordForm: ForgotPasswordFormView
        },

        events: {
            'click .j-forgotPasswordPopup-footer': '__backHandler'
        },

        __backHandler: function() {
            popupHistory.history.back();
        },

        afterRender: function() {
            this.$el
                .find('input')
                .eq(0)
                .focus();
        }
    });

    return ForgotPopupView;
});

define("modules/login/views/login-form", [

    'underscore',
    'lib/form/view',
    'lib/storage',
    'ui/form/views/checkbox',
    'modules/login/forms/login',
    'modules/common/models/access-token',
    'modules/common/views/flash-message',
    'lib/template!modules/login/templates/compiled/login-form'

], function(_, FormView, storage, Checkbox, LoginForm, accessToken, flashMessageView, loginTemplate) {
    "use strict";

    return FormView.extend({
        template: loginTemplate,
        regions: {
            checkbox: Checkbox
        },

        events: function() {
            return _.extend({}, FormView.prototype.events, {
                'click .j-forgotPassword-link': '__storeUsername'
            });
        },

        /**
         * Create new form model
         * @private
         */
        __getModel: function() {
            return new LoginForm();
        },

        /**
         * Send form data to model
         * @return {boolean}
         */
        __submitHandler: function() {
            var self = this;

            this.__removeAllErrorMessages();

            if (this.model.set(this.serializeForm(), { validate: true })) {
                accessToken
                    .receive(self.model.toJSON())
                    .done(function() {

                        /* TODO: В этом ли месте прятать флешмессадж? */
                        flashMessageView.hide();
                        self.popup.close();
                    })
                    .fail(function() {
                        self.popup.shake();
                    });
            }

            return false;
        },

        __storeUsername: function() {
            storage.set('forgottenPasswordUsername', this.$('#username').val(), {
                session: true
            });
        },

        serialize: function() {
            return {
                controlsession: {
                    name: "session",
                    checked: false,
                    label: "modules/login/locales/compiled/form_label_session"
                }
            };
        }
    });
});

define("modules/login/views/registration-form", [

    'underscore',
    'lib/form/view',
    'lib/history/page',
    "ui/form/views/radio-group",
    "ui/form/views/password",
    'modules/login/forms/registration',
    'lib/template!modules/login/templates/compiled/registration-form'

], function(_, FormView, pageHistory, RadioGroupView, PasswordView, RegistrationForm, registrationTemplate) {
    "use strict";

    return FormView.extend({
        template: registrationTemplate,
        regions: {
            radioGroup: RadioGroupView,
            password: PasswordView
        },

        /**
         * Create new form model
         * @private
         */
        __getModel: function() {
            return new RegistrationForm();
        },

        /**
         * Send form data to model
         * @return {boolean}
         */
        __submitHandler: function() {
            var self = this;
            this.__removeAllErrorMessages();

            this.model.set('returnUrl', pageHistory.getFragment());

            if (this.model.set(this.serializeForm(), { validate: true })) {
                this.model.register()
                    .done(function() {
                        self.popup.close();
                    })
                    .fail(function(xhr, status, response) {
                        if (response.code === 21) {
                            var errors = response.data.fields;

                            _.each(errors, function(error) {
                                var message = {
                                    message: 'form_validator_' + error.type
                                };

                                self.showErrorMessage(error.field, message);
                            });
                        }
                    });
            }

            return false;
        },

        serialize: function() {
            return {
                controlSex: {
                    name: "sex",
                    items: [
                        {
                            checked: true,
                            value: 1,
                            label: {
                                default: 'modules/login/locales/compiled/form_checkbox_sex_m_default',
                                selected: 'modules/login/locales/compiled/form_checkbox_sex_m_selected'
                            }
                        },
                        {
                            value: 2,
                            label: {
                                default: 'modules/login/locales/compiled/form_checkbox_sex_f_default',
                                selected: 'modules/login/locales/compiled/form_checkbox_sex_f_selected'
                            }
                        }
                    ]
                },
                controlPassword: {
                    name: "password",
                    hideByDefault: true,
                    label: "modules/login/locales/compiled/registrationForm_label_password"
                },
                eulaLabel: {
                    key: "modules/login/locales/compiled/form_label_eula",
                    data: {
                        LINK_START: "<a href=\"/agreement/\">",
                        LINK_END: "</a>"
                    }
                }
            };
        }
    });
});

define("modules/login/views/resend-activation-form", [

    'underscore',
    'lib/form/view',
    'lib/template!modules/login/templates/compiled/resend-activation-form',
    'modules/login/forms/resend-activation',
    'modules/common/views/popup',
    'modules/common/views/flash-message'

], function(_, FormView, ResendActivationFormTemplate, ResendActivationForm, Popup, flashMessage) {
    "use strict";

    return FormView.extend({
        template: ResendActivationFormTemplate,

        __getModel: function() {
            return new ResendActivationForm();
        },

        __submitHandler: function() {
            var self = this;

            this.__removeAllErrorMessages();

            if (this.model.set(this.serialize(), { validate: true })) {
                this.model.save(this.model.toJSON)
                    .done(function() {
                        flashMessage.success('modules/login/locales/compiled/flashMessage_resendActivation_title', 'modules/login/locales/compiled/flashMessage_resendActivation_title');
                    })
                    .fail(function(xhr, status, data) {
                        var message = data.message;

                        //TODO: избавиться от проверки по message
                        if (data.message === "Bad request") {
                            flashMessage.error("modules/login/locales/compiled/flashMessage_mailIsBusy", "", -1);
                        } else {
                            flashMessage.error('modules/login/locales/compiled/' + message);
                            Popup.close();
                        }
                    });
            }

            return false;
        },

        beforeRender: function() {
            FormView.prototype.beforeRender.apply(this, arguments);
            flashMessage.hide();
        }
    });
});
define("modules/login/views/resend-activation-popup", [

    'lib/view',
    'lib/template!modules/login/templates/compiled/resend-activation-popup',
    'modules/login/views/resend-activation-form'

], function(View, resendActivationTemplate, ResendActivationFormView) {
    "use strict"

    return View.extend({
        template: resendActivationTemplate,
        regions: {
            resendActivationForm: ResendActivationFormView
        }
    });
});
define("modules/login/views/simple-auth-form", [

    'underscore',
    'lib/form/view',
    'lib/history/popup',
    'lib/storage',
    'modules/login/forms/simple-auth',
    'modules/common/models/access-token',
    'modules/common/views/flash-message',
    'lib/template!modules/login/templates/compiled/simple-auth-form'

], function(_, FormView, popupHistory, storage, SimpleAuthForm, accessToken, flashMessageView, simpleAuthTemplate) {
    "use strict";

    return FormView.extend({
        template: simpleAuthTemplate,

        events: function() {
            return _.extend({}, FormView.prototype.events, {
                'click .j-forgotPassword-link': '__storeUsername'
            });
        },

        initialize: function() {
            FormView.prototype.initialize.apply(this, arguments);

            if (this.options.user) {
                this.model.set({
                    id: this.options.user.id,
                    username: this.options.user.email
                });
            }
        },

        /**
         * Create new form model
         * @private
         */
        __getModel: function() {
            return new SimpleAuthForm();
        },

        /**
         * Send form data to model
         * @return {boolean}
         */
        __submitHandler: function() {
            var self = this;

            this.__removeAllErrorMessages();

            if (this.model.set(this.serializeForm(), { validate: true })) {
                /*
                Если делать accessToken.receive({this.model.toJSON()}), то всё почему-то падает
                со странной ошибкой в jQuery.ajax
                 */

                accessToken
                    .receive({
                        username: this.model.get('username'),
                        password: this.model.get('password')
                    })
                    .done(function() {

                        flashMessageView.hide();
                        self.popup.close();
                    })
                    .fail(function() {
                        self.popup.shake();
                    });
            }

            return false;
        },

        __storeUsername: function() {
            storage.set('forgottenPasswordUsername', this.model.get('username'), {
                session: true
            });
        },

        beforeRender: function() {
            var self = this;
            FormView.prototype.beforeRender.apply(this, arguments);

            if (!this.model.isNew() && !this.model.isFetched()) {
                this.model.fetch().done(_.bind(this.render, this));
            }
        }
    });
});

define("modules/login/views/social-buttons", [

    'underscore',
    'lib/view',
    'lib/template!modules/login/templates/compiled/social-buttons'

], function(_, View, socialButtonsTemplate) {
    "use strict";

    return View.extend({
        template: socialButtonsTemplate,

        events: {
            'click .vk': 'clickHandler',
            'click .fb': 'clickHandler',
            'click .tw': 'clickHandler',
            'click .mailRu': 'clickHandler'
        },

        clickHandler: function(e) {
            /* some unknown magick */
        }
    });
});
