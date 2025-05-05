"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notNullishOrThrow = notNullishOrThrow;
exports.notUndefinedOrThrow = notUndefinedOrThrow;
exports.notNullOrThrow = notNullOrThrow;
exports.notFalsyOrThrow = notFalsyOrThrow;
exports.notFalseOrThrow = notFalseOrThrow;
/* @__NO_SIDE_EFFECTS__ */ function notNullishOrThrow(potentiallyNullish) {
    if (potentiallyNullish === null || potentiallyNullish === undefined) {
        throw new TypeError("".concat(potentiallyNullish, " is nullish"));
    }
    return potentiallyNullish;
}
/* @__NO_SIDE_EFFECTS__ */ function notUndefinedOrThrow(potentiallyUndefined) {
    if (potentiallyUndefined === undefined) {
        throw new TypeError("".concat(potentiallyUndefined, " is undefined"));
    }
    return potentiallyUndefined;
}
/* @__NO_SIDE_EFFECTS__ */ function notNullOrThrow(potentiallyNull) {
    if (potentiallyNull === null) {
        throw new TypeError("".concat(potentiallyNull, " is null"));
    }
    return potentiallyNull;
}
/* @__NO_SIDE_EFFECTS__ */ function notFalsyOrThrow(potentiallyFalsy) {
    if (!potentiallyFalsy) {
        throw new TypeError("".concat(potentiallyFalsy, " is null"));
    }
    return potentiallyFalsy;
}
/* @__NO_SIDE_EFFECTS__ */ function notFalseOrThrow(potentiallyFalse) {
    if (potentiallyFalse === false) {
        throw new TypeError("".concat(potentiallyFalse, " is false"));
    }
    return potentiallyFalse;
}
// TODO: Add notObjOrThrow and other type-narrowing and throwing functions.
