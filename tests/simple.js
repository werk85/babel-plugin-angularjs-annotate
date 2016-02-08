module.exports = {
  name: "Simple Tests",
  tests: [
  {
    name: "Long form",
    input: function(){
      angular.module("MyMod").controller("MyCtrl", function($scope, $timeout) {
      });
    },
    expected: function(){
      angular.module("MyMod").controller("MyCtrl", ["$scope", "$timeout", function($scope, $timeout) {
      }]);
    }
  },
  {
    name: "w/ dependencies",
    input: function(){
      angular.module("MyMod", ["OtherMod"]).controller("MyCtrl", function($scope, $timeout) {
      });
    },
    expected: function(){
      angular.module("MyMod", ["OtherMod"]).controller("MyCtrl", ["$scope", "$timeout", function($scope, $timeout) {
      }]);
    }
  },
  {
    name: "Simple controller",
    input: function(){
      myMod.controller("foo", function($scope, $timeout) {
      });
    },
    expected: function(){
      myMod.controller("foo", ["$scope", "$timeout", function($scope, $timeout) {
      }]);
    }
  },
  {
    name: "Simple service",
    input: function(){
      myMod.service("foo", function($scope, $timeout) {
      });
    },
    expected: function(){
      myMod.service("foo", ["$scope", "$timeout", function($scope, $timeout) {
      }]);
    }
  },
  {
    name: "Simple factory",
    input: function(){
      myMod.factory("foo", function($scope, $timeout) {
      });
    },
    expected: function(){
      myMod.factory("foo", ["$scope", "$timeout", function($scope, $timeout) {
      }]);
    }
  },
  {
    name: "Simple filter",
    input: function(){
      myMod.filter("foo", function($scope, $timeout) {
      });
    },
    expected: function(){
      myMod.filter("foo", ["$scope", "$timeout", function($scope, $timeout) {
      }]);
    }
  },
  {
    name: "Simple directive",
    input: function(){
      myMod.directive("foo", function($scope, $timeout) {
      });
    },
    expected: function(){
      myMod.directive("foo", ["$scope", "$timeout", function($scope, $timeout) {
      }]);
    }
  },
  {
    name: "Simple animation",
    input: function(){
      myMod.animation("foo", function($scope, $timeout) {
      });
    },
    expected: function(){
      myMod.animation("foo", ["$scope", "$timeout", function($scope, $timeout) {
      }]);
    }
  },
  {
    name: "Simple invoke",
    input: function(){
      myMod.invoke("foo", function($scope, $timeout) {
      });
    },
    expected: function(){
      myMod.invoke("foo", ["$scope", "$timeout", function($scope, $timeout) {
      }]);
    }
  },
  {
    name: "Simple store",
    input: function(){
      myMod.store("foo", function($scope, $timeout) {
      });
    },
    expected: function(){
      myMod.store("foo", ["$scope", "$timeout", function($scope, $timeout) {
      }]);
    }
  },
  {
    name: "Simple decorator",
    input: function(){
      myMod.decorator("foo", function($scope, $timeout) {
      });
    },
    expected: function(){
      myMod.decorator("foo", ["$scope", "$timeout", function($scope, $timeout) {
      }]);
    }
  },
  {
    name: "Simple component",
    input: function(){
      myMod.component("foo", {controller: function($scope, $timeout) {}});
    },
    expected: function(){
      myMod.component("foo", {controller: ["$scope", "$timeout", function($scope, $timeout) {}]});
    }
  },
  {
    name: "Implict config function",
    input: function(){
      // implicit config function
      angular.module("MyMod", function($interpolateProvider) {});
      angular.module("MyMod", ["OtherMod"], function($interpolateProvider) {});
      angular.module("MyMod", ["OtherMod"], function($interpolateProvider) {}).controller("foo", function($scope) {});
    },
    expected: function(){
      // implicit config function
      angular.module("MyMod", ["$interpolateProvider", function($interpolateProvider) {}]);
      angular.module("MyMod", ["OtherMod"], ["$interpolateProvider", function($interpolateProvider) {}]);
      angular.module("MyMod", ["OtherMod"], ["$interpolateProvider", function($interpolateProvider) {}]).controller("foo", ["$scope", function($scope) {}]);
    }
  },
  {
    name: "Object property",
    input: function(){
      // object property
      var myObj = {};
      myObj.myMod = angular.module("MyMod");
      myObj.myMod.controller("foo", function($scope, $timeout) { a });

    },
    expected: function(){
      // object property
      var myObj = {};
      myObj.myMod = angular.module("MyMod");
      myObj.myMod.controller("foo", ["$scope", "$timeout", function($scope, $timeout) { a }]);
    }
  },
  {
    name: "Simple invocations w/ no dependencies",
    input: function(){
      // no dependencies => no need to wrap the function in an array
      myMod.controller("foo", function() {
      });
      myMod.service("foo", function() {
      });
      myMod.factory("foo", function() {
      });
      myMod.directive("foo", function() {
      });
      myMod.filter("foo", function() {
      });
      myMod.animation("foo", function() {
      });
      myMod.invoke("foo", function() {
      });
      myMod.store("foo", function() {
      });
      myMod.decorator("foo", function() {
      });
      myMod.component("foo", {controller: function() {}});
    },
    expected: function(){
      // no dependencies => no need to wrap the function in an array
      myMod.controller("foo", function() {
      });
      myMod.service("foo", function() {
      });
      myMod.factory("foo", function() {
      });
      myMod.directive("foo", function() {
      });
      myMod.filter("foo", function() {
      });
      myMod.animation("foo", function() {
      });
      myMod.invoke("foo", function() {
      });
      myMod.store("foo", function() {
      });
      myMod.decorator("foo", function() {
      });
      myMod.component("foo", {controller: function() {}});
    }
  },
  {
    name: "Simple run/config",
    input: function(){
      // run, config don't take names
      myMod.run(function($scope, $timeout) {
      });
      angular.module("MyMod").run(function($scope) {
      });
      myMod.config(function($scope, $timeout) {
      });
      angular.module("MyMod").config(function() {
      });
    },
    expected: function(){
      // run, config don't take names
      myMod.run(["$scope", "$timeout", function($scope, $timeout) {
      }]);
      angular.module("MyMod").run(["$scope", function($scope) {
      }]);
      myMod.config(["$scope", "$timeout", function($scope, $timeout) {
      }]);
      angular.module("MyMod").config(function() {
      });
    }
  },
  {
    name: "Directive return object",
    input: function(){
      // directive return object
      myMod.directive("foo", function($scope) {
          return {
              controller: function($scope, $timeout) {
                  bar;
              }
          }
      });
      myMod.directive("foo", function($scope) {
          return {
              controller: function() {
                  bar;
              }
          }
      });
    },
    expected: function(){
      // directive return object
      myMod.directive("foo", ["$scope", function($scope) {
          return {
              controller: ["$scope", "$timeout", function($scope, $timeout) {
                  bar;
              }]
          }
      }]);
      myMod.directive("foo", ["$scope", function($scope) {
          return {
              controller: function() {
                  bar;
              }
          }
      }]);
    }
  },
  // {
  //   name: "",
  //   input: function(){

  //   },
  //   expected: function(){

  //   }
  // },

  ]
};
