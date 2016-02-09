'use strict';

const babel = require('babel-core');
const diff = require('diff');
const chalk = require('chalk');
const indent = require('indent-string');

let suites = [
  require('./simple'),
  require('./provider$get'),
  require('./inside_module'),
  require('./ui-router'),
  require('./modals'),
  require('./ngInject'),
  require('./issues'),
  require('./references')
];

function runSuite(suite){
  console.log(chalk.bold("Running: " + suite.name));
  runTests(suite.tests);
}

function runTests(tests){
  tests.forEach(test => {
    if(test.contextDependent){
      runTests([{
        name: test.name + " - Inside Module",
        input: wrapInAngularModule(test.input),
        expected: wrapInAngularModule(test.expected)
      }, {
        name: test.name + " - Outside Module",
        input: wrapInNonAngularContext(test.input),
        expected: wrapInNonAngularContext(test.input)
      }])
    } else {
      runTest(test);
    }
  });
}

function runTest(test) {
  var out = babel.transform(fnBody(test.input),  { plugins: "../babel-ng-annotate-harmony" });
  var expected = babel.transform(fnBody(test.expected));

  if(out.code.trim() != expected.code.trim()){
    console.warn("  " + test.name + chalk.red.bold(": FAILED."));
    printDiff(expected.code, out.code)
  } else {
    console.log("  " + test.name + chalk.green.bold(": PASSED."));
  }
}


function fnBody(fn){
  return fn.toString().match(/function[^{]+\{([\s\S]*)\}$/)[1];
}

function wrapInAngularModule(fn){
  var prefix = "angular.module(\"MyMod\").directive(\"pleasematchthis\", function() {\n";
  var suffix = "\n});"
  return eval(Function(prefix + fnBody(fn) + suffix));
}

function wrapInNonAngularContext(fn){
  var prefix = "foobar.irrespective(\"dontmatchthis\", function() {\n";
  var suffix = "\n});"
  return eval(Function(prefix + fnBody(fn) + suffix));
}

function printDiff(expected, actual){
  var delta = diff.diffLines(actual, expected, {ignoreWhitespace: true});
  delta.forEach(part => {
    let msg = indent(part.value, " ", 6);
    if(part.removed){
      msg = chalk.red("-" + msg);
    } else if(part.added) {
      msg = chalk.green("+" + msg);
    } else {
      msg = chalk.gray(msg);
    }
    console.warn("     " + msg);
  });
  console.warn(chalk.bold("GOT:") + "\n" + actual);
  console.warn(chalk.bold("WANTED:") + "\n" + expected);
}

suites.forEach(runSuite);
