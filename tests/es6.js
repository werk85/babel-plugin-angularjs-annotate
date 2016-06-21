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
    name: "exported class",
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
