angular.module('firebaseHelper', [])

.provider('firebaseHelperConfig', [function() {
    var endpoint = "";
    this.setURL = function(url) {
        endpoint = url;
    }
    this.$get = [function() {
        return endpoint;
    }]
}])

.service('firebaseHelper', function($firebaseObject, $firebaseArray, $firebaseObject, $firebaseAuth, $rootScope, $state, notify, firebaseHelperConfig) {
    var self = this;

    this.getFireBaseInstance = function(key) {
        key = getPath(key);
        return new Firebase(key?firebaseHelperConfig + "/" + key:firebaseHelperConfig);
    }

    this.buildPath = function(arr) {
        return arr.join("/")
    }

    var getPath = function(p) {
        if (!p) {
            return p;
        }
        if (typeof(p) == "string") {
            return p;
        }
        return self.buildPath(p);
    }
    var getRef = function(p) {
        if (typeof(p) == "object" && p.onDisconnect) {
            return p;
        } else {
            return self.getFireBaseInstance(getPath(p));
        }
    }


    this.bindObject = function(ref, $scope, key) {
        ref = getRef(ref);
        var syncObject = $firebaseObject(ref);
        syncObject.$bindTo($scope, key);
    }

    this.syncObject = function(ref) {
        ref = getRef(ref);
        return $firebaseObject(ref);
    }

    this.syncProtectedObject = function(path) {
        path = getPath(path);
        return $firebaseObject(self.getFireBaseInstance(path + "/" + self.getUID()));
    }

    this.syncArray = function(ref) {
        ref = getRef(ref);
        return $firebaseArray(ref);
    }

    this.syncProtectedArray = function(path) {
        path = getPath(path);
        return $firebaseArray(self.getFireBaseInstance(path + "/" + self.getUID()));
    }

    this.transaction = function(ref, f) {
        ref = getPath(ref);
        ref.transaction(function(current_val) {
            if (f) {return f(current_val);}
            return current_val;
        })
    }

    this.auth = $firebaseAuth(self.getFireBaseInstance());
    this.authData = null;
    this.profileData = null;
    this.auth.$onAuth(function(authData) {
        // console.log("$onAuth", authData);
        self.authData = authData;
        if (authData) {
            self.syncObject("profiles/" + self.getUID()).$loaded(
                function (data) {
                    self.profileData = data;
                    $rootScope.$broadcast('user:login',authData);
                },
                function (error) {
                    $rootScope.notifyError("Fail to get data");
                    $state.go("login");
                }
            )
        }
    });

    this.isAdmin = function() {
        return (this.profileData && this.profileData.role === "admin");
    }

    this.getUID = function() {
        if (this.authData && this.authData.uid) {
            return this.authData.uid;
        }
        return "";
    }

    this.hasAlreadyLogin = function() {
        return this.authData != null;
    }

    this.getAuthEmail = function() {
        if (this.authData) {
            if (this.authData.password && this.authData.password.email) {
                return this.authData.password.email;
            }
        }
        return "";
    }

    this.getGravatar = function() {
        if (this.authData) {
            if (this.authData.password && this.authData.password.email) {
                return "http://www.gravatar.com/avatar/" + md5(this.authData.password.email) + "?s=200&r=pg&d=mm";
            }
        }
        return "http://www.gravatar.com/avatar/" + md5("nothing") + "?s=200&r=pg&d=mm";
    }

    this.logout = function() {
        self.auth.$unauth();
        self.authData = null;
        $state.go("login");
    }

    this.login = function(email, password, callback) {
        callback = callback || {};
        self.auth.$authWithPassword({email: email, password: password})
            .then(function(authData) {
                self.authData = authData;
                if (callback.success) {callback.success(authData);}
            })
            .catch(function(error) {
                $rootScope.notifyError("Invalid account");
                self.authData = null;
                if (callback.error) {callback.error(error);}
            });

    }
})


;
