"use strict";
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
exports.pipedAsync = pipedAsync;
exports.piped = piped;
exports.pipeAsync = pipeAsync;
exports.pipe = pipe;
var function_is_ts_1 = require("./function.is.ts");
/* @__NO_SIDE_EFFECTS__ */ function pipedAsync(input, fn1, fn2, fn3, fn4, fn5, fn6, fn7, fn8, fn9) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11;
        return __generator(this, function (_12) {
            switch (_12.label) {
                case 0:
                    if (!fn1) {
                        return [2 /*return*/, input];
                    }
                    if (!!fn2) return [3 /*break*/, 2];
                    return [4 /*yield*/, fn1(input)];
                case 1: return [2 /*return*/, _12.sent()];
                case 2:
                    if (!!fn3) return [3 /*break*/, 5];
                    _a = fn2;
                    return [4 /*yield*/, fn1(input)];
                case 3: return [4 /*yield*/, _a.apply(void 0, [_12.sent()])];
                case 4: return [2 /*return*/, _12.sent()];
                case 5:
                    if (!!fn4) return [3 /*break*/, 9];
                    _b = fn3;
                    _c = fn2;
                    return [4 /*yield*/, fn1(input)];
                case 6: return [4 /*yield*/, _c.apply(void 0, [_12.sent()])];
                case 7: return [4 /*yield*/, _b.apply(void 0, [_12.sent()])];
                case 8: return [2 /*return*/, _12.sent()];
                case 9:
                    if (!!fn5) return [3 /*break*/, 14];
                    _d = fn4;
                    _e = fn3;
                    _f = fn2;
                    return [4 /*yield*/, fn1(input)];
                case 10: return [4 /*yield*/, _f.apply(void 0, [_12.sent()])];
                case 11: return [4 /*yield*/, _e.apply(void 0, [_12.sent()])];
                case 12: return [4 /*yield*/, _d.apply(void 0, [_12.sent()])];
                case 13: return [2 /*return*/, _12.sent()];
                case 14:
                    if (!!fn6) return [3 /*break*/, 20];
                    _g = fn5;
                    _h = fn4;
                    _j = fn3;
                    _k = fn2;
                    return [4 /*yield*/, fn1(input)];
                case 15: return [4 /*yield*/, _k.apply(void 0, [_12.sent()])];
                case 16: return [4 /*yield*/, _j.apply(void 0, [_12.sent()])];
                case 17: return [4 /*yield*/, _h.apply(void 0, [_12.sent()])];
                case 18: return [4 /*yield*/, _g.apply(void 0, [_12.sent()])];
                case 19: return [2 /*return*/, _12.sent()];
                case 20:
                    if (!!fn7) return [3 /*break*/, 27];
                    _l = fn6;
                    _m = fn5;
                    _o = fn4;
                    _p = fn3;
                    _q = fn2;
                    return [4 /*yield*/, fn1(input)];
                case 21: return [4 /*yield*/, _q.apply(void 0, [_12.sent()])];
                case 22: return [4 /*yield*/, _p.apply(void 0, [_12.sent()])];
                case 23: return [4 /*yield*/, _o.apply(void 0, [_12.sent()])];
                case 24: return [4 /*yield*/, _m.apply(void 0, [_12.sent()])];
                case 25: return [4 /*yield*/, _l.apply(void 0, [_12.sent()])];
                case 26: return [2 /*return*/, _12.sent()];
                case 27:
                    if (!!fn8) return [3 /*break*/, 35];
                    _r = fn7;
                    _s = fn6;
                    _t = fn5;
                    _u = fn4;
                    _v = fn3;
                    _w = fn2;
                    return [4 /*yield*/, fn1(input)];
                case 28: return [4 /*yield*/, _w.apply(void 0, [_12.sent()])];
                case 29: return [4 /*yield*/, _v.apply(void 0, [_12.sent()])];
                case 30: return [4 /*yield*/, _u.apply(void 0, [_12.sent()])];
                case 31: return [4 /*yield*/, _t.apply(void 0, [_12.sent()])];
                case 32: return [4 /*yield*/, _s.apply(void 0, [_12.sent()])];
                case 33: return [4 /*yield*/, _r.apply(void 0, [_12.sent()])];
                case 34: return [2 /*return*/, _12.sent()];
                case 35:
                    if (!!fn9) return [3 /*break*/, 44];
                    _x = fn8;
                    _y = fn7;
                    _z = fn6;
                    _0 = fn5;
                    _1 = fn4;
                    _2 = fn3;
                    _3 = fn2;
                    return [4 /*yield*/, fn1(input)];
                case 36: return [4 /*yield*/, _3.apply(void 0, [_12.sent()])];
                case 37: return [4 /*yield*/, _2.apply(void 0, [_12.sent()])];
                case 38: return [4 /*yield*/, _1.apply(void 0, [_12.sent()])];
                case 39: return [4 /*yield*/, _0.apply(void 0, [_12.sent()])];
                case 40: return [4 /*yield*/, _z.apply(void 0, [_12.sent()])];
                case 41: return [4 /*yield*/, _y.apply(void 0, [_12.sent()])];
                case 42: return [4 /*yield*/, _x.apply(void 0, [_12.sent()])];
                case 43: return [2 /*return*/, _12.sent()];
                case 44:
                    _4 = fn9;
                    _5 = fn8;
                    _6 = fn7;
                    _7 = fn6;
                    _8 = fn5;
                    _9 = fn4;
                    _10 = fn3;
                    _11 = fn2;
                    return [4 /*yield*/, fn1(input)];
                case 45: return [4 /*yield*/, _11.apply(void 0, [_12.sent()])];
                case 46: return [4 /*yield*/, _10.apply(void 0, [_12.sent()])];
                case 47: return [4 /*yield*/, _9.apply(void 0, [_12.sent()])];
                case 48: return [4 /*yield*/, _8.apply(void 0, [_12.sent()])];
                case 49: return [4 /*yield*/, _7.apply(void 0, [_12.sent()])];
                case 50: return [4 /*yield*/, _6.apply(void 0, [_12.sent()])];
                case 51: return [4 /*yield*/, _5.apply(void 0, [_12.sent()])];
                case 52: return [4 /*yield*/, _4.apply(void 0, [_12.sent()])];
                case 53: return [2 /*return*/, _12.sent()];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function piped(input, fn1, fn2, fn3, fn4, fn5, fn6, fn7, fn8, fn9) {
    if (!fn1) {
        return input;
    }
    if (!fn2) {
        return fn1(input);
    }
    if (!fn3) {
        return fn2(fn1(input));
    }
    if (!fn4) {
        return fn3(fn2(fn1(input)));
    }
    if (!fn5) {
        return fn4(fn3(fn2(fn1(input))));
    }
    if (!fn6) {
        return fn5(fn4(fn3(fn2(fn1(input)))));
    }
    if (!fn7) {
        return fn6(fn5(fn4(fn3(fn2(fn1(input))))));
    }
    if (!fn8) {
        return fn7(fn6(fn5(fn4(fn3(fn2(fn1(input)))))));
    }
    if (!fn9) {
        return fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(input))))))));
    }
    return fn9(fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(input)))))))));
}
/* @__NO_SIDE_EFFECTS__ */ function pipeAsync(fn0, fn1, fn2, fn3, fn4, fn5, fn6, fn7, fn8, fn9) {
    if (!fn1) {
        // FIXME: TypeScript native Array methods are losing type predicate!
        //        [fn0].every(isSyncFunction) doesn't preserve predicate.
        //        See https://github.com/microsoft/TypeScript/issues/26916
        //        Probably cannot fix it even if I write my own every
        // TODO: Replace with my own some/every anyway.
        return fn0;
    }
    if (!fn2) {
        if ((0, function_is_ts_1.isSyncFunction)(fn0) && (0, function_is_ts_1.isSyncFunction)(fn1)) {
            return function fn0to1() {
                var inputs = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    inputs[_i] = arguments[_i];
                }
                return fn1(fn0.apply(void 0, inputs));
            };
        }
        return function fn0to1() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return __awaiter(this, void 0, void 0, function () {
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _a = fn1;
                            return [4 /*yield*/, fn0.apply(void 0, inputs)];
                        case 1: return [4 /*yield*/, _a.apply(void 0, [_b.sent()])];
                        case 2: return [2 /*return*/, _b.sent()];
                    }
                });
            });
        };
    }
    if (!fn3) {
        if ((0, function_is_ts_1.isSyncFunction)(fn0) && (0, function_is_ts_1.isSyncFunction)(fn1) && (0, function_is_ts_1.isSyncFunction)(fn2)) {
            return function fn0to2() {
                var inputs = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    inputs[_i] = arguments[_i];
                }
                return fn2(fn1(fn0.apply(void 0, inputs)));
            };
        }
        return function fn0to2() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            _a = fn2;
                            _b = fn1;
                            return [4 /*yield*/, fn0.apply(void 0, inputs)];
                        case 1: return [4 /*yield*/, _b.apply(void 0, [_c.sent()])];
                        case 2: return [4 /*yield*/, _a.apply(void 0, [_c.sent()])];
                        case 3: return [2 /*return*/, _c.sent()];
                    }
                });
            });
        };
    }
    if (!fn4) {
        if ((0, function_is_ts_1.isSyncFunction)(fn0)
            && (0, function_is_ts_1.isSyncFunction)(fn1)
            && (0, function_is_ts_1.isSyncFunction)(fn2)
            && (0, function_is_ts_1.isSyncFunction)(fn3)) {
            return function fn0to3() {
                var inputs = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    inputs[_i] = arguments[_i];
                }
                return fn3(fn2(fn1(fn0.apply(void 0, inputs))));
            };
        }
        return function fn0to3() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            _a = fn3;
                            _b = fn2;
                            _c = fn1;
                            return [4 /*yield*/, fn0.apply(void 0, inputs)];
                        case 1: return [4 /*yield*/, _c.apply(void 0, [_d.sent()])];
                        case 2: return [4 /*yield*/, _b.apply(void 0, [_d.sent()])];
                        case 3: return [4 /*yield*/, _a.apply(void 0, [_d.sent()])];
                        case 4: return [2 /*return*/, _d.sent()];
                    }
                });
            });
        };
    }
    if (!fn5) {
        if ((0, function_is_ts_1.isSyncFunction)(fn0)
            && (0, function_is_ts_1.isSyncFunction)(fn1)
            && (0, function_is_ts_1.isSyncFunction)(fn2)
            && (0, function_is_ts_1.isSyncFunction)(fn3)
            && (0, function_is_ts_1.isSyncFunction)(fn4)) {
            return function fn0to4() {
                var inputs = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    inputs[_i] = arguments[_i];
                }
                return fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs)))));
            };
        }
        return function fn0to4() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            _a = fn4;
                            _b = fn3;
                            _c = fn2;
                            _d = fn1;
                            return [4 /*yield*/, fn0.apply(void 0, inputs)];
                        case 1: return [4 /*yield*/, _d.apply(void 0, [_e.sent()])];
                        case 2: return [4 /*yield*/, _c.apply(void 0, [_e.sent()])];
                        case 3: return [4 /*yield*/, _b.apply(void 0, [_e.sent()])];
                        case 4: return [4 /*yield*/, _a.apply(void 0, [_e.sent()])];
                        case 5: return [2 /*return*/, _e.sent()];
                    }
                });
            });
        };
    }
    if (!fn6) {
        if ((0, function_is_ts_1.isSyncFunction)(fn0)
            && (0, function_is_ts_1.isSyncFunction)(fn1)
            && (0, function_is_ts_1.isSyncFunction)(fn2)
            && (0, function_is_ts_1.isSyncFunction)(fn3)
            && (0, function_is_ts_1.isSyncFunction)(fn4)
            && (0, function_is_ts_1.isSyncFunction)(fn5)) {
            return function fn0to5() {
                var inputs = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    inputs[_i] = arguments[_i];
                }
                return fn5(fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs))))));
            };
        }
        return function fn0to5() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b, _c, _d, _e;
                return __generator(this, function (_f) {
                    switch (_f.label) {
                        case 0:
                            _a = fn5;
                            _b = fn4;
                            _c = fn3;
                            _d = fn2;
                            _e = fn1;
                            return [4 /*yield*/, fn0.apply(void 0, inputs)];
                        case 1: return [4 /*yield*/, _e.apply(void 0, [_f.sent()])];
                        case 2: return [4 /*yield*/, _d.apply(void 0, [_f.sent()])];
                        case 3: return [4 /*yield*/, _c.apply(void 0, [_f.sent()])];
                        case 4: return [4 /*yield*/, _b.apply(void 0, [_f.sent()])];
                        case 5: return [4 /*yield*/, _a.apply(void 0, [_f.sent()])];
                        case 6: return [2 /*return*/, _f.sent()];
                    }
                });
            });
        };
    }
    if (!fn7) {
        if ((0, function_is_ts_1.isSyncFunction)(fn0)
            && (0, function_is_ts_1.isSyncFunction)(fn1)
            && (0, function_is_ts_1.isSyncFunction)(fn2)
            && (0, function_is_ts_1.isSyncFunction)(fn3)
            && (0, function_is_ts_1.isSyncFunction)(fn4)
            && (0, function_is_ts_1.isSyncFunction)(fn5)
            && (0, function_is_ts_1.isSyncFunction)(fn6)) {
            return function fn0to6() {
                var inputs = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    inputs[_i] = arguments[_i];
                }
                return fn6(fn5(fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs)))))));
            };
        }
        return function fn0to6() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b, _c, _d, _e, _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            _a = fn6;
                            _b = fn5;
                            _c = fn4;
                            _d = fn3;
                            _e = fn2;
                            _f = fn1;
                            return [4 /*yield*/, fn0.apply(void 0, inputs)];
                        case 1: return [4 /*yield*/, _f.apply(void 0, [_g.sent()])];
                        case 2: return [4 /*yield*/, _e.apply(void 0, [_g.sent()])];
                        case 3: return [4 /*yield*/, _d.apply(void 0, [_g.sent()])];
                        case 4: return [4 /*yield*/, _c.apply(void 0, [_g.sent()])];
                        case 5: return [4 /*yield*/, _b.apply(void 0, [_g.sent()])];
                        case 6: return [4 /*yield*/, _a.apply(void 0, [_g.sent()])];
                        case 7: return [2 /*return*/, _g.sent()];
                    }
                });
            });
        };
    }
    if (!fn8) {
        if ((0, function_is_ts_1.isSyncFunction)(fn0)
            && (0, function_is_ts_1.isSyncFunction)(fn1)
            && (0, function_is_ts_1.isSyncFunction)(fn2)
            && (0, function_is_ts_1.isSyncFunction)(fn3)
            && (0, function_is_ts_1.isSyncFunction)(fn4)
            && (0, function_is_ts_1.isSyncFunction)(fn5)
            && (0, function_is_ts_1.isSyncFunction)(fn6)
            && (0, function_is_ts_1.isSyncFunction)(fn7)) {
            return function fn0to7() {
                var inputs = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    inputs[_i] = arguments[_i];
                }
                return fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs))))))));
            };
        }
        return function fn0to7() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b, _c, _d, _e, _f, _g;
                return __generator(this, function (_h) {
                    switch (_h.label) {
                        case 0:
                            _a = fn7;
                            _b = fn6;
                            _c = fn5;
                            _d = fn4;
                            _e = fn3;
                            _f = fn2;
                            _g = fn1;
                            return [4 /*yield*/, fn0.apply(void 0, inputs)];
                        case 1: return [4 /*yield*/, _g.apply(void 0, [_h.sent()])];
                        case 2: return [4 /*yield*/, _f.apply(void 0, [_h.sent()])];
                        case 3: return [4 /*yield*/, _e.apply(void 0, [_h.sent()])];
                        case 4: return [4 /*yield*/, _d.apply(void 0, [_h.sent()])];
                        case 5: return [4 /*yield*/, _c.apply(void 0, [_h.sent()])];
                        case 6: return [4 /*yield*/, _b.apply(void 0, [_h.sent()])];
                        case 7: return [4 /*yield*/, _a.apply(void 0, [_h.sent()])];
                        case 8: return [2 /*return*/, _h.sent()];
                    }
                });
            });
        };
    }
    if (!fn9) {
        if ((0, function_is_ts_1.isSyncFunction)(fn0)
            && (0, function_is_ts_1.isSyncFunction)(fn1)
            && (0, function_is_ts_1.isSyncFunction)(fn2)
            && (0, function_is_ts_1.isSyncFunction)(fn3)
            && (0, function_is_ts_1.isSyncFunction)(fn4)
            && (0, function_is_ts_1.isSyncFunction)(fn5)
            && (0, function_is_ts_1.isSyncFunction)(fn6)
            && (0, function_is_ts_1.isSyncFunction)(fn7)
            && (0, function_is_ts_1.isSyncFunction)(fn8)) {
            return function fn0to8() {
                var inputs = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    inputs[_i] = arguments[_i];
                }
                return fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs)))))))));
            };
        }
        return function fn0to8() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                return __generator(this, function (_j) {
                    switch (_j.label) {
                        case 0:
                            _a = fn8;
                            _b = fn7;
                            _c = fn6;
                            _d = fn5;
                            _e = fn4;
                            _f = fn3;
                            _g = fn2;
                            _h = fn1;
                            return [4 /*yield*/, fn0.apply(void 0, inputs)];
                        case 1: return [4 /*yield*/, _h.apply(void 0, [_j.sent()])];
                        case 2: return [4 /*yield*/, _g.apply(void 0, [_j.sent()])];
                        case 3: return [4 /*yield*/, _f.apply(void 0, [_j.sent()])];
                        case 4: return [4 /*yield*/, _e.apply(void 0, [_j.sent()])];
                        case 5: return [4 /*yield*/, _d.apply(void 0, [_j.sent()])];
                        case 6: return [4 /*yield*/, _c.apply(void 0, [_j.sent()])];
                        case 7: return [4 /*yield*/, _b.apply(void 0, [_j.sent()])];
                        case 8: return [4 /*yield*/, _a.apply(void 0, [_j.sent()])];
                        case 9: return [2 /*return*/, _j.sent()];
                    }
                });
            });
        };
    }
    if ((0, function_is_ts_1.isSyncFunction)(fn0)
        && (0, function_is_ts_1.isSyncFunction)(fn1)
        && (0, function_is_ts_1.isSyncFunction)(fn2)
        && (0, function_is_ts_1.isSyncFunction)(fn3)
        && (0, function_is_ts_1.isSyncFunction)(fn4)
        && (0, function_is_ts_1.isSyncFunction)(fn5)
        && (0, function_is_ts_1.isSyncFunction)(fn6)
        && (0, function_is_ts_1.isSyncFunction)(fn7)
        && (0, function_is_ts_1.isSyncFunction)(fn8)
        && (0, function_is_ts_1.isSyncFunction)(fn9)) {
        return function fn0to9() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return fn9(fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs))))))))));
        };
    }
    return function fn0to9() {
        var inputs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            inputs[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        _a = fn9;
                        _b = fn8;
                        _c = fn7;
                        _d = fn6;
                        _e = fn5;
                        _f = fn4;
                        _g = fn3;
                        _h = fn2;
                        _j = fn1;
                        return [4 /*yield*/, fn0.apply(void 0, inputs)];
                    case 1: return [4 /*yield*/, _j.apply(void 0, [_k.sent()])];
                    case 2: return [4 /*yield*/, _h.apply(void 0, [_k.sent()])];
                    case 3: return [4 /*yield*/, _g.apply(void 0, [_k.sent()])];
                    case 4: return [4 /*yield*/, _f.apply(void 0, [_k.sent()])];
                    case 5: return [4 /*yield*/, _e.apply(void 0, [_k.sent()])];
                    case 6: return [4 /*yield*/, _d.apply(void 0, [_k.sent()])];
                    case 7: return [4 /*yield*/, _c.apply(void 0, [_k.sent()])];
                    case 8: return [4 /*yield*/, _b.apply(void 0, [_k.sent()])];
                    case 9: return [4 /*yield*/, _a.apply(void 0, [_k.sent()])];
                    case 10: 
                    // Enjoy this callback hell!
                    return [2 /*return*/, _k.sent()];
                }
            });
        });
    };
}
var d = pipeAsync(function (input) {
    return input;
}, Boolean);
/* @__NO_SIDE_EFFECTS__ */ function pipe(fn0, fn1, fn2, fn3, fn4, fn5, fn6, fn7, fn8, fn9) {
    if (!fn1) {
        return function fn0to0() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return fn0.apply(void 0, inputs);
        };
    }
    if (!fn2) {
        return function fn0to1() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return fn1(fn0.apply(void 0, inputs));
        };
    }
    if (!fn3) {
        return function fn0to2() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return fn2(fn1(fn0.apply(void 0, inputs)));
        };
    }
    if (!fn4) {
        return function fn0to3() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return fn3(fn2(fn1(fn0.apply(void 0, inputs))));
        };
    }
    if (!fn5) {
        return function fn0to4() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs)))));
        };
    }
    if (!fn6) {
        return function fn0to5() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return fn5(fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs))))));
        };
    }
    if (!fn7) {
        return function fn0to6() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return fn6(fn5(fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs)))))));
        };
    }
    if (!fn8) {
        return function fn0to7() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs))))))));
        };
    }
    if (!fn9) {
        return function fn0to8() {
            var inputs = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                inputs[_i] = arguments[_i];
            }
            return fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs)))))))));
        };
    }
    return function fn0to9() {
        var inputs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            inputs[_i] = arguments[_i];
        }
        return fn9(fn8(fn7(fn6(fn5(fn4(fn3(fn2(fn1(fn0.apply(void 0, inputs))))))))));
    };
}
