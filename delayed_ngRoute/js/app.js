'use strict';

angular.module('demoApp', ['ngRoute'])

    .config(['$routeProvider', function ($routeProvider) {

        //Роутинг
        $routeProvider
            .when('/', {
                template: 'Error 404'
            })
            .when('/:cityId/news', {
                template: '{{Global.city}} News'
            })
            .when('/news', {
                template: '{{Global.city}} News',
                controller: function () {
                    console.log('news ctrl')
                }
            })
            .otherwise({
                redirectTo: '/'
            });
    }])

    .run(['$rootScope', '$location', '$route', 'Global', function ($rootScope, $location, $route, Global) {

        //Отлавливаем изменения города
        $rootScope.Global = Global;
        $rootScope.$watch('Global.city', function (newValue, oldValue) {

            $route.reload();

        });
        
        //Отлавливаем переходы роутера
        $rootScope.$on('$locationChangeSuccess', function(event, next, current){

            if ($route.current.params.cityId && $route.current.params.cityId !== Global.city) {
                //Берем город из адресной строки
                Global.city = $route.current.params.cityId;

            } else if (!Global.city) {
                //Пытаемся узнать город пользователя

                if ($location.path() !== '/') {
                    //Если был правильный переход
                    event.preventDefault();
                }
                //Получаем код города
                setTimeout(function () {
                    Global.city = 'spb';
                    $route.reload();
                }, 1000);
            }
        })
    }])
    
    //Сервисы
    .value('Global', {
        city: null
    })