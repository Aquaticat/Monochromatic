"use strict";
// eslint-disable prefer-await-to-callbacks
/** Very basic testing framework

 @remarks
 Not using something more sentible like Jest or Mocha because they inject their own global variables.
 Not using 'node:test' because that won't be compatible with bun or deno.
 We also won't need mocking.

 The intentional overuse of the `any` type here may or may not be fixed in the future,
 depending on how much impact it has. */
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
exports.suite = suite;
exports.test = test;
var logtape_1 = require("@logtape/logtape");
//endregion From https://www.totaltypescript.com/how-to-test-your-types
// MAYBE: Change this at to my at
// MAYBE: Change this to my path parser.
var testFileBasename = new URL(import.meta.url).pathname.split('/').at(-1);
var testedFileName = testFileBasename.endsWith('.test.js')
    ? testFileBasename.slice(0, -'.test.js'.length)
    : testFileBasename;
// t is short for test. m is short for module. Sorry, but terminal space is precious.
// TODO: if this doesn't work, try process.argv
var l = (0, logtape_1.getLogger)(['t', testedFileName]);
/* @__NO_SIDE_EFFECTS__ */ function suite(name, testOrSuites, options) {
    return __awaiter(this, void 0, void 0, function () {
        var result, errored;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // TODO: Also log parent suites' names.
                    l.debug(templateObject_1 || (templateObject_1 = __makeTemplateObject(["suite ", " started: ", " tests or suites"], ["suite ", " started: ", " tests or suites"])), name, testOrSuites.length);
                    return [4 /*yield*/, Promise.allSettled(testOrSuites)];
                case 1:
                    result = _a.sent();
                    if (options) {
                        if (Object.hasOwn(options, 'skip')) {
                            return [2 /*return*/, { name: name, skip: options.skip }];
                        }
                        if (Object.hasOwn(options, 'todo')) {
                            l.info(templateObject_2 || (templateObject_2 = __makeTemplateObject(["suite ", " finished: ", ""], ["suite ", " finished: ", ""])), name, JSON.stringify(result));
                            return [2 /*return*/, { name: name, todo: options.todo, result: result }];
                        }
                    }
                    errored = result.find(function (settledResult) { return settledResult.status === 'rejected'; });
                    if (errored) {
                        throw new Error("suite ".concat(name, " errored with result: ").concat(JSON.stringify(result, null, 2)), {
                            cause: errored.reason,
                        });
                    }
                    // Depromoted suite log level from info to debug when it finishs without error,
                    // for a less cluttered terminal.
                    l.debug(templateObject_3 || (templateObject_3 = __makeTemplateObject(["suite ", " finished: ", ""], ["suite ", " finished: ", ""])), name, JSON.stringify(result));
                    return [2 /*return*/, { name: name, result: result }];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function test(name, callback, options) {
    return __awaiter(this, void 0, void 0, function () {
        var timeLimit, took, _a, beforeExecutingTestingCallback, result, afterExecutingTestingCallback, tooLongPercentage, tooLongPercentage, e_1, result, tooLongPercentage, callbackError_1;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    timeLimit = 0;
                    took = 0;
                    if (!options) return [3 /*break*/, 8];
                    // TODO: Write a type assertion function for Object.hasOwn
                    if (Object.hasOwn(options, 'skip')) {
                        l.warn(templateObject_4 || (templateObject_4 = __makeTemplateObject(["", " skipped: ", ""], ["", " skipped: ", ""])), name, options.skip);
                        return [2 /*return*/, { name: name, skip: options.skip }];
                    }
                    if (!Object.hasOwn(options, 'timeLimit')) return [3 /*break*/, 4];
                    if (!(typeof options.timeLimit === 'number')) return [3 /*break*/, 1];
                    _a = options.timeLimit;
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, (function () { return __awaiter(_this, void 0, void 0, function () {
                        var beforeExecutingTimeLimitReferenceCallback, timeLimitFnError_1, afterExecutingTimeLimitReferenceCallback;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    beforeExecutingTimeLimitReferenceCallback = performance.now();
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, options.timeLimit()];
                                case 2:
                                    _a.sent();
                                    return [3 /*break*/, 4];
                                case 3:
                                    timeLimitFnError_1 = _a.sent();
                                    l.info(templateObject_5 || (templateObject_5 = __makeTemplateObject(["timeLimit fn threw ", "\n            If this is intentional, you can ignore this log.\n            The test will continue,\n            the time it takes would be compared to the time timeLimit fn executed until it errored."], ["timeLimit fn threw ", "\n            If this is intentional, you can ignore this log.\n            The test will continue,\n            the time it takes would be compared to the time timeLimit fn executed until it errored."])), timeLimitFnError_1);
                                    return [3 /*break*/, 4];
                                case 4:
                                    afterExecutingTimeLimitReferenceCallback = performance.now();
                                    return [2 /*return*/, afterExecutingTimeLimitReferenceCallback
                                            - beforeExecutingTimeLimitReferenceCallback];
                            }
                        });
                    }); })()];
                case 2:
                    _a = _b.sent();
                    _b.label = 3;
                case 3:
                    timeLimit = _a;
                    l.debug(templateObject_6 || (templateObject_6 = __makeTemplateObject(["", " timeLimit: ", "ms"], ["", " timeLimit: ", "ms"])), name, timeLimit);
                    _b.label = 4;
                case 4:
                    if (!Object.hasOwn(options, 'todo')) return [3 /*break*/, 8];
                    l.info(templateObject_7 || (templateObject_7 = __makeTemplateObject(["", " started: ", " with todo: ", ""], ["", " started: ", " with todo: ", ""])), name, callback, options.todo);
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 7, , 8]);
                    beforeExecutingTestingCallback = performance.now();
                    return [4 /*yield*/, callback()];
                case 6:
                    result = _b.sent();
                    afterExecutingTestingCallback = performance.now();
                    took = afterExecutingTestingCallback - beforeExecutingTestingCallback;
                    l.debug(templateObject_8 || (templateObject_8 = __makeTemplateObject(["", " took: ", "ms"], ["", " took: ", "ms"])), name, took);
                    if (result !== undefined && result !== null) {
                        if (took > timeLimit) {
                            tooLongPercentage = 100 * (took - timeLimit) / timeLimit;
                            l.error(templateObject_9 || (templateObject_9 = __makeTemplateObject(["", " with todo: ", " took: ", "ms, ", "ms longer than timeLimit: ", "ms, that's ", "% too long. finished: ", ""], ["", " with todo: ", " took: ", "ms, ", "ms longer than timeLimit: ", "ms, that's ", "% too long. finished: ", ""])), name, options.todo, took, took - timeLimit, timeLimit, tooLongPercentage, result);
                            return [2 /*return*/, {
                                    name: name,
                                    todo: options.todo,
                                    result: result,
                                    tooLongPercentage: tooLongPercentage,
                                }];
                        }
                        l.warn(templateObject_10 || (templateObject_10 = __makeTemplateObject(["", " with todo: ", " finished: ", ""], ["", " with todo: ", " finished: ", ""])), name, options.todo, result);
                        return [2 /*return*/, { name: name, todo: options.todo, result: result }];
                    }
                    if (took > timeLimit) {
                        tooLongPercentage = Math.round(100 * (took - timeLimit) / timeLimit);
                        l.error(templateObject_11 || (templateObject_11 = __makeTemplateObject(["", " with todo: ", " took: ", "ms, ", "ms longer than timeLimit: ", "ms, that's ", "% too long."], ["", " with todo: ", " took: ", "ms, ", "ms longer than timeLimit: ", "ms, that's ", "% too long."])), name, options.todo, Math.round(took), Math.round(took - timeLimit), timeLimit, tooLongPercentage);
                        return [2 /*return*/, { name: name, todo: options.todo, tooLongPercentage: tooLongPercentage }];
                    }
                    l.warn(templateObject_12 || (templateObject_12 = __makeTemplateObject(["", " with todo: ", " finished"], ["", " with todo: ", " finished"])), name, options.todo);
                    return [2 /*return*/, { name: name, todo: options.todo }];
                case 7:
                    e_1 = _b.sent();
                    l.error(templateObject_13 || (templateObject_13 = __makeTemplateObject(["", " with todo: ", " errored: ", ""], ["", " with todo: ", " errored: ", ""])), name, options.todo, e_1);
                    return [2 /*return*/, { name: name, todo: options.todo, result: e_1 }];
                case 8:
                    l.debug(templateObject_14 || (templateObject_14 = __makeTemplateObject(["", " started: ", ""], ["", " started: ", ""])), name, String(callback).slice(0, 64));
                    _b.label = 9;
                case 9:
                    _b.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, callback()];
                case 10:
                    result = _b.sent();
                    if (took > timeLimit) {
                        tooLongPercentage = Math.round(100 * (took - timeLimit) / timeLimit);
                        throw new RangeError("".concat(name, " took: ").concat(Math.round(took), "ms, ").concat(Math.round(took - timeLimit), "ms longer than timeLimit: ").concat(timeLimit, "ms, that's ").concat(tooLongPercentage, "% too long. finished: ").concat(result));
                    }
                    if (result !== undefined && result !== null) {
                        l.info(templateObject_15 || (templateObject_15 = __makeTemplateObject(["", " finished: ", ""], ["", " finished: ", ""])), name, result);
                        return [2 /*return*/, { name: name, result: result }];
                    }
                    // Depromoted single test log level from info to debug when it finishs without a result,
                    // for a less cluttered terminal.
                    l.debug(templateObject_16 || (templateObject_16 = __makeTemplateObject(["", " finished"], ["", " finished"])), name);
                    return [2 /*return*/, name];
                case 11:
                    callbackError_1 = _b.sent();
                    throw new Error("".concat(name, ": ").concat(String(callback), " errored"), { cause: callbackError_1 });
                case 12: return [2 /*return*/];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16;
