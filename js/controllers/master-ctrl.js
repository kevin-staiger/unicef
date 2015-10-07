/* global angular, $ */

'use strict';

angular.module('RDash')
    .controller('MasterCtrl', ['$scope', '$http', '$cookieStore', 'socket', MasterCtrl]);

function MasterCtrl($scope, $http, $cookieStore, socket) {

  socket.on('requestDetail', function (data) {
    $scope.requestData = data;

    console.log($scope.requestData)

  });

    /**
     * Sidebar Toggle & Cookie Control
     */

    var mobileView = 992;

    $scope.getWidth = function() {
        return window.innerWidth;
    };

    $scope.$watch($scope.getWidth, function(newValue, oldValue) {
        if (newValue >= mobileView) {
            if (angular.isDefined($cookieStore.get('toggle'))) {
                $scope.toggle = ! $cookieStore.get('toggle') ? false : true;
            } else {
                $scope.toggle = true;
            }
        } else {
            $scope.toggle = false;
        }

    });

    $scope.toggleSidebar = function() {
        $scope.toggle = !$scope.toggle;
        $cookieStore.put('toggle', $scope.toggle);
    };

    window.onresize = function() {
        $scope.$apply();
    };
}