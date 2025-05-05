"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.throws = throws;
// eslint-disable prefer-type-error
var logtape_1 = require("@logtape/logtape");
var l = (0, logtape_1.getLogger)(['m', 'error.throws']);
/* @__NO_SIDE_EFFECTS__ */ function throws(error) {
    if (error instanceof Error) {
        throw error;
    }
    if (typeof error === 'string') {
        throw new Error(error);
    }
    if (!error.name) {
        if (!error.cause) {
            throw new Error(error.message);
        }
        throw new Error(error.message, { cause: error.cause });
    }
    // TODO: Write my own switch expression
    switch (error.name) {
        case 'Error': {
            if (!error.cause) {
                throw new Error(error.message);
            }
            throw new Error(error.message, { cause: error.cause });
        }
        case 'RangeError': {
            if (!error.cause) {
                throw new RangeError(error.message);
            }
            throw new RangeError(error.message, { cause: error.cause });
        }
        case 'ReferenceError': {
            if (!error.cause) {
                throw new ReferenceError(error.message);
            }
            throw new ReferenceError(error.message, { cause: error.cause });
        }
        case 'TypeError': {
            if (!error.cause) {
                throw new TypeError(error.message);
            }
            throw new TypeError(error.message, { cause: error.cause });
        }
        case 'URIError': {
            if (!error.cause) {
                throw new URIError(error.message);
            }
            throw new URIError(error.message, { cause: error.cause });
        }
        default: {
            l.warn(templateObject_1 || (templateObject_1 = __makeTemplateObject(["error.name ", " not one of:\n      throwableErrors = ['Error', 'RangeError', 'ReferenceError', 'TypeError', 'URIError']\n      This function doesn't handle custom error types.\n      Pass in a custom error to throw it."], ["error.name ", " not one of:\n      throwableErrors = ['Error', 'RangeError', 'ReferenceError', 'TypeError', 'URIError']\n      This function doesn't handle custom error types.\n      Pass in a custom error to throw it."])), error.name);
            if (!error.cause) {
                throw new Error("".concat(error.name, ": ").concat(error.message));
            }
            throw new Error("".concat(error.name, ": ").concat(error.message), { cause: error.cause });
        }
    }
}
var templateObject_1;
