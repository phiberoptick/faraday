// Faraday Penetration Test IDE
// Copyright (C) 2017  Infobyte LLC (http://www.infobytesec.com/)
// See the file 'doc/LICENSE' for the license information

"use strict";

angular.module('faradayApp')
    .controller('credentialsCtrl',
        ['$scope', '$filter', '$q', '$uibModal', '$routeParams', 'commonsFact', 'credential', 'ServerAPI',
        function($scope, $filter, $q, $uibModal, $routeParams, commonsFact, credential, ServerAPI ) {

            $scope.workspace;
            $scope.credentials = [];
            // Contains: type of parent(Host or Service), id(Couchid and internal id) of that and name of host and/or name of service(For show in view)
            $scope.parentObject = new Object();
            
            // table stuff
            $scope.reverse;
            $scope.search;
            $scope.selectall_credentials;
            $scope.sort_field;

            var getParent = function() {

                var deferred = $q.defer();

                // Host is our parent.
                if($routeParams.hId !== undefined){

                    // Load all host information needed.
                    $scope.parentObject.type = 'Host';
                    $scope.parentObject.id = $routeParams.hId;

                    ServerAPI.getObj($scope.workspace, $scope.parentObject.id).then(function (response) {
                        $scope.parentObject.nameHost = response['data']['name'];
                        deferred.resolve();
                    });
                }

                 // Service is our parent.
                if($routeParams.sId !== undefined){

                    // Load all service information needed.
                    $scope.parentObject.type = 'Service';
                    $scope.parentObject.id = $routeParams.sId;

                    ServerAPI.getObj($scope.workspace, $scope.parentObject.id).then(function (response) {
                        $scope.parentObject.nameService = response['data']['name'];

                        // and also, load all host information needed.
                        var hostId = response['data']['_id'].split('.')[0];

                        ServerAPI.getObj($scope.workspace, hostId).then(function (response) {
                            $scope.parentObject.nameHost = response['data']['name'];
                            deferred.resolve();
                        });
                    });
                }
                // We dont have parent, resolve promise.
                deferred.resolve();
                return deferred.promise;
            };

            var loadCredentials = function (credentials){
                credentials.forEach(function(cred){
                    $scope.credentials.push(new credential(cred.value));
                });
            }

            var getAndLoadCredentials = function() {
                
                // Load all credentials, we dont have a parent.
                if($scope.parentObject.type === undefined){
                    ServerAPI.getCredentials($scope.workspace).then(function(response){
                        loadCredentials(response.data.rows);
                    });
                }
                else {

                    // Load all credentials, filtered by host internal id or service internal id.
                    if ($scope.parentObject.type === 'Host')
                        var data = {'host_id': $scope.parentObject.id};
                    else if ($scope.parentObject.type === 'Service')
                        var data = {'service_id': $scope.parentObject.id};

                    ServerAPI.getCredentials($scope.workspace, data).then(function(response){
                        loadCredentials(response.data.rows);
                    });
                }
            }

            var init = function() {

                // table stuff
                $scope.selectall_credentials = false;
                $scope.sort_field = "end";
                $scope.reverse = true;

                $scope.workspace = $routeParams.wsId;
                
                getParent().then(function(){
                    getAndLoadCredentials();
                });

            };

            var removeFromView = function(credential){
                $scope.credentials.forEach(function(item, index){
                    if (item._id === credential._id)
                        $scope.credentials.splice(index, 1);     
                });
            };

            // Delete to server.
            $scope.remove = function(credentials) {
                var confirmations = [];

                credentials.forEach(function(cred) {
                    var deferred = $q.defer();

                    var credentialToDelete = new credential();
                    credentialToDelete.load($scope.workspace, cred._id).then(function(response){

                        credentialToDelete.delete($scope.workspace).then(function(resp) {
                            deferred.resolve(resp);
                            removeFromView(credentialToDelete);
                        }, function(message) {
                            deferred.reject(message);
                        });

                        confirmations.push(deferred);
                    });
                });

                return $q.all(confirmations);
            };

            // Binded to Delete button, internal logic.
            $scope.delete = function() {
                var selected = $scope.selectedCredentials();

                var message = "A credential will be deleted";
                if(selected.length > 1) {
                    message = selected.length  + " credentials will be deleted";
                }
                message = message.concat(". This operation cannot be undone. Are you sure you want to proceed?");
                $uibModal.open({
                    templateUrl: 'scripts/commons/partials/modalDelete.html',
                    controller: 'commonsModalDelete',
                    size: 'lg',
                    resolve: {
                        msg: function() {
                            return message;
                        }
                    }
                }).result.then(function() {
                    $scope.remove(selected);
                }, function() {
                    //dismised, do nothing
                });
            };

            var createCredential = function(credentialData, parent_id){
            
                // Add parent id, create credential and save to server.
                try {
                    var credentialObj = new credential(credentialData, parent_id);
                    
                    credentialObj.create($scope.workspace).then(function(){
                         $scope.credentials.push(credentialObj);
                    }, function(){
                        console.log('Error creating credential.');
                    });

                } catch (error) {
                    console.log(error);
                }
            };

            $scope.new = function() {
                var modal = $uibModal.open({
                    templateUrl: 'scripts/credentials/partials/modalNewEdit.html',
                    controller: 'modalNewEditCredentialCtrl',
                    size: 'lg',
                    resolve: {
                        title: function(){
                            return 'New credential';
                        },
                        credential: function(){
                            return undefined;
                        }
                    }
                 });

                modal.result
                    .then(function(data) {
                       createCredential(data, $scope.parentObject.id);
                    });
            };

           $scope.edit = function() {
                var modal = $uibModal.open({
                    templateUrl: 'scripts/credentials/partials/modalNewEdit.html',
                    controller: 'modalNewEditCredentialCtrl',
                    size: 'lg',
                    resolve: {
                        title: function(){
                            return 'Edit credential';
                        },
                        credential: function(){
                            return $scope.selectedCredentials()[0];
                        }
                    }
                 });

                modal.result
                    .then(function(data) {
                       editCredential(data, $scope.parentObject.id);
                    });
            };

            $scope.selectedCredentials = function() {
                var selected = [];

                $filter('filter')($scope.credentials, $scope.search).forEach(function(credential) {
                    if(credential.selected === true) {
                        selected.push(credential);
                    }
                });

                return selected;
            };

            $scope.checkAll = function() {
                $scope.selectall_credentials = !$scope.selectall_credentials;

                var tmp_credentials = $filter('filter')($scope.credentials, $scope.search);
                tmp_credentials.forEach(function(credential) {
                    credential.selected = $scope.selectall_credentials;
                });
            };

            // toggles sort field and order
            $scope.toggleSort = function(field) {
                $scope.toggleSortField(field);
                $scope.toggleReverse();
            };

            // toggles column sort field
            $scope.toggleSortField = function(field) {
                $scope.sort_field = field;
            };

            // toggle column sort order
            $scope.toggleReverse = function() {
                $scope.reverse = !$scope.reverse;
            }

            init();
    }]);
