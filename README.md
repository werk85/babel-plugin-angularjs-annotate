# babel-plugin-angularjs-annotate

[![Circle CI](https://circleci.com/gh/schmod/babel-plugin-angularjs-annotate.svg?style=svg)](https://circleci.com/gh/schmod/babel-plugin-angularjs-annotate) [![npm version](https://badge.fury.io/js/babel-plugin-angularjs-annotate.svg)](https://badge.fury.io/js/babel-plugin-angularjs-annotate)

Fork of [ng-annotate](https://github.com/olov/ng-annotate) for Babel users, with a focus on speed and ES6 support.

Adds Angular 1.x DI annotations to ES5/ES6 code being processed by Babel, with support for explicit annotations (`/* @ngInject */`), and automatic (implicit) annotation of typical Angular code patterns.

Fully compatible with ES5, transpiled ES6, and raw ES6 sources.  Offers significantly reduced build times for projects already using Babel, compared to the standalone ng-annotate tool.

This plugin currently supports matching and transforming all of the patterns currently recognized by ng-annotate (explicit and implicit), and passes the relevant portions of ng-annotate's test suite.

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
  "plugins": ["path/to/babel-ng-annotate"]
}
```

## Usage

See [ng-annotate](https://github.com/olov/ng-annotate)'s documentation and the [test sources](tests/) for details about the patterns that can be automatically detected by ng-annotate and this plugin, as well as information about how to explicitly mark functions and classes for annotation. 

### ES6 Annotations

This plugin can annotate some ES6 classes that are not supported by ng-annotate:

#### Implicit Class Annotation

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

#### Explicit Class Annotation

If a class is exported and used in another file/module, it must be explicitly marked for injection:

```js
/* @ngInject */
class svc {
  constructor(dep1){
      this.dep1 = dep1;
  }
}
```

## Goals & Tasks

This project/experiment does _not_ seek to replace ng-annotate.  However, it does seek to provide similar 
functionality for Angular 1.x developers who are already using Babel and/or writing code in ES6.

Because of some of the limitations presented by Babel's transformation process, this project does not aim to 
achieve feature parity, or provide identical output to ng-annotate. Notably, Babel does not preserve formatting
and indentations like ng-annotate does, and this project does not seek to replicate the features of ng-annotate that remove or transform existing annotations.

Initially, I had hoped to make very few modifications to the upstream sources, in the hopes of eventually
merging babel support directly into ng-annotate.  Unfortunately, Babylon appears to have diverged too 
far from Acorn to make that goal realistic.  (I would love to be wrong here, and would welcome contributions that close the gap between the two projects!)

That being said, this is my short-term todo list:

* ✓ Support the majority of invocations/annotations currently performed by ng-annotate
* ✓ Split up ng-annotate's test suite to be more granular and tolerant of some of babel's other transforms.
* ✓ Actually pass those tests.
* ✓ Pass tests in conjunction with the ES2015 preset. _(almost)_
* ✓ Cleanup.  Remove vestigial functionality from the upstream project.
* ✓ Support a limited set of ES6-friendly annotation patterns.  
* ✓ Publish to npm, make a release, etc.

### To run tests:

```
npm test
```


## License
`MIT`, see [LICENSE](LICENSE) file.

This project is a fork of [ng-annotate](https://github.com/olov/ng-annotate), which  was written by [Olov Lassus](https://github.com/olov) with the kind help by
[contributors](https://github.com/olov/ng-annotate/graphs/contributors).
[Follow @olov](https://twitter.com/olov) on Twitter for updates about ng-annotate.
