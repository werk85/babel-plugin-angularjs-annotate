# babel-plugin-angularjs-annotate

[![Circle CI](https://circleci.com/gh/schmod/babel-plugin-angularjs-annotate.svg?style=svg)](https://circleci.com/gh/schmod/bablel-plugin-angularjs-annotate)

Experimental fork of [ng-annotate](https://github.com/olov/ng-annotate).

Work in progress.  **Do not use this for anything serious.**  Stick with [ng-annotate](https://github.com/olov/ng-annotate)
or [babel-ng-annotate](https://github.com/mchmielarski/babel-plugin-ng-annotate) for now.

## Goals & Tasks

This project/experiment does _not_ seek to replace ng-annotate.  However, it does seek to provide similar 
functionality for Angular 1.x developers who are already using Babel and/or coding in ES6.

Because of some of the limitations presented by Babel's transformation process, this project does not aim to 
achieve feature parity, or provide identical output to ng-annotate. Notably, Babel does not preserve formatting
and indentations like ng-annotate does.

Initially, I had hoped to make very few modifications to the upstream sources, in the hopes of eventually
merging babel support directly into ng-annotate.  Unfortunately, Babylon appears to have diverged too 
far from Acorn to make that goal realistic.  (I would love to be wrong here, and would welcome contributions that close the gap between the two projects!)

That being said, this is my short-term todo list:

* ✓ Support the majority of invocations/annotations currently performed by ng-annotate
* ✓ Split up ng-annotate's test suite to be more granular and tolerant of some of babel's other transforms.
* ✓ Actually pass those tests.
* Pass tests in conjunction with the ES2015 preset.
* Cleanup.  Remove vestigial functionality from the upstream project.
* Support a (very) limited set of ES6-friendly annotation patterns.  
* Publish to npm, make a release, etc.


## Don't Say I Didn't Warn You

To test this mess of an experiment, create a .babelrc file for your sources 

```json
{
  "presets": ["es2015"],
  "plugins": ["path/to/babel-ng-annotate"]
}

```

And try it out:

```
babel myCode.js
```

### To run tests:

```
npm test
```


## License
`MIT`, see [LICENSE](LICENSE) file.

This project is a fork of [ng-annotate](https://github.com/olov/ng-annotate), which  was written by [Olov Lassus](https://github.com/olov) with the kind help by
[contributors](https://github.com/olov/ng-annotate/graphs/contributors).
[Follow @olov](https://twitter.com/olov) on Twitter for updates about ng-annotate.
