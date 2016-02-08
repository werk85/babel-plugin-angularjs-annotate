// scopetools.js
// MIT licensed, see LICENSE file
// Copyright (c) 2013-2016 Olov Lassus <olov.lassus@gmail.com>

"use strict";

const assert = require("assert");
const traverse = require("ordered-ast-traverse");
const Scope = require("./scope");
const is = require("simple-is");
const t = require("babel-types");

module.exports = {
    setupScopeAndReferences: setupScopeAndReferences,
    isReference: isReference,
};

function setupScopeAndReferences(root) {
    traverse(root, {pre: createScopes});
    createTopScope(root.$scope);
}

function createScopes(node, parent) {
    node.$parent = parent;
    node.$scope = parent ? parent.$scope : null; // may be overridden

    if (isNonFunctionBlock(node, parent)) {
        // A block node is a scope unless parent is a function
        node.$scope = new Scope({
            kind: "block",
            node: node,
            parent: parent.$scope,
        });

    } else if (t.isVariableDeclaration(node)) {
        // Variable declarations names goes in current scope
        node.declarations.forEach(function(declarator) {
            const name = declarator.id.name;
            node.$scope.add(name, node.kind, declarator.id, declarator.range[1]);
        });

    } else if (isFunction(node)) {
        // Function is a scope, with params in it
        // There's no block-scope under it

        node.$scope = new Scope({
            kind: "hoist",
            node: node,
            parent: parent.$scope,
        });

        // function has a name
        if (node.id) {
            if (t.isFunctionDeclaration(node)) {
                // Function name goes in parent scope for declared functions
                parent.$scope.add(node.id.name, "fun", node.id, null);
            } else if (t.isFunctionExpression(node)) {
                // Function name goes in function's scope for named function expressions
                node.$scope.add(node.id.name, "fun", node.id, null);
            } else {
                assert(false);
            }
        }

        node.params.forEach(function(param) {
            node.$scope.add(param.name, "param", param, null);
        });

    } else if (isForWithConstLet(node) || isForInOfWithConstLet(node)) {
        // For(In/Of) loop with const|let declaration is a scope, with declaration in it
        // There may be a block-scope under it
        node.$scope = new Scope({
            kind: "block",
            node: node,
            parent: parent.$scope,
        });

    } else if (t.isCatchClause(node)) {
        const identifier = node.param;

        node.$scope = new Scope({
            kind: "catch-block",
            node: node,
            parent: parent.$scope,
        });
        node.$scope.add(identifier.name, "caught", identifier, null);

        // All hoist-scope keeps track of which variables that are propagated through,
        // i.e. an reference inside the scope points to a declaration outside the scope.
        // This is used to mark "taint" the name since adding a new variable in the scope,
        // with a propagated name, would change the meaning of the existing references.
        //
        // catch(e) is special because even though e is a variable in its own scope,
        // we want to make sure that catch(e){let e} is never transformed to
        // catch(e){var e} (but rather var e$0). For that reason we taint the use of e
        // in the closest hoist-scope, i.e. where var e$0 belongs.
        node.$scope.closestHoistScope().markPropagates(identifier.name);

    } else if (t.isProgram(node)) {
        // Top-level program is a scope
        // There's no block-scope under it
        node.$scope = new Scope({
            kind: "hoist",
            node: node,
            parent: null,
        });
    }
}

function createTopScope(programScope) {
    function inject(obj) {
        for (let name in obj) {
            const writeable = obj[name];
            const kind = (writeable ? "var" : "const");
            if (topScope.hasOwn(name)) {
                topScope.remove(name);
            }
            topScope.add(name, kind, {loc: {start: {line: -1}}}, -1);
        }
    }

    const topScope = new Scope({
        kind: "hoist",
        node: {},
        parent: null,
    });

    const complementary = {
        undefined: false,
        Infinity: false,
        console: false,
    };

    inject(complementary);
//    inject(jshint_vars.reservedVars);
//    inject(jshint_vars.ecmaIdentifiers);

    // link it in
    programScope.parent = topScope;
    topScope.children.push(programScope);

    return topScope;
}

function isConstLet(kind) {
    return kind === "const" || kind === "let";
}

function isNonFunctionBlock(node, parent) {
    return t.isBlockStatement(node) && !t.isFunctionDeclaration(parent) && !t.isFunctionExpression(parent);
}

function isForWithConstLet(node) {
    return t.isForStatement(node) && node.init && t.isVariableDeclaration(node.init) && isConstLet(node.init.kind);
}

function isForInOfWithConstLet(node) {
    return isForInOf(node) && t.isVariableDeclaration(node.left) && isConstLet(node.left.kind);
}

function isForInOf(node) {
    return t.isForInStatement(node) || t.isForOfStatement(node);
}

function isFunction(node) {
    return t.isFunctionDeclaration(node) || t.isFunctionExpression(node);
}

function isReference(path) {
    const node = path.node;
    const parent = path.parent;
    return node.$refToScope ||
        t.isIdentifier(node) &&
            !(t.isVariableDeclarator(parent) && parent.id === node) && // var|let|const $
            !(t.isMemberExpression(parent) && parent.computed === false && parent.property === node) && // obj.$
            !(t.isProperty(parent) && parent.key === node) && // {$: ...}
            !(t.isLabeledStatement(parent) && parent.label === node) && // $: ...
            !(t.isCatchClause(parent) && parent.param === node) && // catch($)
            !(isFunction(parent) && parent.id === node) && // function $(..
            !(isFunction(parent) && is.someof(node, parent.params)) && // function f($)..
            true;
}
