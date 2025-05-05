"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPromise = isPromise;
/* @__NO_SIDE_EFFECTS__ */ function isPromise(value) {
    return typeof (value === null || value === void 0 ? void 0 : value.then) === 'function';
}
