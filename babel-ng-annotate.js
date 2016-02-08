import { match, isFunctionExpressionWithArgs, isFunctionDeclarationWithArgs,
isAnnotatedArray, addModuleContextDependentSuspect, addModuleContextIndependentSuspect,
stringify, matchResolve, matchProp, last, allOptionals, judgeSuspects, matchDirectiveReturnObject,
matchProviderGet } from './ng-annotate-main.js'

import ngInject from './nginject';
import stringmap from 'stringmap';
import is from 'simple-is';

export default function({ types: t }) {

    var options = {};

    if (options.list) {
        return {
            list: Object.keys(allOptionals).sort(),
        };
    }

    const quot = options.single_quotes ? "'" : '"';
    const re = (options.regexp ? new RegExp(options.regexp) : /^[a-zA-Z0-9_\$\.\s]+$/);

    const stats = {};

    // [{type: "Block"|"Line", value: str, range: [from,to]}, ..]
    let comments = [];

    stats.parser_parse_t1 = Date.now();

    // // append a dummy-node to ast so that lut.findNodeFromPos(lastPos) returns something
    // ast.body.push({
    //     type: "DebuggerStatement",
    //     range: [ast.range[1], ast.range[1]],
    //     loc: {
    //         start: ast.loc.end,
    //         end: ast.loc.end
    //     }
    // });

    // all source modifications are built up as operations in the
    // fragments array, later sent to alter in one shot
    const fragments = [];

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

    // Position information for all nodes in the AST,
    // used for sourcemap generation
    const nodePositions = [];

    // const lut = new Lut(ast, src);

    // scopeTools.setupScopeAndReferences(ast);

    const ctx = {
        mode: "add",
        quot: quot,
        re: re,
        comments: comments,
        fragments: fragments,
        suspects: suspects,
        blocked: blocked,
        // lut: lut,
        isFunctionExpressionWithArgs: isFunctionExpressionWithArgs,
        isFunctionDeclarationWithArgs: isFunctionDeclarationWithArgs,
        isAnnotatedArray: isAnnotatedArray,
        addModuleContextDependentSuspect: addModuleContextDependentSuspect,
        addModuleContextIndependentSuspect: addModuleContextIndependentSuspect,
        stringify: stringify,
        nodePositions: nodePositions,
        matchResolve: matchResolve,
        matchProp: matchProp,
        last: last
    };

    // setup optionals
    const optionals = options.enable || [];
    for (let i = 0; i < optionals.length; i++) {
        const optional = String(optionals[i]);
        if (!allOptionals.hasOwnProperty(optional)) {
            return {
                errors: ["error: found no optional named " + optional],
            };
        }
    }
    const optionalsPlugins = optionals.map(function(optional) {
        return allOptionals[optional];
    });

    const plugins = [].concat(optionalsPlugins, options.plugin || []);

    function matchPlugins(node, isMethodCall) {
        for (let i = 0; i < plugins.length; i++) {
            const res = plugins[i].match(node, isMethodCall);
            if (res) {
                return res;
            }
        }
        return false;
    }
    const matchPluginsOrNull = (plugins.length === 0 ? null : matchPlugins);

    ngInject.inspectComments(ctx);
    plugins.forEach(function(plugin) {
        plugin.init(ctx);
    });

    // try {
    //     judgeSuspects(ctx);
    // } catch(e) {
    //     return {
    //         errors: ["error: " + e],
    //     };
    // }

    // uniqifyFragments(ctx.fragments);

    // const out = alter(src, fragments);
    // const result = {
    //     src: out,
    //     _stats: stats,
    // };
    //
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
          if(path.node.loc){
            ctx.nodePositions.push(path.node.loc.start);
          }
          let targets = match(path, ctx, matchPluginsOrNull);
          addTargets(targets);
        }
      },
      Program: {
        enter(path, file) {
          ctx.srcForRange = function(node) {
            return file.file.code.slice(node.start, node.end);
          };
        },
        exit(path, file) {
          judgeSuspects(ctx);
          // console.log(path);
        }
      }
    }
  };
}
