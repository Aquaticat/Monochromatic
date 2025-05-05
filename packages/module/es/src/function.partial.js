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
exports.partial = partial;
/* @__NO_SIDE_EFFECTS__ */ function partial(fn, presetInput0, presetInput1, presetInput2, presetInput3, presetInput4, presetInput5, presetInput6, presetInput7, presetInput8, presetInput9) {
    if (!presetInput1) {
        return function partiallyApplied() {
            var laterInputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                laterInputs[_i] = arguments[_i];
            }
            return fn.apply(void 0, __spreadArray([presetInput0], laterInputs, false));
        };
    }
    if (!presetInput2) {
        return function partiallyApplied() {
            var laterInputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                laterInputs[_i] = arguments[_i];
            }
            return fn.apply(void 0, __spreadArray([presetInput0, presetInput1], laterInputs, false));
        };
    }
    if (!presetInput3) {
        return function partiallyApplied() {
            var laterInputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                laterInputs[_i] = arguments[_i];
            }
            return fn.apply(void 0, __spreadArray([presetInput0, presetInput1, presetInput2], laterInputs, false));
        };
    }
    if (!presetInput4) {
        return function partiallyApplied() {
            var laterInputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                laterInputs[_i] = arguments[_i];
            }
            return fn.apply(void 0, __spreadArray([presetInput0,
                presetInput1,
                presetInput2,
                presetInput3], laterInputs, false));
        };
    }
    if (!presetInput5) {
        return function partiallyApplied() {
            var laterInputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                laterInputs[_i] = arguments[_i];
            }
            return fn.apply(void 0, __spreadArray([presetInput0,
                presetInput1,
                presetInput2,
                presetInput3,
                presetInput4], laterInputs, false));
        };
    }
    if (!presetInput6) {
        return function partiallyApplied() {
            var laterInputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                laterInputs[_i] = arguments[_i];
            }
            return fn.apply(void 0, __spreadArray([presetInput0,
                presetInput1,
                presetInput2,
                presetInput3,
                presetInput4,
                presetInput5], laterInputs, false));
        };
    }
    if (!presetInput7) {
        return function partiallyApplied() {
            var laterInputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                laterInputs[_i] = arguments[_i];
            }
            return fn.apply(void 0, __spreadArray([presetInput0,
                presetInput1,
                presetInput2,
                presetInput3,
                presetInput4,
                presetInput5,
                presetInput6], laterInputs, false));
        };
    }
    if (!presetInput8) {
        return function partiallyApplied() {
            var laterInputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                laterInputs[_i] = arguments[_i];
            }
            return fn.apply(void 0, __spreadArray([presetInput0,
                presetInput1,
                presetInput2,
                presetInput3,
                presetInput4,
                presetInput5,
                presetInput6,
                presetInput7], laterInputs, false));
        };
    }
    if (!presetInput9) {
        return function partiallyApplied() {
            var laterInputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                laterInputs[_i] = arguments[_i];
            }
            return fn.apply(void 0, __spreadArray([presetInput0,
                presetInput1,
                presetInput2,
                presetInput3,
                presetInput4,
                presetInput5,
                presetInput6,
                presetInput7,
                presetInput8], laterInputs, false));
        };
    }
    return function partiallyApplied() {
        var laterInputs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            laterInputs[_i] = arguments[_i];
        }
        return fn.apply(void 0, __spreadArray([presetInput0,
            presetInput1,
            presetInput2,
            presetInput3,
            presetInput4,
            presetInput5,
            presetInput6,
            presetInput7,
            presetInput8,
            presetInput9], laterInputs, false));
    };
}
