// nginject.js
// MIT licensed, see LICENSE file
// Copyright (c) 2013-2016 Olov Lassus <olov.lassus@gmail.com>

"use strict";

const is = require("simple-is");
const t = require('babel-types');

module.exports = {
    inspectComments: inspectComments,
    inspectComment: inspectComment,
    inspectCallExpression: inspectCallExpression,
    inspectFunction: inspectFunction,
    inspectObjectExpression: inspectObjectExpression,
    inspectAssignment: inspectAssignment,
    inspectDeclarator: inspectDeclarator
};

function inspectCallExpression(path, ctx) {
    const node = path.node;
    const name = node.callee.name;
    if(inspectComment(path, ctx)){
      return false;
    }
    if (t.isIdentifier(node.callee) && (name === "ngInject" || name === "ngNoInject") && node.arguments.length === 1) {
        const block = (name === "ngNoInject");
        addSuspect(path.get("arguments")[0], ctx, block);
    }
}

const ngAnnotatePrologueDirectives = ["ngInject", "ngNoInject"];

function inspectFunction(path, ctx) {
    const node = path.node;

    if(inspectComment(path, ctx)){
      return;
    }

    if(t.isVariableDeclarator(path.parent) && t.isVariableDeclaration(path.parentPath.parent)){
      var annotation = getAnnotation(path.parentPath.parent);
      if(annotation !== null){
        addSuspect(path.parentPath.parentPath, ctx, !annotation);
        return;
      }
    }

    const str = matchPrologueDirectives(ngAnnotatePrologueDirectives, node);
    if (!str) {
        return;
    }
    const block = (str === "ngNoInject");

    // now add the correct suspect

    // for function declarations, it is always the function declaration node itself
    if (t.isFunctionDeclaration(node)) {
        addSuspect(path, ctx, block);
        return;
    }

    // node is a function expression below

    // case 1: a function expression which is the rhs of a variable declarator, such as
    // var f1 = function(a) {
    //     "ngInject"
    // };
    // in this case we can mark the declarator, same as saying var /*@ngInject*/ f1 = function(a) ..
    // or /*@ngInject*/ var f1 = function(a) ..
    // f1.$inject = ["a"]; will be added (or rebuilt/removed)
    if (t.isVariableDeclarator(path.parent)) {
        addSuspect(path.parentPath, ctx, block);
        return;
    }

    // case 2: an anonymous function expression, such as
    // g(function(a) {
    //     "ngInject"
    // });
    //
    // the suspect is now its parent annotated array (if any), otherwise itself
    // there is a risk of false suspects here, in case the parent annotated array has nothing to do
    // with annotations. the risk should be very low and hopefully easy to workaround
    //
    // added/rebuilt/removed => g(["a", function(a) {
    //     "ngInject"
    // }]);
    const maybeArrayExpression = path.parent;
    if (ctx.isAnnotatedArray(maybeArrayExpression)) {
        addSuspect(path.parentPath, ctx, block);
    } else {
        addSuspect(path, ctx, block);
    }
}

function inspectComment(path, ctx) {
  const node = path.node;

  let annotation = getAnnotation(node);
  if(annotation !== null){
    addSuspect(path, ctx, !annotation);
    return true;
  }
}

function getAnnotation(node){
  if(!node.leadingComments){
    return null;
  }

  for(var i=0; i<node.leadingComments.length; i++){
    let value = node.leadingComments[i].value.trim();

    if(value === "@ngInject"){
      return true;
    } else if (value === "@noNgInject") {
      return false;
    }
  }

  return null;
}

function getAnnotations(nodes){
  for (var i = 0; i < nodes.length; i++){
    let annotation = getAnnotation(nodes[i]);
    if(annotation !== null){
      return annotation;
    }
  }
  return null;
}

function inspectObjectExpression(path, ctx) {
  const node = path.node;

  // to pick up annotations that should apply to all properties
  // ie. /*@ngAnnotate*/ {}
  var candidates = [node];

  if(t.isAssignmentExpression(path.parent)){
    candidates.unshift(path.parent);
    if(t.isExpressionStatement(path.parentPath.parent)){
      candidates.unshift(path.parentPath.parent);
    }
  }

  if(t.isVariableDeclarator(path.parent) && t.isVariableDeclaration(path.parentPath.parent)){
    candidates.unshift(path.parentPath.parent);
  }

  let annotateEverything = getAnnotations(candidates);
  if(annotateEverything !== null){
    addSuspect(path, ctx, !annotateEverything);
  }

  // path.get("properties").forEach(prop => {
  //   if(t.isObjectExpression(prop.node.value)){
  //     inspectObjectExpression(prop.get("value"), ctx);
  //     return;
  //   }

  //   let annotation = getAnnotation(prop.node);
  //   if(annotation !== null || annotateEverything !== null){
  //     let effectiveAnnotation = annotation === null ? annotateEverything : annotation;
  //     addSuspect(prop.get("value"), ctx, !effectiveAnnotation);
  //   }
  // });
}


function matchPrologueDirectives(prologueDirectives, node) {
    const body = node.body.body;

    let found = null;
    for (let i = 0; i < body.length; i++) {
        if (!t.isExpressionStatement(body[i])) {
            break;
        }

        const expr = body[i].expression;
        const isStringLiteral = (t.isLiteral(expr) && typeof expr.value === "string");
        if (!isStringLiteral) {
            break;
        }

        if (prologueDirectives.indexOf(expr.value) >= 0) {
            found = expr.value;
            break;
        }
    }

    return found;
}

function inspectComments(ctx) {
    const comments = ctx.comments;
    for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        const yesPos = comment.value.indexOf("@ngInject");
        const noPos = (yesPos === -1 ? comment.value.indexOf("@ngNoInject") : -1);
        if (yesPos === -1 && noPos === -1) {
            continue;
        }

        const target = ctx.lut.findNodeFromPos(comment.range[1]);
        if (!target) {
            continue;
        }

        addSuspect(target, ctx, noPos >= 0);
    }
}

function inspectAssignment(path, ctx){
  const node = path.node;
  if(!t.isFunctionExpression(node.right)){
    return;
  }

  var candidates = [path.node, node.right];
  if(t.isExpressionStatement(path.parent)){
    candidates.unshift(path.parent);
  }

  let annotation = getAnnotations(candidates);
  if(annotation !== null){
    addSuspect(path, ctx, !annotation);
  }
}

function inspectDeclarator(path, ctx){
  const node = path.node;
  if(!t.isFunctionExpression(node.init)){
    return;
  }

  var candidates = [node, node.init];
  if(t.isVariableDeclaration(path.parent)){
    path = path.parentPath;
  } else {
    debugger;
  }

  let annotation = getAnnotations(candidates);
  if(annotation !== null){
    addSuspect(path, ctx, !annotation);
  }
}

function isStringArray(node) {
    if (!t.isArrayExpression(node)) {
        return false;
    }
    return node.elements.length >= 1 && node.elements.every(function(n) {
        return t.isLiteral(n) && is.string(n.value);
    });
}

function findNextStatement(path) {
    const body = path.parentPath.get("body");
    for (let i = 0; i < body.length; i++) {
        if (body[i].path === path.node) {
            return body[i + 1] || null;
        }
    }
    return null;
}

function addSuspect(path, ctx, block) {
    const target = path.node;
    if (t.isExpressionStatement(target) && t.isAssignmentExpression(target.expression) && isStringArray(target.expression.right)) {
        // /*@ngInject*/
        // FooBar.$inject = ["$a", "$b"];
        // function FooBar($a, $b) {}
        const adjustedTarget = findNextStatement(path);
        if (adjustedTarget) {
            return addSuspect(adjustedTarget, ctx, block);
        }
    }

    if (t.isObjectExpression(path)) {
        // /*@ngInject*/ {f1: function(a), .., {f2: function(b)}}
        addObjectExpression(path, ctx);
    } else if (t.isAssignmentExpression(target) && t.isObjectExpression(target.right)) {
        // /*@ngInject*/ f(x.y = {f1: function(a), .., {f2: function(b)}})
        addObjectExpression(target.get("right"), ctx);
    } else if (t.isExpressionStatement(target) && t.isAssignmentExpression(target.expression) && t.isObjectExpression(target.expression.right)) {
        // /*@ngInject*/ x.y = {f1: function(a), .., {f2: function(b)}}
        addObjectExpression(target.get("expression.right"), ctx);
    } else if (t.isVariableDeclaration(target) && target.declarations.length === 1 && target.declarations[0].init && t.isObjectExpression(target.declarations[0].init)) {
        // /*@ngInject*/ var x = {f1: function(a), .., {f2: function(b)}}
        addObjectExpression(target.get("declarations")[0].get("init"), ctx);
    } else if (t.isProperty(target)) {
        // {/*@ngInject*/ justthisone: function(a), ..}
        let value = path.get("value");
        value.$limitToMethodName = "*never*";
        addOrBlock(value, ctx);
    } else {
        // /*@ngInject*/ function(a) {}
        path.$limitToMethodName = "*never*";
        addOrBlock(path, ctx);
    }


    function addObjectExpression(path, ctx) {
        nestedObjectValues(path).forEach(function(n) {
            n.$limitToMethodName = "*never*";
            addOrBlock(n, ctx);
        });
    }

    function addOrBlock(path, ctx) {
        if (block) {
            ctx.blocked.push(path);
        } else {
            ctx.addModuleContextIndependentSuspect(path, ctx)
        }
    }
}

function nestedObjectValues(path, res) {
    res = res || [];

    path.get("properties").forEach(function(prop) {
        const v = prop.get("value");
        if (t.isFunctionExpression(v) || t.isArrayExpression(v)) {
            res.push(v);
        } else if (t.isObjectExpression(v)) {
            nestedObjectValues(v, res);
        }
    });

    return res;
}
