'use strict';

angular.module('demoApp', [])

    //1. через вложенные области видимости
    .controller('InputCtrl', ['$scope', function ($scope) {
        $scope.data = {title: 'какой-то текст'}
    }])

    .controller('OutputCtrl', ['$scope', function ($scope) {

        $scope.newData = $scope.data; //$scope только для записи. Так лучше не делать
    }])


    //2. через общий сервис
    .value('Data', {
        title: 'какой-то текст'
    })

    .controller('Input1Ctrl', ['$scope', 'Data', function ($scope, Data) {

        $scope.data = Data;
    }])

    .controller('Output1Ctrl', ['$scope', 'Data', function ($scope, Data) {

        $scope.data = Data;
    }])


    //3. рассылкой через $rootScope
    .controller('Input2Ctrl', ['$scope', '$rootScope', function ($scope, $rootScope) {

        $scope.title = 'какой-то текст';

        $scope.$watch('title', function (newVal) {
            $rootScope.$broadcast('titleEvent2', {title: newVal})
        })
    }])

    .controller('Output2Ctrl', ['$scope', function ($scope) {

        $scope.$on('titleEvent2', function (e, arg) {
            $scope.title = arg.title;
        })
    }])


    //4. слушанием $rootScope ($rootScope нельзя удалить, поэтому обработчик будет висеть всегда!)
    .controller('Input3Ctrl', ['$scope',  function ($scope) {

        $scope.title = 'какой-то текст';

        $scope.$watch('title', function (newVal) {
            $scope.$emit('titleEvent3', {title: newVal});
        })
    }])

    .controller('Output3Ctrl', ['$scope', '$rootScope', function ($scope, $rootScope) {

        $rootScope.$on('titleEvent3', function (e, arg) {
            $scope.title = arg.title;
        })
    }])