"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAsyncFunction = isAsyncFunction;
exports.isSyncFunction = isSyncFunction;
// MAYBE: Doesn't correctly infer function type.
// Searching "typescript function is async predicate" yields nothing.
/* @__NO_SIDE_EFFECTS__ */ function isAsyncFunction(fn) {
    return fn.constructor.name === 'AsyncFunction';
}
/* @__NO_SIDE_EFFECTS__ */ function isSyncFunction(fn) {
    return fn.constructor.name === 'Function';
}
