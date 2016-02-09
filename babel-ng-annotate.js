import { match, isFunctionExpressionWithArgs, isFunctionDeclarationWithArgs,
isAnnotatedArray, addModuleContextDependentSuspect, addModuleContextIndependentSuspect,
stringify, matchResolve, matchProp, last, judgeSuspects, matchDirectiveReturnObject,
matchProviderGet } from './ng-annotate-main.js'

import ngInject from './nginject';
import is from 'simple-is';

export default function({ types: t }) {

    var options = {};

    const quot = options.single_quotes ? "'" : '"';
    const re = (options.regexp ? new RegExp(options.regexp) : /^[a-zA-Z0-9_\$\.\s]+$/);

    // suspects is built up with suspect nodes by match.
    // A suspect node will get annotations added / removed if it
    // fulfills the arrayexpression or functionexpression look,
    // and if it is in the correct context (inside an angular
    // module definition)
    const suspects = [];

    // blocked is an array of blocked suspects. Any target node
    // (final, i.e. IIFE-jumped, reference-followed and such) included
    // in blocked will be ignored by judgeSuspects
    const blocked = [];

    // scopeTools.setupScopeAndReferences(ast);

    const ctx = {
        mode: "add",
        quot: quot,
        re: re,
        suspects: suspects,
        blocked: blocked,
        isFunctionExpressionWithArgs: isFunctionExpressionWithArgs,
        isFunctionDeclarationWithArgs: isFunctionDeclarationWithArgs,
        isAnnotatedArray: isAnnotatedArray,
        addModuleContextDependentSuspect: addModuleContextDependentSuspect,
        addModuleContextIndependentSuspect: addModuleContextIndependentSuspect,
        stringify: stringify,
        matchResolve: matchResolve,
        matchProp: matchProp,
        last: last
    };

  var addTargets = function(targets) {
    if (!targets) {
        return;
    }
    if (!is.array(targets)) {
        targets = [targets];
    }

    for (let i = 0; i < targets.length; i++) {
        addModuleContextDependentSuspect(targets[i], ctx);
    }
  };

  return {
    visitor: {
      AssignmentExpression: {
        enter(path) {
          ngInject.inspectAssignment(path, ctx);
        },
        exit(path) {
          let targets = matchProviderGet(path);
          addTargets(targets);
        }
      },
      VariableDeclarator: {
        enter(path) {
          ngInject.inspectDeclarator(path, ctx);
        }
      },
      ObjectExpression: {
        enter(path) {
          ngInject.inspectObjectExpression(path, ctx);
        },
        exit(path) {
          let targets = matchProviderGet(path);
          addTargets(targets);
        }
      },
      ReturnStatement: {
        exit(path) {
          let targets = matchDirectiveReturnObject(path);
          addTargets(targets);
        }
      },
      FunctionExpression: {
        enter(path) {
          ngInject.inspectFunction(path, ctx);
        }
      },
      FunctionDeclaration: {
        enter(path) {
          ngInject.inspectFunction(path, ctx);
        }
      },
      CallExpression: {
        enter(path) {
          ngInject.inspectCallExpression(path, ctx);
        },
        exit(path) {
          let targets = match(path, ctx);
          addTargets(targets);
        }
      },
      Program: {
        enter(path, file) {
          ctx.suspects = [];
          ctx.blocked = [];
          ctx.fragments = [];

          ctx.srcForRange = function(node) {
            return file.file.code.slice(node.start, node.end);
          };
        },
        exit(path, file) {
          judgeSuspects(ctx);
        }
      }
    }
  };
}
