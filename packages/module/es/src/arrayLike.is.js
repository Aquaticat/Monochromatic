"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isArray = void 0;
exports.isIterable = isIterable;
exports.isAsyncIterable = isAsyncIterable;
exports.isMaybeAsyncIterable = isMaybeAsyncIterable;
exports.isMap = isMap;
exports.isWeakMap = isWeakMap;
exports.isSet = isSet;
exports.isWeakSet = isWeakSet;
exports.isObject = isObject;
exports.isAsyncGenerator = isAsyncGenerator;
exports.isGenerator = isGenerator;
exports.isEmptyArray = isEmptyArray;
exports.arrayIsEmpty = arrayIsEmpty;
exports.isNonEmptyArray = isNonEmptyArray;
exports.arrayIsNonEmpty = arrayIsNonEmpty;
/* @__NO_SIDE_EFFECTS__ */ exports.isArray = Array.isArray;
/**
 Tests if something is an Iterable and not an AsyncIterable.
 @param value the thing you want to check
 @returns boolean
 */
/* @__NO_SIDE_EFFECTS__ */ function isIterable(value) {
    return typeof (value === null || value === void 0 ? void 0 : value[Symbol.iterator]) === 'function';
}
/* @__NO_SIDE_EFFECTS__ */ function isAsyncIterable(value) {
    return typeof (value === null || value === void 0 ? void 0 : value[Symbol.asyncIterator]) === 'function';
}
/* @__NO_SIDE_EFFECTS__ */ function isMaybeAsyncIterable(value) {
    return typeof (value === null || value === void 0 ? void 0 : value[Symbol.iterator]) === 'function'
        || typeof (value === null || value === void 0 ? void 0 : value[Symbol.asyncIterator]) === 'function';
}
// Special handling in includesArrayLike for performance.
// TODO: Test if this expectedly returns false instead of unexpectedly throwing an error
//       when encountering a primitive value.
/* @__NO_SIDE_EFFECTS__ */ function isMap(value) {
    return Object.prototype.toString.call(value) === '[object Map]';
}
/* @__NO_SIDE_EFFECTS__ */ function isWeakMap(value) {
    return Object.prototype.toString.call(value) === '[object WeakMap]';
}
// Special handling in includesArrayLike for performance.
/* @__NO_SIDE_EFFECTS__ */ function isSet(value) {
    return Object.prototype.toString.call(value) === '[object Set]';
}
/* @__NO_SIDE_EFFECTS__ */ function isWeakSet(value) {
    return Object.prototype.toString.call(value) === '[object WeakSet]';
}
/* @__NO_SIDE_EFFECTS__ */ function isObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}
/* @__NO_SIDE_EFFECTS__ */ function isAsyncGenerator(value) {
    return Object.prototype.toString.call(value) === '[object AsyncGenerator]';
}
/* @__NO_SIDE_EFFECTS__ */ /* @__NO_SIDE_EFFECTS__ */ function isGenerator(value) {
    return Object.prototype.toString.call(value) === '[object Generator]';
}
/* @__NO_SIDE_EFFECTS__ */ function isEmptyArray(value) {
    return (0, exports.isArray)(value) && value.length === 0;
}
/* @__NO_SIDE_EFFECTS__ */ function arrayIsEmpty(value) {
    return value.length === 0;
}
/* @__NO_SIDE_EFFECTS__ */ function isNonEmptyArray(value) {
    return (0, exports.isArray)(value) && value.length > 0;
}
/* @__NO_SIDE_EFFECTS__ */ function arrayIsNonEmpty(value) {
    return (0, exports.isArray)(value) && value.length > 0;
}
