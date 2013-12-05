'use strict';

angular.module('demoApp', [])

    //Сервисы
    .value('DemoModel', {
        name: ''
    })

    //Контроллеры
    .controller('InCtrl', function ($scope, DemoModel) {

        $scope.in = DemoModel;
    })

    .controller('OutCtrl', function ($scope, DemoModel) {

        $scope.out = DemoModel;
    })

    //Директивы
    .directive('myInput', function ($parse) {

        return function(scope, elm, attrs) {
            // вид -> модель
            elm.bind('keyup', function() {

                scope.$apply(function() {
                    // связываем значение атрибута с моделью
                    var modelGet = $parse(attrs.myInput),
                        modelSet = modelGet.assign;

                    modelSet(scope, elm.val());
                });
            });
        }
    })