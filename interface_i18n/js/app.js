'use strict';

angular.module('demoApp', ['ui.router', 'i18n'])

    .config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {

        //Роутинг
        $urlRouterProvider.otherwise('/');

        $stateProvider
            .state('main', {
                url: '/',
                views: {
                    "main": {
                        templateUrl: 'other_module/template.html'
                    }
                }
            })
    }])
    
    //Сервисы
    .value('Global', {
        city: null
    })

angular.module('i18n', [])

    //Подгрузка языков
    .directive('langFile', ['$locale', '$http', function ($locale, $http) {
        return {
            link: function (scope, element, attrs, ngModel) {
                $http.get(attrs.langFile.replace('*', $locale.id)).success(function (translations) {
                    scope.n = translations;
                })
            }
        }
    }])

    //Фильтр языка
    .filter('i18', ['$filter', '$locale', function ($filter, $locale) {
        return function (data) {
            var args = arguments;
            var strTpl = args[1] && args[1][data] ? args[1][data] : '...';

            try {
                return strTpl.replace(/\{([^{}]+)\}/g, function (key, phrase) {

                    var parts = /(^\d)\s?([,|]?)(.*?)$/.exec(phrase);
                    var value = args[parseInt(parts[1])+1];

                    if (value === undefined) {
                        return '';
                    }
                    if (parts[2] === ',') {
                        //Фильтры валют/даты/времени и проч.
                        try {
                            var opts = parts[3].split(':');
                            return $filter(opts[0])(value, opts[1])
                        } catch (e) {
                            return value;
                        }
                    } else if (parts[2] === '|') {
                        //Плюрализация
                        try {
                            var plurals = parts[3].split('|');
                            var whens = {
                                0:     plurals[0],
                                one:   plurals[1],
                                other: plurals[plurals.length-1]
                            }
                            if (plurals[3] !== undefined) {
                                whens.few  = plurals[2];
                                whens.many = plurals[3];

                            } else if (plurals[2] !== undefined) {
                                whens.many = plurals[2];
                            }
                            return whens[(value in whens) ? 0 : $locale.pluralCat(value)].replace('*', value);
                        } catch (e) {
                            return '..';
                        }
                    } else {
                        return value;
                    }
                });
            } catch (e) {
                return '....';
            }
        }
    }])