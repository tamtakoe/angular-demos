'use strict';

angular.module('demoApp', ['ui.router'])

    .config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {

        //Роутинг
        $urlRouterProvider.otherwise('/');

        $stateProvider
            .state('404', {
                url: '/',
                views: {
                    "main": {
                        template: 'Error 404'
                    }
                }
            })
            .state('cityNews', {
                url: '/:cityId/news',
                views: {
                    "main": {
                        template: '{{Global.city}} News'
                    }
                }
            })
            .state('news', {
                url: '/news',
                views: {
                    "main": {
                        template: '{{Global.city}} News'
                    }
                }
            })
    }])

    .run(['$rootScope', '$state', 'Global', function ($rootScope, $state, Global) {

        //Отлавливаем изменения города
        $rootScope.Global = Global;
        $rootScope.$watch('Global.city', function (newValue, oldValue) {

            if (newValue && !$state.current.abstract) {

                $state.go($state.current.name, {cityId: newValue})
            }
        });

        //Отлавливаем переходы роутера
        $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams){

            if (toParams.cityId && toParams.cityId !== Global.city) {
                //Берем город из адресной строки
                Global.city = toParams.cityId;

            } else if (!Global.city) {
                //Пытаемся узнать город пользователя

                if (toState.url !== '/') {
                    //Если был правильный переход
                    event.preventDefault();
                }
                //Получаем код города
                setTimeout(function () {
                    Global.city = 'spb';
                    $state.go(toState, toParams);
                }, 1000);
            }
        })
    }])

    //Сервисы
    .value('Global', {
        city: null
    })