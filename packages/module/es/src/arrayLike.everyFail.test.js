"use strict";
// run with
// bun test ./packages/module/es/src/arrayLike.everyFail.bunTest.ts --timeout 50
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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts_1 = require("@monochromatic-dev/module-es/ts");
var bun_test_1 = require("bun:test");
var arrayLike_everyFail_ts_1 = require("./arrayLike.everyFail.ts");
await (0, ts_1.logtapeConfigure)(await (0, ts_1.logtapeConfiguration)());
(0, bun_test_1.describe)('everyFailArrayLike', function () {
    (0, bun_test_1.describe)('Array', function () {
        (0, bun_test_1.test)('empty', function () {
            // See https://stackoverflow.com/questions/34137250/why-does-array-prototype-every-return-true-on-an-empty-array
            // for why we're expecting truthiness when running every.
            (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLike)(Boolean, [])).toBe(true);
        });
        (0, bun_test_1.test)('one', function () {
            (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLike)(Boolean, [1])).toBe(false);
        });
        (0, bun_test_1.test)('two', function () {
            (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLike)(Boolean, [1, 2])).toBe(false);
        });
        (0, bun_test_1.test)('two[1] - false', function () {
            (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLike)(Boolean, [1, 0])).toBe(false);
        });
        (0, bun_test_1.test)('two[0] - false', function () {
            (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLike)(Boolean, [0, 1])).toBe(false);
        });
        // demo of how diff every... and noneFail... is
        // if (element === 999) {throw new RangeError(`999 is not allowed`)}
        // return false;
        // every would not throw an error and return false.
        // noneFail would throw an error for sure.
        (0, bun_test_1.test)('fail fast - testingFn throws on the last element - false', function () {
            (0, bun_test_1.expect)(function () {
                (0, arrayLike_everyFail_ts_1.everyFailArrayLike)(function (element) {
                    if (element === 999) {
                        throw new RangeError("999 is not allowed");
                    }
                    return false;
                }, ts_1.array0to999);
            })
                .toThrow('999 is not allowed');
        });
    });
    (0, bun_test_1.describe)('Iterable', function () {
        (0, bun_test_1.test)('empty', function () {
            (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLike)(Boolean, (function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/];
                });
            })()))
                .toBe(true);
        });
        (0, bun_test_1.test)('one', function () {
            (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLike)(Boolean, (function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, 1];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            })()))
                .toBe(false);
        });
        (0, bun_test_1.test)('two', function () {
            (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLike)(Boolean, (function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, 1];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, 2];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            })()))
                .toBe(false);
        });
        (0, bun_test_1.test)('two[1] - false', function () {
            (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLike)(Boolean, (function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, 1];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, 0];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            })()))
                .toBe(false);
        });
        (0, bun_test_1.test)('two[0] - false', function () {
            (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLike)(Boolean, (function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, 0];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, 1];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            })()))
                .toBe(false);
        });
        (0, bun_test_1.test)('fail fast - testingFn throws on the last element - false', function () {
            (0, bun_test_1.expect)(function () {
                (0, arrayLike_everyFail_ts_1.everyFailArrayLike)(function (element) {
                    if (element === 999) {
                        throw new RangeError("999 is not allowed");
                    }
                    return false;
                }, (0, ts_1.gen0to999)());
            })
                .toThrow('999 is not allowed');
        });
        (0, bun_test_1.test)('iterable throws - fail fast - false', function () {
            (0, bun_test_1.expect)(function () {
                (0, arrayLike_everyFail_ts_1.everyFailArrayLike)(function () { return false; }, (0, ts_1.gen0to999error)());
            })
                .toThrow();
        });
    });
});
(0, bun_test_1.describe)('everyFailArrayLikeAsync', function () {
    (0, bun_test_1.describe)('Array', function () {
        (0, bun_test_1.test)('empty', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    // See https://stackoverflow.com/questions/34137250/why-does-array-prototype-every-return-true-on-an-empty-array
                    // for why we're expecting truthiness when running every.
                    return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, [])).resolves.toBe(true)];
                    case 1:
                        // See https://stackoverflow.com/questions/34137250/why-does-array-prototype-every-return-true-on-an-empty-array
                        // for why we're expecting truthiness when running every.
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('one', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, [1])).resolves.toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('two', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, [1, 2])).resolves.toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('two[1] - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, [1, 0])).resolves.toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('two[0] - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, [0, 1])).resolves.toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        // demo of how diff every... and noneFail... is
        // if (element === 999) {throw new RangeError(`999 is not allowed`)}
        // return false;
        // every would not throw an error and return false.
        // noneFail would throw an error for sure.
        (0, bun_test_1.test)('fail fast - testingFn throws on the last element - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(function (element) {
                            if (element === 999) {
                                throw new RangeError("999 is not allowed");
                            }
                            return false;
                        }, ts_1.array0to999))
                            .rejects
                            .toThrowError('999 is not allowed')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        // MAYBE: Add timeLimit-ed tests.
        bun_test_1.test.todo('fail fast - testingFn takes too long on some elements - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(function (element) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!(element <= 100)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, (0, ts_1.wait)(1)];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/, false];
                                    case 2:
                                        if (element < 999) {
                                            return [2 /*return*/, true];
                                        }
                                        return [2 /*return*/, false];
                                }
                            });
                        }); }, ts_1.array0to999))
                            .resolves
                            .toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, bun_test_1.describe)('Iterable', function () {
        (0, bun_test_1.test)('empty', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, (function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/];
                            });
                        })()))
                            .resolves
                            .toBe(true)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('one', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, (function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, 1];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        })()))
                            .resolves
                            .toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('two', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, (function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, 1];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, 2];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        })()))
                            .resolves
                            .toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('two[1] - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, (function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, 1];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, 0];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        })()))
                            .resolves
                            .toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('two[0] - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, (function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, 0];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, 1];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        })()))
                            .resolves
                            .toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('fail fast - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(function (element) {
                            if (element === 999) {
                                throw new RangeError("999 is not allowed");
                            }
                            return false;
                        }, (0, ts_1.gen0to999)()))
                            .rejects
                            .toThrowError('999 is not allowed')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('iterable throws - fail fast - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(function () { return false; }, (0, ts_1.gen0to999error)()))
                            .rejects
                            .toThrowError()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, bun_test_1.describe)('AsyncIterable', function () {
        (0, bun_test_1.test)('empty', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, (function () {
                            return __asyncGenerator(this, arguments, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/];
                                });
                            });
                        })()))
                            .resolves
                            .toBe(true)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('one', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, (function () {
                            return __asyncGenerator(this, arguments, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await(1)];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        })()))
                            .resolves
                            .toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('two', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, (function () {
                            return __asyncGenerator(this, arguments, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await(1)];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(2)];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        })()))
                            .resolves
                            .toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('two[1] - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, (function () {
                            return __asyncGenerator(this, arguments, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await(1)];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(0)];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        })()))
                            .resolves
                            .toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('two[0] - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(Boolean, (function () {
                            return __asyncGenerator(this, arguments, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await(0)];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(1)];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        })()))
                            .resolves
                            .toBe(false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('fail fast - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(function (element) {
                            if (element === 999) {
                                throw new RangeError("999 is not allowed");
                            }
                            return false;
                        }, (0, ts_1.gen0to999Async)()))
                            .rejects
                            .toThrowError('999 is not allowed')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        (0, bun_test_1.test)('iterable throws - fail fast - false', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, arrayLike_everyFail_ts_1.everyFailArrayLikeAsync)(function () { return false; }, (0, ts_1.gen0to999errorAsync)()))
                            .rejects
                            .toThrowError()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
