"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertThrowAsync = assertThrowAsync;
exports.assertThrow = assertThrow;
exports.assertThrowErrorAsync = assertThrowErrorAsync;
exports.assertThrowTypeErrorAsync = assertThrowTypeErrorAsync;
exports.assertThrowRangeErrorAsync = assertThrowRangeErrorAsync;
exports.assertThrowReferenceErrorAsync = assertThrowReferenceErrorAsync;
exports.assertThrowURIErrorAsync = assertThrowURIErrorAsync;
exports.assertThrowError = assertThrowError;
exports.assertThrowTypeError = assertThrowTypeError;
exports.assertThrowRangeError = assertThrowRangeError;
exports.assertThrowReferenceError = assertThrowReferenceError;
exports.assertThrowURIError = assertThrowURIError;
var ts_1 = require("@monochromatic-dev/module-es/ts");
var l = (0, ts_1.logtapeGetLogger)(['m', 'error.assert.throw']);
/* @__NO_SIDE_EFFECTS__ */ function assertThrowAsync(error, fn) {
    return __awaiter(this, void 0, void 0, function () {
        var actualError_1, equalErrorOrThrow;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fn()];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    actualError_1 = _a.sent();
                    l.debug(templateObject_1 || (templateObject_1 = __makeTemplateObject(["assertThrowAsync(error: ", ", fn: ", "), actualError: ", ""], ["assertThrowAsync(error: ", ", fn: ", "), actualError: "
                        // TODO: Raise issue on logtape for better stringify of fn and error
                        , ""])), error, String(fn), 
                    // TODO: Raise issue on logtape for better stringify of fn and error
                    String(actualError_1));
                    if (typeof error === 'function') {
                        if (!(actualError_1 instanceof error)) {
                            throw new Error("actualError ".concat(actualError_1, " does not match error: ").concat(error));
                        }
                        return [2 /*return*/];
                    }
                    equalErrorOrThrow = (0, ts_1.equalsOrThrow)(error);
                    if (error instanceof Error) {
                        equalErrorOrThrow(actualError_1);
                        return [2 /*return*/];
                    }
                    if (typeof error !== 'string') {
                        throw new Error("unexpected type ".concat(typeof error, " of expected error: ").concat(error));
                    }
                    // Accept any instance of Error
                    if (error === 'Error') {
                        if (!(actualError_1 instanceof Error)) {
                            throw new Error("actualError ".concat(actualError_1, " is not an Error"));
                        }
                        return [2 /*return*/];
                    }
                    if (error.endsWith('Error')) {
                        // MAYBE: Error.name isn't working? Find all the other instances I used that
                        //        and replace it with Object.prototype.toString.call as usual
                        equalErrorOrThrow(actualError_1 === null || actualError_1 === void 0 ? void 0 : actualError_1.name);
                        return [2 /*return*/];
                    }
                    equalErrorOrThrow(actualError_1.message);
                    return [2 /*return*/];
                case 3: throw new Error("fn ".concat(fn, " unexpectedly didn't throw"));
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertThrow(error, fn) {
    try {
        fn();
    }
    catch (actualError) {
        l.debug(templateObject_2 || (templateObject_2 = __makeTemplateObject(["assertThrow(error: ", ", fn: ", "), actualError: ", ""], ["assertThrow(error: ", ", fn: ", "), actualError: ", ""])), error, String(fn), String(actualError));
        if (typeof error === 'function') {
            if (!(actualError instanceof error)) {
                throw new Error("actualError ".concat(actualError, " does not match error: ").concat(error));
            }
            return;
        }
        var equalErrorOrThrow = (0, ts_1.equalsOrThrow)(error);
        if (error instanceof Error) {
            equalErrorOrThrow(actualError);
            return;
        }
        if (typeof error !== 'string') {
            throw new Error("unexpected type ".concat(typeof error, " of expected error: ").concat(error));
        }
        // Accept any instance of Error
        if (error === 'Error') {
            if (!(actualError instanceof Error)) {
                throw new Error("actualError ".concat(actualError, " is not an Error"));
            }
            return;
        }
        if (error.endsWith('Error')) {
            // MAYBE: Error.name isn't working? Find all the other instances I used that
            //        and replace it with Object.prototype.toString.call as usual
            equalErrorOrThrow(actualError === null || actualError === void 0 ? void 0 : actualError.name);
            return;
        }
        equalErrorOrThrow(actualError.message);
        return;
    }
    throw new Error("fn ".concat(fn, " unexpectedly didn't throw"));
}
/* @__NO_SIDE_EFFECTS__ */ function assertThrowErrorAsync(fn) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertThrowAsync('Error', fn)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertThrowTypeErrorAsync(fn) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertThrowAsync('TypeError', fn)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertThrowRangeErrorAsync(fn) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertThrowAsync('RangeError', fn)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertThrowReferenceErrorAsync(fn) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertThrowAsync('ReferenceError', fn)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertThrowURIErrorAsync(fn) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertThrowAsync('URIError', fn)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertThrowError(fn) {
    assertThrow('Error', fn);
}
/* @__NO_SIDE_EFFECTS__ */ function assertThrowTypeError(fn) {
    assertThrow('TypeError', fn);
}
/* @__NO_SIDE_EFFECTS__ */ function assertThrowRangeError(fn) {
    assertThrow('RangeError', fn);
}
/* @__NO_SIDE_EFFECTS__ */ function assertThrowReferenceError(fn) {
    assertThrow('ReferenceError', fn);
}
/* @__NO_SIDE_EFFECTS__ */ function assertThrowURIError(fn) {
    assertThrow('URIError', fn);
}
var templateObject_1, templateObject_2;
