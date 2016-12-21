"use strict";
module.exports = {
  name: "ES6 Tests",
  tests: [
  {
    name: "simple class",
    implicit: true,
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
    name: "exported class",
    implicit: true,
    noES5: true, // this works with the ES2015 preset, but the transformations
                 // make it difficult to test
    input: `
      export default class svc {
          constructor(dep1){
              this.dep1 = dep1;
          }
      }
      angular.module('MyMod').service('MySvc', svc);
    `,
    expected: `
      export default class svc {
          constructor(dep1){
              this.dep1 = dep1;
          }
      }
      svc.$inject = ['dep1'];
      angular.module('MyMod').service('MySvc', svc);
    `
  },
  {
    name: "exported annotated function",
    explicit: true,
    input: `
      /* @ngInject */
      export default function svc(dep1){}
    `,
    expected: `
      svc.$inject = ["dep1"];
      /* @ngInject */
      export default function svc(dep1){}
    `
  },
  {
    name: "annotated class",
    explicit: true,
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
    name: "exported annotated class",
    noES5: true,
    explicit: true,
    input: `
      /* @ngInject */
      export default class svc {
          constructor(dep1){
              this.dep1 = dep1;
          }
      }
      svc.foo = 'bar';
    `,
    expected: `
      /* @ngInject */
      export default class svc {
          constructor(dep1){
              this.dep1 = dep1;
          }
      }
      svc.$inject = ['dep1'];
      svc.foo = 'bar';
    `
  },
  {
    name: "annotated constructor",
    explicit: true,
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
  },
  {
    name: "constructor with prologue directive",
    explicit: true,
    input: function(){
      class svc {
          constructor(dep1){
              'ngInject';
              this.dep1 = dep1;
          }
      }
      svc.foo = 'bar';
    },
    expected: function(){
      class svc {
          constructor(dep1){
              'ngInject';
              this.dep1 = dep1;
          }
      }
      svc.$inject = ['dep1'];
      svc.foo = 'bar';
    }
  },
  {
    name: "static class methods",
    noES5: true,
    explicit: true,
    input: function(){
      class svc {
        /* @ngInject */
        static config(dep1) {

        }

        static other(arg1) {

        }

        otherMethod(arg1) {
          
        }

        noArgsMethod() {
          
        }
      }
    },
    expected: function(){
      class svc {
        /* @ngInject */
        static config(dep1) {

        }

        static other(arg1) {

        }

        otherMethod(arg1) {
          
        }

        noArgsMethod() {

        }
      }
      svc.config.$inject = ["dep1"];
    }
  },
  {
    name: "class methods",
    noES5: true,
    explicit: true,
    input: function(){
      class svc {
        /* @ngInject */
        $get(dep1) {

        }

        otherMethod(arg1) {

        }

        noArgsMethod() {
          
        }
      }
    },
    expected: function(){
      class svc {
        /* @ngInject */
        $get(dep1) {

        }

        otherMethod(arg1) {
          
        }

        noArgsMethod() {
          
        }
      }
      svc.prototype.$get.$inject = ["dep1"];
    }
  }
 ]
};
