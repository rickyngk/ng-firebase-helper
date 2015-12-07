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
    self.root = null;

    this.getFireBaseInstance = function(key) {
        key = getPath(key);
        if (self.root == null) {
            self.root = new Firebase(firebaseHelperConfig);
        }
        var p = self.root;
        if (key) {
            if (typeof("key") == "number") {
                key = key + "";
            }
            if (typeof("key") == "string") {
                key = key.split("/");
            }
            for (var i = 0; i < key.length; i++) {
                p = p.child(key[i]);
            }
        }
        return p;
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
        if (typeof(p) == "object" && p.length == 0 || typeof(p.length) == "undefined") {
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
        ref = getRef(ref);
        ref.transaction(function(current_val) {
            if (f) {return f(current_val);}
            return current_val;
        })
    }

    this.auth = $firebaseAuth(self.getFireBaseInstance());
    this.authData = null;
    this.profileData = null;
    this.publicProfileData = null;
    this._isReady = false;
    this.auth.$onAuth(function(authData) {
        self.authData = authData;
        if (authData) {
            self.getFireBaseInstance(["profiles", self.getUID()]).once("value", function(snapshot) {
                self.profileData = snapshot.val();
                self.getFireBaseInstance(["profiles_pub", self.getUID()]).once("value", function(snapshot) {
                    self.publicProfileData = snapshot.val();
                    if (self.profileData && self.profileData.confirmed && !self.profileData.ban) {
                        self._isReady = true;
                        $rootScope.$broadcast('user:login', authData);
                        self.getFireBaseInstance(["profiles_pub", self.getUID()]).on("value", function(snapshot) {
                            self.publicProfileData = snapshot.val();
                        })
                    } else {
                        if (!self.profileData) {
                            $rootScope.notifyError("Invalid profile data");
                        } else if (self.profileData.ban) {
                            $rootScope.notifyError("Your account have been banned");
                        } else {
                            $rootScope.notifyError("Your account is not active yet.");
                        }
                        self.logout();
                    }
                }, function(error) {
                    self.logout();
                    if ($rootScope.notifyError) {
                        $rootScope.notifyError(error);
                    }
                });
            }, function(error) {
                self.logout();
                if ($rootScope.notifyError) {
                    $rootScope.notifyError(error);
                }
            });
        }
    });

    this.isAdmin = function() {
        return (this.profileData && this.profileData.role === "admin");
    }

    this.getRole = function() {
        if (this.profileData) {
            return this.profileData.role;
        }
        return "";
    }

    this.getUID = function() {
        if (this.authData && this.authData.uid) {
            return this.authData.uid;
        }
        return "";
    }

    this.hasAlreadyLogin = function() {
        return this._isReady && this.getUID();
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
        this._isReady = false;
        this.auth.$unauth();
        this.authData = null;
        this.publicProfileData = null;
        this.profileData = null;
        $rootScope.$broadcast('user:logout');
    }

    this.login = function(email, password) {
        this._isReady = false;
        self.auth.$authWithPassword({email: email, password: password})
            .then(function(authData) {
                self.authData = authData;
            })
            .catch(function(error) {
                console.log(error);
                if ($rootScope.notifyError) {
                    $rootScope.notifyError("Invalid account");
                }
                self.authData = null;
            });
    }

    this.updatePassword = function(password, new_password, callback) {
        callback = callback || {};
        self.auth.$changePassword({
            email: self.getAuthEmail(),
            oldPassword: password,
            newPassword: new_password
        }).then(function() {
            if ($rootScope.notifySuccess) {
                $rootScope.notifySuccess("Password changed successfully!");
            }
            if (callback.success) {callback.success();}
        }).catch(function(error) {
            if ($rootScope.notifyError) {
                $rootScope.notifyError("Error: " + error);
            }
            if (callback.error) {callback.error(error);}
        });
    }

    this.resetPassword = function(email, callback) {
        callback = callback || {};
        self.auth.$resetPassword({
            email: email
        }).then(function() {
            if ($rootScope.notifySuccess) {
                $rootScope.notifySuccess("Email sent. Please check (Maybe in your Updates folder)");
            }
            if (callback.success) {callback.success();}
        }).catch(function(error) {
            if ($rootScope.notifyError) {
                $rootScope.notifyError("Error: " + error);
            }
            if (callback.error) {callback.error(error);}
        });
    }

    this.getPublicProfile = function() {
        return this.publicProfileData;
    }

    this.pushItem = function(obj_name, owner_name, owner_key, data, two_way_binding, callback) {
        var ref = self.getFireBaseInstance(obj_name).push();
        ref.set(data, function(error) {
            if (!error) {
                var key = ref.key();
                var ref2 = self.getFireBaseInstance(["ref_" + owner_name + "_" + obj_name, owner_key, key]);
                ref2.set(true, function(e2) {
                    if (!e2) {
                        if (two_way_binding) {
                            self.getFireBaseInstance(["ref_" + obj_name + "_" + owner_name, key, owner_key]).set(true, function(e3) {
                                if (!e3) {
                                    if (callback && callback.success) {callback.success();}
                                } else {
                                    ref.remove();
                                    ref2.remove();
                                    if (callback && callback.error) {callback.error();}
                                }
                            })
                        } else {
                            if (callback && callback.success) {callback.success();}
                        }
                    } else {
                        ref.remove();
                        if (callback && callback.error) {callback.error();}
                    }
                });
            } else {
                if (callback && callback.error) {callback.error();}
            }
        })
    }

    this.pushItemOne = function(obj_name, owner_name, owner_key, data, callback) {
        self.pushItem(obj_name, owner_name, owner_key, data, false, callback);
    }

    this.pushItemMany = function(obj_name, owner_name, owner_key, data, callback) {
        self.pushItem(obj_name, owner_name, owner_key, data, true, callback);
    }
})


;
