"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isString = isString;
exports.isObjectRegexp = isObjectRegexp;
exports.isShortLangString = isShortLangString;
exports.isLongLangString = isLongLangString;
exports.isLangString = isLangString;
exports.isDigitString = isDigitString;
exports.isNo0DigitString = isNo0DigitString;
exports.isDigitsString = isDigitsString;
exports.isPositiveIntString = isPositiveIntString;
exports.isNegativeIntString = isNegativeIntString;
exports.isPositiveFloatString = isPositiveFloatString;
exports.isNegativeFloatString = isNegativeFloatString;
exports.isIntString = isIntString;
exports.isFloatString = isFloatString;
exports.isPositiveNumberString = isPositiveNumberString;
exports.isNegativeNumberString = isNegativeNumberString;
exports.isNumberString = isNumberString;
/* @__NO_SIDE_EFFECTS__ */ function isString(value) {
    return typeof value === 'string';
}
/* @__NO_SIDE_EFFECTS__ */ function isObjectRegexp(value) {
    return Object.prototype.toString.call(value) === '[object RegExp]';
}
/* @__NO_SIDE_EFFECTS__ */ function isShortLangString(value) {
    return isString(value) && value.length === 2 && /^[a-z]+$/.test(value);
}
/* @__NO_SIDE_EFFECTS__ */ function isLongLangString(value) {
    return isString(value) && value.length === 5 && /^[a-z]{2}-[A-Z]{2}$/.test(value);
}
/* @__NO_SIDE_EFFECTS__ */ function isLangString(value) {
    return isShortLangString(value) || isLongLangString(value);
}
function isDigitString(value) {
    return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(value);
}
function isNo0DigitString(value) {
    return ['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(value);
}
function isDigitsString(value) {
    return isString(value) && value.length > 0 && __spreadArray([], value, true).every(isDigitString);
}
function isPositiveIntString(value) {
    if (isDigitString(value)) {
        return true;
    }
    if (!isString(value)) {
        return false;
    }
    if (isDigitString(value)) {
        return true;
    }
    if (value.length <= 1) {
        return false;
    }
    if (!isNo0DigitString(value[0])) {
        return false;
    }
    return isDigitsString(value.slice(1));
}
function isNegativeIntString(value) {
    if (!isString(value)) {
        return false;
    }
    if (value.length <= 1) {
        return false;
    }
    if (value[0] !== '-') {
        return false;
    }
    return isPositiveIntString(value.slice(1));
}
function isPositiveFloatString(value) {
    if (!isString(value)) {
        return false;
    }
    if (value.length <= 2) {
        return false;
    }
    var dotIndex = value.indexOf('.');
    if (dotIndex === -1) {
        return false;
    }
    var intPart = value.slice(0, dotIndex);
    if (!isPositiveIntString(intPart)) {
        return false;
    }
    var floatPart = value.slice(dotIndex + 1);
    if (__spreadArray([], floatPart, true).every(function is0(floatPartDigit) {
        return floatPartDigit === '0';
    })) {
        return false;
    }
    return isDigitsString(floatPart);
}
function isNegativeFloatString(value) {
    if (!isString(value)) {
        return false;
    }
    if (value.length <= 1) {
        return false;
    }
    if (value[0] !== '-') {
        return false;
    }
    return isPositiveFloatString(value.slice(1));
}
function isIntString(value) {
    return isPositiveIntString(value) || isNegativeIntString(value);
}
function isFloatString(value) {
    return isPositiveFloatString(value) || isNegativeFloatString(value);
}
function isPositiveNumberString(value) {
    return isPositiveIntString(value) || isPositiveFloatString(value);
}
function isNegativeNumberString(value) {
    return isNegativeIntString(value) || isNegativeFloatString(value);
}
function isNumberString(value) {
    return isPositiveNumberString(value) || isNegativeNumberString(value);
}
