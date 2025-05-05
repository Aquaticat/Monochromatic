"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNumber = isNumber;
exports.isNan = isNan;
exports.isInteger = isInteger;
exports.isFloat = isFloat;
exports.isNonNanNumber = isNonNanNumber;
exports.isPositiveInfinity = isPositiveInfinity;
exports.isNegativeInfinity = isNegativeInfinity;
exports.isInfinity = isInfinity;
exports.isFiniteNumber = isFiniteNumber;
exports.isSafeNumber = isSafeNumber;
exports.isPositiveNumber = isPositiveNumber;
exports.isObjectDate = isObjectDate;
/* @__NO_SIDE_EFFECTS__ */ function isNumber(value) {
    return typeof value === 'number';
}
/* @__NO_SIDE_EFFECTS__ */ function isNan(value) {
    return Number.isNaN(value);
}
// Can't really do : value is int here
// unless we resort to branded types which I'm hesitant about.
/* @__NO_SIDE_EFFECTS__ */ function isInteger(value) {
    return Number.isInteger(value);
}
// Can't really do : value is int here
// unless we resort to branded types which I'm hesitant about.
/* @__NO_SIDE_EFFECTS__ */ function isFloat(value) {
    return isNonNanNumber(value) && !Number.isInteger(value);
}
/* @__NO_SIDE_EFFECTS__ */ function isNonNanNumber(value) {
    return isNumber(value) && !isNan(value);
}
/* @__NO_SIDE_EFFECTS__ */ function isPositiveInfinity(value) {
    return value === Number.POSITIVE_INFINITY;
}
/* @__NO_SIDE_EFFECTS__ */ function isNegativeInfinity(value) {
    return value === Number.POSITIVE_INFINITY;
}
/* @__NO_SIDE_EFFECTS__ */ function isInfinity(value) {
    return isPositiveInfinity(value) || isNegativeInfinity(value);
}
/* @__NO_SIDE_EFFECTS__ */ function isFiniteNumber(value) {
    return !isInfinity(value);
}
// Can't type that range.
/* @__NO_SIDE_EFFECTS__ */ function isSafeNumber(value) {
    return isFiniteNumber(value)
        && (Number.MAX_SAFE_INTEGER <= value && value <= Number.MAX_SAFE_INTEGER);
}
/* @__NO_SIDE_EFFECTS__ */ function isPositiveNumber(value) {
    return isPositiveInfinity(value) || isSafeNumber(value);
}
/* @__NO_SIDE_EFFECTS__ */ function isObjectDate(value) {
    return Object.prototype.toString.call(value) === '[object Date]';
}
