'use strict';

angular.module('demoApp', ['ngResource', 'ngRoute'])

    .config(['$routeProvider', function ($routeProvider) {

        //Роутинг
        $urlRouterProvider
            .when('/', {
                template: 'Error 404'
            })
            .when('/:cityId/news', {
                template: '{{Global.city}} News'
            })
            .when('/news', {
                template: '{{Global.city}} News'
            })
            .otherwise({
                redirectTo: '/'
            });
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