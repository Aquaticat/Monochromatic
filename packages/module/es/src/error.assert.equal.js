"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
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
exports.assertAsync = assertAsync;
exports.assertTrueAsync = assertTrueAsync;
exports.assertFalseAsync = assertFalseAsync;
exports.assertUndefinedAsync = assertUndefinedAsync;
exports.assertNullAsync = assertNullAsync;
exports.assertEmptyArrayAsync = assertEmptyArrayAsync;
exports.assertEmptyObjectAsync = assertEmptyObjectAsync;
exports.assert0Async = assert0Async;
exports.assert1Async = assert1Async;
exports.assertNanAsync = assertNanAsync;
exports.assertNegative1Async = assertNegative1Async;
exports.assert = assert;
exports.assertTrue = assertTrue;
exports.assertFalse = assertFalse;
exports.assertUndefined = assertUndefined;
exports.assertNull = assertNull;
exports.assertEmptyArray = assertEmptyArray;
exports.assertEmptyObject = assertEmptyObject;
exports.assert0 = assert0;
exports.assert1 = assert1;
exports.assertNan = assertNan;
exports.assertNegative1 = assertNegative1;
var ts_1 = require("@monochromatic-dev/module-es/ts");
// We need not be so pedantic as to postfix every assert with Equal when equal is implied.
/* @__NO_SIDE_EFFECTS__ */ function assertAsync(expected, actual) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, ts_1.equalsAsyncOrThrow)(expected)(actual)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertTrueAsync(actual) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = assertAsync;
                    _b = [true];
                    return [4 /*yield*/, actual];
                case 1: return [4 /*yield*/, _a.apply(void 0, _b.concat([_c.sent()]))];
                case 2:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertFalseAsync(actual) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _a = assertAsync;
                    _b = [false];
                    return [4 /*yield*/, actual];
                case 1: return [4 /*yield*/, _a.apply(void 0, _b.concat([_c.sent()]))];
                case 2:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertUndefinedAsync(actual) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertAsync(undefined, actual)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertNullAsync(actual) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertAsync(null, actual)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertEmptyArrayAsync(actual) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertAsync([], actual)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertEmptyObjectAsync(actual) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertAsync({}, actual)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assert0Async(actual) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertAsync(0, actual)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assert1Async(actual) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertAsync(1, actual)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertNanAsync(actual) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertAsync(Number.NaN, actual)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assertNegative1Async(actual) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, assertAsync(-1, actual)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function assert(expected, actual) {
    (0, ts_1.equalsOrThrow)(expected)(actual);
}
/* @__NO_SIDE_EFFECTS__ */ function assertTrue(actual) {
    assert(true, actual);
}
/* @__NO_SIDE_EFFECTS__ */ function assertFalse(actual) {
    assert(false, actual);
}
/* @__NO_SIDE_EFFECTS__ */ function assertUndefined(actual) {
    assert(undefined, actual);
}
/* @__NO_SIDE_EFFECTS__ */ function assertNull(actual) {
    assert(null, actual);
}
/* @__NO_SIDE_EFFECTS__ */ function assertEmptyArray(actual) {
    assert([], actual);
}
/* @__NO_SIDE_EFFECTS__ */ function assertEmptyObject(actual) {
    assert({}, actual);
}
/* @__NO_SIDE_EFFECTS__ */ function assert0(actual) {
    assert(0, actual);
}
/* @__NO_SIDE_EFFECTS__ */ function assert1(actual) {
    assert(1, actual);
}
/* @__NO_SIDE_EFFECTS__ */ function assertNan(actual) {
    assert(Number.NaN, actual);
}
/* @__NO_SIDE_EFFECTS__ */ function assertNegative1(actual) {
    assert(-1, actual);
}
/* @__NO_SIDE_EFFECTS__ */ __exportStar(require("./error.assert.equal.type.ts"), exports);
