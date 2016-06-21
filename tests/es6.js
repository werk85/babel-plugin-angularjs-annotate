"use strict";
module.exports = {
  name: "ES6 Tests",
  tests: [
  {
    name: "simple class",
    input: function(){
          class svc {
              constructor(dep1){
                  this.dep1 = dep1;
              }
          }
          angular.module('MyMod').service('MySvc', svc);
    },
    expected: function(){
      class svc {
          constructor(dep1){
              this.dep1 = dep1;
          }
      }
      svc.$inject = ['dep1'];

      angular.module('MyMod').service('MySvc', svc);
    }
  },
  {
    name: "annotated class",
    input: function(){
      /* @ngInject */
      class svc {
          constructor(dep1){
              this.dep1 = dep1;
          }
      }
      svc.foo = 'bar';
    },
    expected: function(){
      /* @ngInject */
      class svc {
          constructor(dep1){
              this.dep1 = dep1;
          }
      }
      svc.$inject = ['dep1'];
      svc.foo = 'bar';
    }
  },
  {
    name: "annotated constructor",
    input: function(){
      class svc {
          /* @ngInject */
          constructor(dep1){
              this.dep1 = dep1;
          }
      }
      svc.foo = 'bar';
    },
    expected: function(){
      class svc {
          /* @ngInject */
          constructor(dep1){
              this.dep1 = dep1;
          }
      }
      svc.$inject = ['dep1'];
      svc.foo = 'bar';
    }
  }  
 ]
};
