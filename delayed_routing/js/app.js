'use strict';

angular.module('demoApp', ['ui.router'])

    .config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider, $location) {

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
                        template: ''
                    }
                },
                resolve: {
                    city: function(Global, $timeout) {
                        return $timeout(function () {
                            return Global.city = 'spb';
                        }, 1000);
                    }
                },
                controller: function($state, city) {
                    $state.go('cityNews', {cityId: city})
                }
            })
    }])
    
    //Сервисы
    .value('Global', {
        city: null
    })
