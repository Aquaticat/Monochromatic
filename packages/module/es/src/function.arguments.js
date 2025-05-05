"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spreadArguments = spreadArguments;
exports.gatherArguments = gatherArguments;
function spreadArguments(fn) {
    return function spreadFn(argumentsArray) {
        return fn.apply(void 0, argumentsArray);
    };
}
function gatherArguments(fn) {
    return function gatheredFn() {
        var argumentsArray = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            argumentsArray[_i] = arguments[_i];
        }
        return fn(argumentsArray);
    };
}
