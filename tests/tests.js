'use strict';

const babel = require('babel-core');
const diff = require('diff');
const chalk = require('chalk');
const indent = require('indent-string');

let suites = [
  require('./simple'),
  require('./provider$get.js')
];

function runSuite(suite){
  suites.forEach(suite =>{
    console.log("Running: " + suite.name);
    runTests(suite.tests);
  });
}

function runTests(tests){
  tests.forEach(test => {
    var out = babel.transform(fnBody(test.input),  { plugins: "../babel-ng-annotate-harmony" });
    var expected = babel.transform(fnBody(test.expected));

    if(out.code.trim() != expected.code.trim()){
      console.warn("  " + test.name + ": FAILED.");
      printDiff(expected.code, out.code)
    } else {
      console.log("  " + test.name + ": PASSED.");
    }
  });
}

function fnBody(fn){
  return fn.toString().match(/function[^{]+\{([\s\S]*)\}$/)[1];
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
}

suites.forEach(runSuite);
