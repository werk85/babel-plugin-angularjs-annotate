// ng-annotate-main.js
// MIT licensed, see LICENSE file
// Copyright (c) 2013-2016 Olov Lassus <olov.lassus@gmail.com>

"use strict";
const fmt = require("simple-fmt");
const is = require("simple-is");
const alter = require("alter");
const traverse = require("ordered-ast-traverse");
let EOL = require("os").EOL;
const assert = require("assert");
const ngInject = require("./nginject");
const generateSourcemap = require("./generate-sourcemap");
const Lut = require("./lut");
const scopeTools = require("./scopetools");
const stringmap = require("stringmap");
const optionalAngularDashboardFramework = require("./optionals/angular-dashboard-framework");
const require_acorn_t0 = Date.now();
const parser = require("acorn").parse;
const require_acorn_t1 = Date.now();
const t = require('babel-types');


const chainedRouteProvider = 1;
const chainedUrlRouterProvider = 2;
const chainedStateProvider = 3;
const chainedRegular = 4;

function match(path, ctx, matchPlugins) {
    const node = path.node;
    const isMethodCall = (
        t.isCallExpression(node) &&
            t.isMemberExpression(node.callee) &&
            node.callee.computed === false
        );

    if(isMethodCall && ngInject.inspectComment(path, ctx)){
        return false;
    }

    // matchInjectorInvoke must happen before matchRegular
    // to prevent false positive ($injector.invoke() outside module)
    // matchProvide must happen before matchRegular
    // to prevent regular from matching it as a short-form
    const matchMethodCalls = (isMethodCall &&
        (matchInjectorInvoke(path) || matchProvide(path, ctx) || matchRegular(path, ctx) || matchNgRoute(path) || matchMaterialShowModalOpen(path) || matchNgUi(path) || matchHttpProvider(path) || matchControllerProvider(path)));

    return matchMethodCalls;
}

function matchMaterialShowModalOpen(path) {
    // $mdDialog.show({.. controller: fn, resolve: {f: function($scope) {}, ..}});
    // $mdToast.show({.. controller: fn, resolve: {f: function($scope) {}, ..}});
    // $mdBottomSheet.show({.. controller: fn, resolve: {f: function($scope) {}, ..}});
    // $modal.open({.. controller: fn, resolve: {f: function($scope) {}, ..}});

    // we already know that node is a (non-computed) method call
    const node = path.node;
    const callee = node.callee;
    const obj = callee.object; // identifier or expression
    const method = callee.property; // identifier
    const args = node.arguments;

    if (t.isIdentifier(obj) &&
        ((is.someof(obj.name, ["$modal", "$uibModal"]) && method.name === "open") || (is.someof(obj.name, ["$mdDialog", "$mdToast", "$mdBottomSheet"]) && method.name === "show")) &&
        args.length === 1 && t.isObjectExpression(args[0])) {
        let args = path.get("arguments");
        const props = args[0].get("properties");
        const res = [matchProp("controller", props)];
        res.push.apply(res, matchResolve(props));
        return res.filter(Boolean);
    }
    return false;
}

function matchDirectiveReturnObject(pathOrNode) {
    const node = pathOrNode.node || pathOrNode;

    // only matches inside directives
    // return { .. controller: function($scope, $timeout), ...}

    return limit("directive", t.isReturnStatement(node) &&
        node.argument && t.isObjectExpression(node.argument) &&
        matchProp("controller", (pathOrNode.get && pathOrNode.get("argument.properties") || node.argument.properties)));
}

function limit(name, pathOrNode) {
    const node = (pathOrNode && pathOrNode.node) || pathOrNode;

    if (node && !node.$limitToMethodName) {
        pathOrNode.$limitToMethodName = name;
        // node.$limitToMethodName = name;
    }
    return pathOrNode;
}

function matchProviderGet(path) {
    // only matches inside providers
    // (this|self|that).$get = function($scope, $timeout)
    // { ... $get: function($scope, $timeout), ...}
    const node = path.node;
    let memberExpr;
    let self;
    var yes = limit("provider", (t.isAssignmentExpression(node) && t.isMemberExpression(memberExpr = node.left) &&
        memberExpr.property.name === "$get" &&
        (t.isThisExpression(self = memberExpr.object) || (t.isIdentifier(self) && is.someof(self.name, ["self", "that"]))) &&
        path.get("right")) ||
        (t.isObjectExpression(node) && matchProp("$get", path.get("properties"))));

    return yes;
}

function matchNgRoute(path) {
    // $routeProvider.when("path", {
    //   ...
    //   controller: function($scope) {},
    //   resolve: {f: function($scope) {}, ..}
    // })

    // we already know that node is a (non-computed) method call
    const node = path.node;
    const callee = node.callee;
    const obj = callee.object; // identifier or expression
    if (!(obj.$chained === chainedRouteProvider || (t.isIdentifier(obj) && obj.name === "$routeProvider"))) {
        return false;
    }
    node.$chained = chainedRouteProvider;

    const method = callee.property; // identifier
    if (method.name !== "when") {
        return false;
    }

    const args = path.get("arguments");
    if (args.length !== 2) {
        return false;
    }
    const configArg = last(args)
    if (!t.isObjectExpression(configArg)) {
        return false;
    }

    const props = configArg.get("properties");
    const res = [
        matchProp("controller", props)
    ];
    // {resolve: ..}
    res.push.apply(res, matchResolve(props));

    const filteredRes = res.filter(Boolean);
    return (filteredRes.length === 0 ? false : filteredRes);
}

function matchNgUi(path) {
    // $stateProvider.state("myState", {
    //     ...
    //     controller: function($scope)
    //     controllerProvider: function($scope)
    //     templateProvider: function($scope)
    //     onEnter: function($scope)
    //     onExit: function($scope)
    // });
    // $stateProvider.state("myState", {... resolve: {f: function($scope) {}, ..} ..})
    // $stateProvider.state("myState", {... params: {params: {simple: function($scope) {}, inValue: { value: function($scope) {} }} ..})
    // $stateProvider.state("myState", {... views: {... somename: {... controller: fn, controllerProvider: fn, templateProvider: fn, resolve: {f: fn}}}})
    //
    // stateHelperProvider.setNestedState({ sameasregularstate, children: [sameasregularstate, ..]})
    // stateHelperProvider.setNestedState({ sameasregularstate, children: [sameasregularstate, ..]}, true)
    //
    // $urlRouterProvider.when(.., function($scope) {})
    //
    // $modal.open see matchMaterialShowModalOpen

    // we already know that node is a (non-computed) method call
    const node = path.node;
    const callee = node.callee;
    const obj = callee.object; // identifier or expression
    const method = callee.property; // identifier
    let args = path.get("arguments");

    // shortcut for $urlRouterProvider.when(.., function($scope) {})
    if (obj.$chained === chainedUrlRouterProvider || (t.isIdentifier(obj) && obj.name === "$urlRouterProvider")) {
        node.$chained = chainedUrlRouterProvider;

        if (method.name === "when" && args.length >= 1) {
            return last(args);
        }
        return false;
    }

    // everything below is for $stateProvider and stateHelperProvider alone
    if (!(obj.$chained === chainedStateProvider || (t.isIdentifier(obj) && is.someof(obj.name, ["$stateProvider", "stateHelperProvider"])))) {
        return false;
    }
    node.$chained = chainedStateProvider;

    if (is.noneof(method.name, ["state", "setNestedState"])) {
        return false;
    }

    // $stateProvider.state({ ... }) and $stateProvider.state("name", { ... })
    // stateHelperProvider.setNestedState({ .. }) and stateHelperProvider.setNestedState({ .. }, true)
    if (!(args.length >= 1 && args.length <= 2)) {
        return false;
    }

    const configArg = (method.name === "state" ? last(args) : args[0]);

    const res = [];

    recursiveMatch(configArg);

    const filteredRes = res.filter(Boolean);
    return (filteredRes.length === 0 ? false : filteredRes);


    function recursiveMatch(objectExpressionPath) {
        if (!objectExpressionPath || !t.isObjectExpression(objectExpressionPath)) {
            return false;
        }

        const properties = objectExpressionPath.get("properties");

        matchStateProps(properties, res);

        const childrenArrayExpression = matchProp("children", properties);
        const children = childrenArrayExpression && childrenArrayExpression.get("elements");

        if (!children) {
            return;
        }
        children.forEach(recursiveMatch);
    }

    function matchStateProps(props, res) {
        const simple = [
            matchProp("controller", props),
            matchProp("controllerProvider", props),
            matchProp("templateProvider", props),
            matchProp("onEnter", props),
            matchProp("onExit", props),
        ];
        res.push.apply(res, simple);

        // {resolve: ..}
        res.push.apply(res, matchResolve(props));

        // {params: {simple: function($scope) {}, inValue: { value: function($scope) {} }}
        const a = matchProp("params", props);
        if (a && t.isObjectExpression(a)) {
            a.get("properties").forEach(function(prop) {
                let value = prop.get("value");
                if (t.isObjectExpression(value)) {
                    res.push(matchProp("value", value.get("properties")));
                } else {
                    res.push(value);
                }
            });
        }

        // {view: ...}
        const viewObject = matchProp("views", props);
        if (viewObject && t.isObjectExpression(viewObject)) {
            viewObject.get("properties").forEach(function(prop) {
                let value = prop.get("value");
                if (t.isObjectExpression(value)) {
                    let props = value.get("properties");
                    res.push(matchProp("controller", props));
                    res.push(matchProp("controllerProvider", props));
                    res.push(matchProp("templateProvider", props));
                    res.push.apply(res, matchResolve(props));
                }
            });
        }
    }
}

function matchInjectorInvoke(path) {
    // $injector.invoke(function($compile) { ... });

    // we already know that node is a (non-computed) method call
    const node = path.node;
    const callee = node.callee;
    const obj = callee.object; // identifier or expression
    const method = callee.property; // identifier
    let args;

    return method.name === "invoke" &&
        t.isIdentifier(obj) && obj.name === "$injector" &&
        (args = path.get("arguments")).length >= 1 && args;
}

function matchHttpProvider(path) {
    // $httpProvider.interceptors.push(function($scope) {});
    // $httpProvider.responseInterceptors.push(function($scope) {});

    // we already know that node is a (non-computed) method call
    const node = path.node;
    const callee = node.callee;
    const obj = callee.object; // identifier or expression
    const method = callee.property; // identifier
    let args;

    return (method.name === "push" &&
        t.isMemberExpression(obj) && !obj.computed &&
        obj.object.name === "$httpProvider" && is.someof(obj.property.name,  ["interceptors", "responseInterceptors"]) &&
        (args = path.get("arguments")).length >= 1 && args);
}

function matchControllerProvider(path) {
    // $controllerProvider.register("foo", function($scope) {});

    // we already know that node is a (non-computed) method call
    const node = path.node;
    const callee = node.callee;
    const obj = callee.object; // identifier or expression
    const method = callee.property; // identifier
    let args;

    const target = t.isIdentifier(obj) && obj.name === "$controllerProvider" &&
        method.name === "register" && (args = path.get("arguments")).length === 2 && args[1];

    if (target) {
        target.node.$methodName = method.name;
    }
    return target;
}

function matchProvide(path, ctx) {
    // $provide.decorator("foo", function($scope) {});
    // $provide.service("foo", function($scope) {});
    // $provide.factory("foo", function($scope) {});
    // $provide.provider("foo", function($scope) {});

    // we already know that node is a (non-computed) method call
    const node = path.node;
    const callee = node.callee;
    const obj = callee.object; // identifier or expression
    const method = callee.property; // identifier
    const args = path.get("arguments");

    const target = t.isIdentifier(obj) && obj.name === "$provide" &&
        is.someof(method.name, ["decorator", "service", "factory", "provider"]) &&
        args.length === 2 && args[1];

    if (target) {
        target.node.$methodName = method.name;
        target.$methodName = method.name;

        if (ctx.rename) {
            // for eventual rename purposes
            return args;
        }
    }
    return target;
}

function matchRegular(path, ctx) {
    // we already know that node is a (non-computed) method call
    const node = path.node;
    const callee = node.callee;
    const obj = callee.object; // identifier or expression
    const method = callee.property; // identifier

    // short-cut implicit config special case:
    // angular.module("MyMod", function(a) {})
    if (obj.name === "angular" && method.name === "module") {
        const args = path.get("arguments");
        if (args.length >= 2) {
            node.$chained = chainedRegular;
            return last(args);
        }
    }

    // hardcoded exception: foo.decorator is generally considered a short-form
    // declaration but $stateProvider.decorator is not. see https://github.com/olov/ng-annotate/issues/82
    if (obj.name === "$stateProvider" && method.name === "decorator") {
        return false;
    }

    const matchAngularModule = (obj.$chained === chainedRegular || isReDef(obj,ctx) || isLongDef(obj)) &&
        is.someof(method.name, ["provider", "value", "constant", "bootstrap", "config", "factory", "directive", "filter", "run", "controller", "service", "animation", "invoke", "store", "decorator", "component"]);
    if (!matchAngularModule) {
        return false;
    }
    node.$chained = chainedRegular;

    if (is.someof(method.name, ["value", "constant", "bootstrap"])) {
        return false; // affects matchAngularModule because of chaining
    }

    const args = node.arguments;
    const argPaths = path.get("arguments");
    let target = (is.someof(method.name, ["config", "run"]) ?
        args.length === 1 && argPaths[0] :
        args.length === 2 && t.isLiteral(args[0]) && is.string(args[0].value) && argPaths[1]);

    if (method.name === "component") {
        const controllers = target.get("properties").filter(prop => prop.node.key.name == "controller");
        if(controllers.length === 1) {
            target = controllers[0].get("value");
        } else {
            return false;
        }
    }

    if (target) {
        target.node.$methodName = method.name;
    }

    if (ctx.rename && args.length === 2 && target) {
        // for eventual rename purposes
        const somethingNameLiteral = args[0];
        return [somethingNameLiteral, target];
    }
    return target;
}

// matches with default regexp
//   *.controller("MyCtrl", function($scope, $timeout) {});
//   *.*.controller("MyCtrl", function($scope, $timeout) {});
// matches with --regexp "^require(.*)$"
//   require("app-module").controller("MyCtrl", function($scope) {});
function isReDef(node, ctx) {
    return ctx.re.test(ctx.srcForRange(node));
}

// Long form: angular.module(*).controller("MyCtrl", function($scope, $timeout) {});
function isLongDef(node) {
    return node.callee &&
        node.callee.object && node.callee.object.name === "angular" &&
        node.callee.property && node.callee.property.name === "module";
}

function last(arr) {
    return arr[arr.length - 1];
}

function matchProp(name, props) {
    for (let i = 0; i < props.length; i++) {
        const propOrPath = props[i];
        const prop = propOrPath.node || propOrPath;

        if ((t.isIdentifier(prop.key) && prop.key.name === name) ||
            (t.isLiteral(prop.key) && prop.key.value === name)) {
            return (propOrPath.get && propOrPath.get("value")) || prop.value; // FunctionExpression or ArrayExpression
        }
    }
    return null;
}

function matchResolve(props) {
    const resolveObject = matchProp("resolve", props);
    if (resolveObject && t.isObjectExpression(resolveObject)) {
        return resolveObject.get("properties").map(function(prop) {
            return prop.get("value");
        });
    }
    return [];
};

function renamedString(ctx, originalString) {
    if (ctx.rename) {
        return ctx.rename.get(originalString) || originalString;
    }
    return originalString;
}

function stringify(ctx, arr, quot) {
    return "[" + arr.map(function(arg) {
        return quot + renamedString(ctx, arg.name) + quot;
    }).join(", ") + "]";
}

function parseExpressionOfType(str, type) {
    const node = parser(str).body[0].expression;
    assert(node.type === type);
    return node;
}

// stand-in for not having a jsshaper-style ref's
function replaceNodeWith(node, newNode) {
    let done = false;
    const parent = node.$parent;
    const keys = Object.keys(parent);
    keys.forEach(function(key) {
        if (parent[key] === node) {
            parent[key] = newNode;
            done = true;
        }
    });

    if (done) {
        return;
    }

    // second pass, now check arrays
    keys.forEach(function(key) {
        if (Array.isArray(parent[key])) {
            const arr = parent[key];
            for (let i = 0; i < arr.length; i++) {
                if (arr[i] === node) {
                    arr[i] = newNode;
                    done = true;
                }
            }
        }
    });

    assert(done);
}

function insertArray(ctx, path, fragments, quot) {
    if(!path.node){
        console.warn("Not a path", path, path.loc.start, path.loc.end);
        return;
    }

    // const args = stringify(ctx, functionExpression.params, quot);

    // fragments.push({
    //     start: functionExpression.range[0],
    //     end: functionExpression.range[0],
    //     str: args.slice(0, -1) + ", ",
    //     loc: {
    //         start: functionExpression.loc.start,
    //         end: functionExpression.loc.start
    //     }
    // });
    // fragments.push({
    //     start: functionExpression.range[1],
    //     end: functionExpression.range[1],
    //     str: "]",
    //     loc: {
    //         start: functionExpression.loc.end,
    //         end: functionExpression.loc.end
    //     }
    // });

    let toParam = path.node.params.map(param => param.name);
    let elems = toParam.map(i => t.stringLiteral(i));

    elems.push(path.node);

    path.replaceWith(
        t.expressionStatement(
            t.arrayExpression(elems)
        )
    );

}

function replaceArray(ctx, array, fragments, quot) {
    const functionExpression = last(array.elements);

    if (functionExpression.params.length === 0) {
        return removeArray(array, fragments);
    }

    const args = stringify(ctx, functionExpression.params, quot);
    fragments.push({
        start: array.range[0],
        end: functionExpression.range[0],
        str: args.slice(0, -1) + ", ",
        loc: {
            start: array.loc.start,
            end: functionExpression.loc.start
        }
    });
}

function removeArray(array, fragments) {
    const functionExpression = last(array.elements);

    fragments.push({
        start: array.range[0],
        end: functionExpression.range[0],
        str: "",
        loc: {
            start: array.loc.start,
            end: functionExpression.loc.start
        }
    });
    fragments.push({
        start: functionExpression.range[1],
        end: array.range[1],
        str: "",
        loc: {
            start: functionExpression.loc.end,
            end: array.loc.end
        }
    });
}

function renameProviderDeclarationSite(ctx, literalNode, fragments) {
    fragments.push({
        start: literalNode.range[0] + 1,
        end: literalNode.range[1] - 1,
        str: renamedString(ctx, literalNode.value),
        loc: {
            start: {
                line: literalNode.loc.start.line,
                column: literalNode.loc.start.column + 1
            }, end: {
                line: literalNode.loc.end.line,
                column: literalNode.loc.end.column - 1
            }
        }
    });
}

function judgeSuspects(ctx) {
    const mode = ctx.mode;
    const fragments = ctx.fragments;
    const quot = ctx.quot;
    const blocked = ctx.blocked;

    const suspects = makeUnique(ctx.suspects, 1);

    for (let n = 0; n < 42; n++) {
        // could be while(true), above is just a safety-net
        // in practice it will loop just a couple of times
        propagateModuleContextAndMethodName(suspects);
        if (!setChainedAndMethodNameThroughIifesAndReferences(suspects)) {
            break;
        }
    }

    // create final suspects by jumping, following, uniq'ing, blocking
    const finalSuspects = makeUnique(suspects.map(function(target) {
        const jumped = jumpOverIife(target);
        const jumpedAndFollowed = followReference(jumped) || jumped;

        if (target.$limitToMethodName && target.$limitToMethodName !== "*never*" && findOuterMethodName(target) !== target.$limitToMethodName) {
            return null;
        }

        if (blocked.indexOf(jumpedAndFollowed) >= 0) {
            return null;
        }

        return jumpedAndFollowed;
    }).filter(Boolean), 2);

    finalSuspects.forEach(function(nodeOrPath) {
        let target = nodeOrPath.node || nodeOrPath;
        if (target.$chained !== chainedRegular) {
            console.warn("Skipping", nodeOrPath.node.loc.start.line);
            return;
        }

        if (mode === "rebuild" && isAnnotatedArray(target)) {
            replaceArray(ctx, target, fragments, quot);
        } else if (mode === "remove" && isAnnotatedArray(target)) {
            removeArray(target, fragments);
        } else if (is.someof(mode, ["add", "rebuild"]) && isFunctionExpressionWithArgs(target)) {
            insertArray(ctx, nodeOrPath, fragments, quot);
        } else if (isGenericProviderName(target)) {
            console.warn("Generic provider rename disabled");
            // renameProviderDeclarationSite(ctx, target, fragments);
        } else {
            // if it's not array or function-expression, then it's a candidate for foo.$inject = [..]
            judgeInjectArraySuspect(nodeOrPath, ctx);
        }
    });


    function propagateModuleContextAndMethodName(suspects) {
        suspects.forEach(function(path) {
            if (path.node.$chained !== chainedRegular && isInsideModuleContext(path)) {
                path.node.$chained = chainedRegular;
            }

            if (!path.node.$methodName) {
                const methodName = findOuterMethodName(path);
                if (methodName) {
                    path.node.$methodName = methodName;
                }
            }
        });
    }

    function findOuterMethodName(path) {
        for (; path && !path.node.$methodName; path = path.parentPath) {
        }
        return path ? path.node.$methodName : null;
    }

    function setChainedAndMethodNameThroughIifesAndReferences(suspects) {
        let modified = false;
        suspects.forEach(function(path) {
            const target = path.node;

            const jumped = jumpOverIife(path);
            const jumpedNode = jumped.node;
            if (jumpedNode !== target) { // we did skip an IIFE
                if (target.$chained === chainedRegular && jumpedNode.$chained !== chainedRegular) {
                    modified = true;
                    jumpedNode.$chained = chainedRegular;
                }
                if (target.$methodName && !jumpedNode.$methodName) {
                    modified = true;
                    jumpedNode.$methodName = target.$methodName;
                }
            }

            const jumpedAndFollowed = followReference(jumped) || jumped;
            if (jumpedAndFollowed.node !== jumped.node) { // we did follow a reference
                if (jumped.node.$chained === chainedRegular && jumpedAndFollowed.node.$chained !== chainedRegular) {
                    modified = true;
                    jumpedAndFollowed.node.$chained = chainedRegular;
                }
                if (jumped.node.$methodName && !jumpedAndFollowed.node.$methodName) {
                    modified = true;
                    jumpedAndFollowed.node.$methodName = jumped.node.$methodName;
                }
            }
        });
        return modified;
    }

    function isInsideModuleContext(path) {
        let $parent = path.parentPath;
        for (; $parent && $parent.node.$chained !== chainedRegular; $parent = $parent.parentPath) {
        }
        return Boolean($parent);
    }

    function makeUnique(suspects, val) {
        return suspects.filter(function(target) {
            if (target.$seen === val) {
                return false;
            }
            target.$seen = val;
            return true;
        });
    }
}

function followReference(path) {
    if(!path || !path.node){
        console.warn("not a path");
    }
    const node = path.node;
    if (!scopeTools.isReference(path)) {
        return null;
    }

    const binding = path.scope.getBinding(node.name);
    if(!binding){
        console.warn("invalid binding");
        return null;
    }

    const kind = binding.kind;
    const bound = binding.path;

    if (is.someof(kind, ["const", "let", "var"])) {
        assert(t.isVariableDeclarator(bound));
        // {type: "VariableDeclarator", id: {type: "Identifier", name: "foo"}, init: ..}
        return bound;
    } else if (kind === "hoisted") {
        assert(t.isFunctionDeclaration(bound) || t.isFunctionExpression(bound));
        // FunctionDeclaration is the common case, i.e.
        // function foo(a, b) {}

        // FunctionExpression is only applicable for cases similar to
        // var f = function asdf(a,b) { mymod.controller("asdf", asdf) };
        return bound;
    }

    // other kinds should not be handled ("param", "caught")

    return null;
}

// O(srclength) so should only be used for debugging purposes, else replace with lut
function posToLine(pos, src) {
    if (pos >= src.length) {
        pos = src.length - 1;
    }

    if (pos <= -1) {
        return -1;
    }

    let line = 1;
    for (let i = 0; i < pos; i++) {
        if (src[i] === "\n") {
            ++line;
        }
    }

    return line;
}

function firstNonPrologueStatement(body) {
    for (let i = 0; i < body.length; i++) {
        if (!t.isExpressionStatement(body[i])) {
            return body[i];
        }

        const expr = body[i].expression;
        const isStringLiteral = (t.isLiteral(expr) && typeof expr.value === "string");
        if (!isStringLiteral) {
            return body[i];
        }
    }
    return null;
}

function judgeInjectArraySuspect(path, ctx) {
    let node = path.node;

    if (t.isVariableDeclaration(node)) {
        // suspect can only be a VariableDeclaration (statement) in case of
        // explicitly marked via /*@ngInject*/, not via references because
        // references follow to VariableDeclarator (child)

        // /*@ngInject*/ var foo = function($scope) {} and

        if (node.declarations.length !== 1) {
            // more than one declarator => exit
            return;
        }

        // one declarator => jump over declaration into declarator
        // rest of code will treat it as any (referenced) declarator
        path = path.get("declarations")[0];
        node = path.node;
    }

    // onode is a top-level node (inside function block), later verified
    // node is inner match, descent in multiple steps
    let onode = null;
    let opath = null;
    let declaratorName = null;
    if (t.isVariableDeclarator(node)) {
        onode = path.parent;
        opath = path.parentPath;

        declaratorName = node.id.name;
        node = node.init; // var foo = ___;
        path = path.get("init");

    } else {
        onode = node;
        opath = path;
    }

    // suspect must be inside of a block or at the top-level (i.e. inside of node.$parent.body[])
    if (!node || !opath.parent || (!t.isProgram(opath.parent) && !t.isBlockStatement(opath.parent))) {
        return;
    }

    // node = jumpOverIife(node);

    if (ctx.isFunctionExpressionWithArgs(node)) {
        // var x = 1, y = function(a,b) {}, z;

        if(node.id && node.id.name !== declaratorName){
            console.warn("Declarator name different", declaratorName);
        }

        assert(declaratorName);
        addInjectArrayAfterPath(node.params, opath, declaratorName);

    } else if (ctx.isFunctionDeclarationWithArgs(node)) {
        // /*@ngInject*/ function foo($scope) {}
        addInjectArrayBeforePath(node.params,path,node.id.name);

    } else if (t.isExpressionStatement(node) && t.isAssignmentExpression(node.expression) &&
        ctx.isFunctionExpressionWithArgs(node.expression.right)) {
        // /*@ngInject*/ foo.bar[0] = function($scope) {}

        const name = ctx.srcForRange(node.expression.left.range);
        console.warn("Expression statement unimplemented");
        // addRemoveInjectArray(
        //     node.expression.right.params,
        //     isSemicolonTerminated ? insertPos : {
        //         pos: node.expression.right.range[1],
        //         loc: node.expression.right.loc.end
        //     },
        //     name);

    } else if (path = followReference(path)) {
        // node was a reference and followed node now is either a
        // FunctionDeclaration or a VariableDeclarator
        // => recurse

        judgeInjectArraySuspect(path, ctx);
    }


    function getIndent(pos) {
        const src = ctx.src;
        const lineStart = src.lastIndexOf("\n", pos - 1) + 1;
        let i = lineStart;
        for (; src[i] === " " || src[i] === "\t"; i++) {
        }
        return src.slice(lineStart, i);
    }

    function buildInjectExpression(params, name){
        let paramStrings = params.map(param => t.stringLiteral(param.name));
        let arr = t.arrayExpression(paramStrings); // ["$scope"]
        let member = t.memberExpression(t.identifier(name), t.identifier("$inject")); // foo.$inject =
        return t.expressionStatement(t.assignmentExpression("=", member , arr));
    }

    function addInjectArrayBeforePath(params, path, name){
        const binding = path.scope.getBinding(name);
        if(binding && binding.kind === 'hoisted'){
            let block = t.isProgram(binding.scope.block) ? binding.scope.block : binding.scope.block.body;
            block.body.unshift(buildInjectExpression(params, name));
        } else {
            path.insertBefore(buildInjectExpression(params, name));
        }
    }

    function addInjectArrayAfterPath(params, path, name){
        let trailingComments;
        if(path.node.trailingComments){
            trailingComments = path.node.trailingComments;
            path.node.trailingComments = [];
        }
        let newNode = path.insertAfter(buildInjectExpression(params, name));
        newNode.trailingComments = trailingComments;
    }

    function addRemoveInjectArray(params, posAfterFunctionDeclaration, name) {
        // if an existing something.$inject = [..] exists then is will always be recycled when rebuilding

        const indent = getIndent(posAfterFunctionDeclaration.pos);

        let foundSuspectInBody = false;
        let existingExpressionStatementWithArray = null;
        let nodeAfterExtends = null;
        onode.$parent.body.forEach(function(bnode, idx) {
            if (bnode === onode) {
                foundSuspectInBody = true;
            }

            if (hasInjectArray(bnode)) {
                if (existingExpressionStatementWithArray) {
                    throw fmt("conflicting inject arrays at line {0} and {1}",
                        posToLine(existingExpressionStatementWithArray.range[0], ctx.src),
                        posToLine(bnode.range[0], ctx.src));
                }
                existingExpressionStatementWithArray = bnode;
            }

            let e;
            if (!nodeAfterExtends && !foundSuspectInBody && t.isExpressionStatement(bnode) && t.isCallExpression(e = bnode.expression) && t.isIdentifier(e.callee) && e.callee.name === "__extends") {
                const nextStatement = onode.$parent.body[idx + 1];
                if (nextStatement) {
                    nodeAfterExtends = nextStatement;
                }
            }
        });
        assert(foundSuspectInBody);
        if (t.isFunctionDeclaration(onode)) {
            if (!nodeAfterExtends) {
                nodeAfterExtends = firstNonPrologueStatement(onode.$parent.body);
            }
            if (nodeAfterExtends && !existingExpressionStatementWithArray) {
                posAfterFunctionDeclaration = skipPrevNewline(nodeAfterExtends.range[0], nodeAfterExtends.loc.start);
            }
        }

        function hasInjectArray(node) {
            let lvalue;
            let assignment;
            return (node && t.isExpressionStatement(node) && t.isAssignmentExpression(assignment = node.expression) &&
                assignment.operator === "=" &&
                t.isMemberExpression(lvalue = assignment.left) &&
                ((lvalue.computed === false && ctx.srcForRange(lvalue.object.range) === name && lvalue.property.name === "$inject") ||
                    (lvalue.computed === true && ctx.srcForRange(lvalue.object.range) === name && t.isLiteral(lvalue.property) && lvalue.property.value === "$inject")));
        }

        function skipPrevNewline(pos, loc) {
            let prevLF = ctx.src.lastIndexOf("\n", pos);
            if (prevLF === -1) {
                return { pos: pos, loc: loc };
            }
            if (prevLF >= 1 && ctx.src[prevLF - 1] === "\r") {
                --prevLF;
            }

            if (/\S/g.test(ctx.src.slice(prevLF, pos - 1))) { // any non-whitespace chars between prev newline and pos?
                return { pos: pos, loc: loc };
            }

            return {
                pos: prevLF,
                loc: {
                    line: loc.line - 1,
                    column: prevLF - ctx.src.lastIndexOf("\n", prevLF) - 1,
                }
            };
        }

        if (ctx.mode === "rebuild" && existingExpressionStatementWithArray) {
            const strNoWhitespace = fmt("{2}.$inject = {3};", null, null, name, ctx.stringify(ctx, params, ctx.quot));
            ctx.fragments.push({
                start: existingExpressionStatementWithArray.range[0],
                end: existingExpressionStatementWithArray.range[1],
                str: strNoWhitespace,
                loc: {
                    start: existingExpressionStatementWithArray.loc.start,
                    end: existingExpressionStatementWithArray.loc.end
                }
            });
        } else if (ctx.mode === "remove" && existingExpressionStatementWithArray) {
            const start = skipPrevNewline(existingExpressionStatementWithArray.range[0], existingExpressionStatementWithArray.loc.start);
            ctx.fragments.push({
                start: start.pos,
                end: existingExpressionStatementWithArray.range[1],
                str: "",
                loc: {
                    start: start.loc,
                    end: existingExpressionStatementWithArray.loc.end
                }
            });
        } else if (is.someof(ctx.mode, ["add", "rebuild"]) && !existingExpressionStatementWithArray) {
            const str = fmt("{0}{1}{2}.$inject = {3};", EOL, indent, name, ctx.stringify(ctx, params, ctx.quot));
            ctx.fragments.push({
                start: posAfterFunctionDeclaration.pos,
                end: posAfterFunctionDeclaration.pos,
                str: str,
                loc: {
                    start: posAfterFunctionDeclaration.loc,
                    end: posAfterFunctionDeclaration.loc
                }
            });
        }
    }
}

function jumpOverIife(path) {
    const node = path.node;
    if(!path.node){
        console.warn("Not a path");
    }

    if (!(t.isCallExpression(node) && t.isFunctionExpression(node.callee))) {
        return path;
    }

    const outerbody = path.get("callee.body.body");
    for (let i = 0; i < outerbody.length; i++) {
        const statement = outerbody[i];
        if (t.isReturnStatement(statement)) {
            return statement.get("argument");
        }
    }

    return path;
}

function addModuleContextDependentSuspect(target, ctx) {
    ctx.suspects.push(target);
}

function addModuleContextIndependentSuspect(target, ctx) {
    target.node.$chained = chainedRegular;
    ctx.suspects.push(target);
}

function isAnnotatedArray(node) {
    if (!t.isArrayExpression(node)) {
        return false;
    }
    const elements = node.elements;

    // last should be a function expression
    if (elements.length === 0 || !t.isFunctionExpression(last(elements))) {
        return false;
    }

    // all but last should be string literals
    for (let i = 0; i < elements.length - 1; i++) {
        const n = elements[i];
        if (!t.isLiteral(n) || !is.string(n.value)) {
            return false;
        }
    }

    return true;
}
function isFunctionExpressionWithArgs(node) {
    return t.isFunctionExpression(node) && node.params.length >= 1;
}
function isFunctionDeclarationWithArgs(node) {
    return t.isFunctionDeclaration(node) && node.params.length >= 1;
}
function isGenericProviderName(node) {
    return t.isLiteral(node) && is.string(node.value);
}

function uniqifyFragments(fragments) {
    // must do in-place modification of ctx.fragments because shared reference

    const map = Object.create(null);
    for (let i = 0; i < fragments.length; i++) {
        const frag = fragments[i];
        const str = JSON.stringify({start: frag.start, end: frag.end, str: frag.str});
        if (map[str]) {
            fragments.splice(i, 1); // remove
            i--;
        } else {
            map[str] = true;
        }
    }
}

const allOptionals = {
    "angular-dashboard-framework": optionalAngularDashboardFramework,
};

module.exports = function ngAnnotate(src, options) {
    if (options.list) {
        return {
            list: Object.keys(allOptionals).sort(),
        };
    }

    const mode = (options.add && options.remove ? "rebuild" :
        options.remove ? "remove" :
            options.add ? "add" : null);

    if (!mode) {
        return {src: src};
    }

    const quot = options.single_quotes ? "'" : '"';
    const re = (options.regexp ? new RegExp(options.regexp) : /^[a-zA-Z0-9_\$\.\s]+$/);
    const rename = new stringmap();
    if (options.rename) {
        options.rename.forEach(function(value) {
            rename.set(value.from, value.to);
        });
    }
    let ast;
    const stats = {};

    // detect newline and override os.EOL
    const lf = src.lastIndexOf("\n");
    if (lf >= 1) {
        EOL = (src[lf - 1] === "\r" ? "\r\n" : "\n");
    }

    // [{type: "Block"|"Line", value: str, range: [from,to]}, ..]
    let comments = [];

    try {
        stats.parser_require_t0 = require_acorn_t0;
        stats.parser_require_t1 = require_acorn_t1;
        stats.parser_parse_t0 = Date.now();
        // acorn
        ast = parser(src, {
            ecmaVersion: 6,
            allowReserved: true,
            locations: true,
            ranges: true,
            onComment: comments,
        });
        stats.parser_parse_t1 = Date.now();
    } catch(e) {
        return {
            errors: ["error: couldn't process source due to parse error", e.message],
        };
    }

    // append a dummy-node to ast so that lut.findNodeFromPos(lastPos) returns something
    ast.body.push({
        type: "DebuggerStatement",
        range: [ast.range[1], ast.range[1]],
        loc: {
            start: ast.loc.end,
            end: ast.loc.end
        }
    });

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

    const lut = new Lut(ast, src);

    scopeTools.setupScopeAndReferences(ast);

    const ctx = {
        mode: mode,
        quot: quot,
        src: src,
        srcForRange: function(range) {
            return src.slice(range[0], range[1]);
        },
        re: re,
        rename: rename,
        comments: comments,
        fragments: fragments,
        suspects: suspects,
        blocked: blocked,
        lut: lut,
        isFunctionExpressionWithArgs: isFunctionExpressionWithArgs,
        isFunctionDeclarationWithArgs: isFunctionDeclarationWithArgs,
        isAnnotatedArray: isAnnotatedArray,
        addModuleContextDependentSuspect: addModuleContextDependentSuspect,
        addModuleContextIndependentSuspect: addModuleContextIndependentSuspect,
        stringify: stringify,
        nodePositions: nodePositions,
        matchResolve: matchResolve,
        matchProp: matchProp,
        last: last,
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

    traverse(ast, {pre: function(node) {
        ngInject.inspectNode(node, ctx);

    }, post: function(node) {
        ctx.nodePositions.push(node.loc.start);
        let targets = match(node, ctx, matchPluginsOrNull);
        if (!targets) {
            return;
        }
        if (!is.array(targets)) {
            targets = [targets];
        }

        for (let i = 0; i < targets.length; i++) {
            addModuleContextDependentSuspect(targets[i], ctx);
        }
    }});

    try {
        judgeSuspects(ctx);
    } catch(e) {
        return {
            errors: ["error: " + e],
        };
    }

    uniqifyFragments(ctx.fragments);

    const out = alter(src, fragments);
    const result = {
        src: out,
        _stats: stats,
    };

    if (options.map) {
        if (typeof(options.map) !== 'object')
            options.map = {};
        stats.sourcemap_t0 = Date.now();
        generateSourcemap(result, src, nodePositions, fragments, options.map);
        stats.sourcemap_t1 = Date.now();
    }

    return result;
}

module.exports.match = match;
module.exports.isFunctionExpressionWithArgs = isFunctionExpressionWithArgs;
module.exports.isFunctionDeclarationWithArgs = isFunctionDeclarationWithArgs;
module.exports.isGenericProviderName = isGenericProviderName;
module.exports.isAnnotatedArray = isAnnotatedArray;
module.exports.addModuleContextDependentSuspect = addModuleContextDependentSuspect;
module.exports.addModuleContextIndependentSuspect = addModuleContextIndependentSuspect;
module.exports.stringify = stringify;
module.exports.matchResolve = matchResolve;
module.exports.matchProp = matchProp;
module.exports.last = last;
module.exports.allOptionals = allOptionals;
module.exports.judgeSuspects = judgeSuspects;
module.exports.matchDirectiveReturnObject = matchDirectiveReturnObject;
module.exports.matchProviderGet = matchProviderGet;
