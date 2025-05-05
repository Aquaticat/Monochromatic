"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isError = isError;
/* @__NO_SIDE_EFFECTS__ */ function isError(value) {
    // Contrary to expectations, all the subclasses of Error all also give [object Error]
    return Object.prototype.toString.call(value) === '[object Error]';
}
