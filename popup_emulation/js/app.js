'use strict';

angular.module('demoApp', ['ui.router'])

    .config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {

        //Роутинг
        $urlRouterProvider.otherwise('/');

        $stateProvider
            .state('main', {
                url: '/',
                templateUrl: 'main.html'
            })
            .state('popup', {
                url: '/popup/*path',
                templateUrl: 'popup.html'
            })
    }])