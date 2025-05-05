"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unary = unary;
exports.binary = binary;
exports.ternary = ternary;
/* @__NO_SIDE_EFFECTS__ */ function unary(fn) {
    return function unaryfied(param1) {
        return fn(param1);
    };
}
/* @__NO_SIDE_EFFECTS__ */ function binary(fn) {
    return function binaryfied(param1, param2) {
        return fn(param1, param2);
    };
}
/* @__NO_SIDE_EFFECTS__ */ function ternary(fn) {
    return function binaryfied(param1, param2, param3) {
        return fn(param1, param2, param3);
    };
}
