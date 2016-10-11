# babel-plugin-angularjs-annotate

[![Circle CI](https://circleci.com/gh/schmod/babel-plugin-angularjs-annotate.svg?style=svg)](https://circleci.com/gh/schmod/babel-plugin-angularjs-annotate) [![npm version](https://badge.fury.io/js/babel-plugin-angularjs-annotate.svg)](https://badge.fury.io/js/babel-plugin-angularjs-annotate)

Babel plugin to add Angular 1.x annotations to your ES5/ES6 code.  Successor to [ng-annotate](https://github.com/olov/ng-annotate) for Babel/ES6 users.

* Easy upgrade from `ng-annotate`.  
* Fully compatible with ES5, transpiled ES6, and native ES6.
* Full control - Developers can directly specify which functions/classes require Angular DI annotations, or `angularjs-annotate` can figure it out for you!
* Can annotate Angular 1.5 components
* Can annotate ES6 Classes
* Extensive test suite

## Installation

Use like any other [Babel plugin](https://babeljs.io/docs/plugins/).  

Most users will want to run

```sh
$ npm install babel-plugin-angularjs-annotate --save-dev
```

and add the plugin to your `.babelrc` file:

```json
{
  "presets": ["es2015"],
  "plugins": ["angularjs-annotate"]
}
```

## Upgrading to v1.0

As of v1.0.0, `babel-plugin-angularjs-annotate` will only add annotations to functions that have been explicitly annotated
with `'ngInject'` or `/* @ngInject */`.  To re-enable automatic/implicit matching of functions without explicit annotations,
set [`explicitOnly`](#explicitonly) to false.

## Options

[Options may be passed to babel plugins](https://babeljs.io/docs/plugins/#pluginpresets-options) by wrapping the plugin name
in an array, and providing a settings object.  

```json
{
  "presets": ["es2015"],
  "plugins": [["angularjs-annotate", { "explicitOnly": false }], "someOtherPlugin"]
}
```

### `explicitOnly`

Type: `boolean`
Default: `true`

By default, this plugin will attempt to add annotations to common AngularJS code patterns.  This behavior can be disabled (requiring you to mark up functions with `/* @ngInject */` or `'ngInject'`).

To pass this option to the plugin, [add it to your Babel configuration](https://babeljs.io/docs/plugins/#plugin-options):

```json
{
  "presets": ["es2015"],
  "plugins": [["angularjs-annotate", { "explicitOnly" : true}]]
}
```

## Usage

[Try it out in your browser](http://schmod.github.io/babel-plugin-angularjs-annotate/).

### Recommended Usage

Add a `'ngInject';` prologue directive to the top of any function that requires Angular DI annotations.  

<table>
<tr>
  <th>Raw Code></th>
  <th>Transformed</th>
</tr>
<tr>
<td><pre lang="js">angular.module('myApp').controller('myCtrl', function($scope){
  'ngInject';
  doSomething();
});</pre></td>
<td><pre lang="js">angular.module('myApp').controller('myCtrl', ['$scope', function ($scope) {
  'ngInject';
  doSomething();
}]);</pre></td>
</tr>
<tr><pre lang="js">class myClass{
  constructor($scope){
    'ngInject';
  }
}</pre></td>
<td><pre lang="js">class myClass {
  constructor($scope) {}
}
myClass.$inject = ['$scope'];</pre></td>
</tr><tr>
<td><pre lang="js">var x = $scope => {
  "ngInject"
};</pre></td>
<td><pre lang="js">var x = $scope => {};
x.$inject = ["$scope"];</pre></td>
</tr></table>

While `angularjs-annotate` supports many other annotation types, this syntax has proven to be the most reliable,
particularly when used with other preprocessors.

This method requires developers to remember to manually annotate their sources.  We highly recommend
enabling Angular's [strict DI](https://docs.angularjs.org/guide/di#using-strict-dependency-injection)
mode.

### Comment-Based annotations

In addition to prologue directives, `angularjs-annotate` will add DI annotations to functions and classes
that have been annotated with a `/* @ngInject */` comment.

Support for this annotation style is provided for backward-compatibility with `ng-annotate`.
**We do not recommend annotating your sources with comments**, as other build tools have been known to
mangle or remove these comments.  

### Implicit / Automatic annotations

Instead of explicitly annotating every function that requires DI annotations, in many cases, `angularjs-annotate`
can automatically add Angular DI annotations to functions that require them.

This feature is **opt-in**, and requires [`explicitOnly`](#explicitonly) to be set to `false`.  While we support
automatically adding annotations to most idiomatic Angular code, it is impossible for us to anticipate and
accommodate every possible use-case.  Worse still, these will be silent failures that will cause unexpected
breakages in your code.

#### Common Patterns

<table><tr>
<th>Raw Code</th>
<th>Transformed</th>
</tr><tr>
<td><pre lang="js">angular.module("MyMod")
   .controller("MyCtrl", function($scope) {});</pre></td>
<td><pre lang="js">angular.module("MyMod")
   .controller("MyCtrl", ["$scope", function ($scope) {}]);
</pre></td>
</tr><tr>
<td><pre lang="js">myMod.controller("MyCtrl", function($scope) {});</pre></td>
<td><pre lang="js">myMod.controller("MyCtrl", ["$scope", function ($scope) {}]);
</pre></td>

Many other common patterns can be detected.  See [IMPLICIT.md](IMPLICIT.md) and the [test sources](tests/) for details about the patterns that can be automatically detected by ng-annotate and this plugin, as well as information about how to explicitly mark functions and classes for annotation.

#### Negation

When using automatic/implicit matching, a function may be **excluded** from annotation by marking it with a `'ngNoInject'`
prologue directive, or a `/* @ngNoInject */` comment.

#### ES6 Annotations

This plugin can annotate some ES6 classes and arrow functions that are not supported by ng-annotate:

##### Implicit arrow function annotation

Arrow functions may be annotated anywhere that a "regular" function expression may be used.

**NOTE:** There are places where you _shouldn't_ use arrow functions in an Angular application.  Inside of an arrow function, the value of `this` is inherited from the lexical scope enclosing the function.  For this reason, arrow functions should not be used to declare Angular services or providers.  

_If you choose to ignore this warning, we'll add the annotations to your services and providers anyway, but your application probably won't work.  Future releases may treat this condition as an error._

```js
angular.module("MyMod").controller("MyCtrl", ($scope, $timeout) => {});
```

Becomes:

```js
angular.module("MyMod").controller("MyCtrl", ["$scope", "$timeout", ($scope, $timeout) => {}]);
```

##### Explicit arrow function annotation

Arrow functions may also be explicitly marked for annotation.

```js
var x = /* @ngInject */ ($scope) => {};
```

Becomes:

```js
var x = /* @ngInject */ ($scope) => {};
x.$inject = ["$scope"]
```

##### Implicit Class Annotation

If a class is declared as an Angular service or factory in the same file as it is declared, it will be annotated automatically:

```js
class svc {
    constructor(dep1){
        this.dep1 = dep1;
    }
}
angular.module('MyMod').service('MySvc', svc);
```

Becomes:

```js
class svc {
    constructor(dep1){
        this.dep1 = dep1;
    }
}
svc.$inject = ['dep1'];
angular.module('MyMod').service('MySvc', svc);
```

##### Explicit Class Annotation

If a class is exported and used in another file/module, it must be explicitly marked for injection:

```js
/* @ngInject */
class svc {
  constructor(dep1){
      this.dep1 = dep1;
  }
}
```

Prologue directives may also be used here:

```js
class svc {
  constructor(dep1){
      "ngInject";
      this.dep1 = dep1;
  }
}
```

##### Exports

Exported functions and classes may be annotated.  Exported functions must have names:

```js
/* @ngInject */
export default function svc(dep1){}
```

## Notes & Philosophy

This project/experiment does _not_ seek to replicate the full feature set of ng-annotate.
However, it does seek to provide similar functionality for Angular 1.x developers who are
already using Babel and/or writing code in ES6.

Because of some of the limitations presented by Babel's transformation process, this project does not aim to
achieve feature parity, or provide identical output to ng-annotate. Notably, Babel does not preserve formatting
and indentations like ng-annotate does, and this project does not seek to replicate the features of ng-annotate
that remove or transform existing annotations.


## To run tests:

```
npm test
```


## License
`MIT`, see [LICENSE](LICENSE) file.

This project is a fork of [ng-annotate](https://github.com/olov/ng-annotate), which  was written by [Olov Lassus](https://github.com/olov) with the kind help of
[contributors](https://github.com/olov/ng-annotate/graphs/contributors).
