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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.somePromises = somePromises;
var ts_1 = require("@monochromatic-dev/module-es/ts");
var l = (0, ts_1.logtapeGetLogger)(['m', 'promise.some']);
// TODO: Find out if the use of generics here forces promises to be of the same type while calling the function.
// TODO: Write the tests.
// TODO: Make callback be able to accept something returning boolean.
/**
 @remarks
 */
/* @__NO_SIDE_EFFECTS__ */ function somePromises(
// TODO: Change the type to not allow a Promise-accepting callback to be passed in.
//       The callback always operates on unwrapped values.
predicate, promises) {
    return __awaiter(this, void 0, void 0, function () {
        var promiseRaceResult, promiseRaceError_1, promise, callbackError_1, e_1_1;
        var _a, promises_1, promises_1_1;
        var _b, e_1, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!(0, ts_1.isArray)(promises)) return [3 /*break*/, 4];
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.any((0, ts_1.mapArrayLike)(function callbackThrowing(input) {
                            return __awaiter(this, void 0, void 0, function () {
                                var awaitedInput, callbackResult;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, input];
                                        case 1:
                                            awaitedInput = _a.sent();
                                            return [4 /*yield*/, predicate(awaitedInput)];
                                        case 2:
                                            callbackResult = _a.sent();
                                            if (!callbackResult) {
                                                throw new Error("callback ".concat(String(predicate), " evals to false for ").concat(awaitedInput));
                                            }
                                            return [2 /*return*/, callbackResult];
                                    }
                                });
                            });
                        }, promises))];
                case 2:
                    promiseRaceResult = _e.sent();
                    return [2 /*return*/, promiseRaceResult];
                case 3:
                    promiseRaceError_1 = _e.sent();
                    l.info(templateObject_1 || (templateObject_1 = __makeTemplateObject(["", ""], ["", ""])), promiseRaceError_1);
                    return [2 /*return*/, false];
                case 4:
                    _e.trys.push([4, 12, 13, 18]);
                    _a = true, promises_1 = __asyncValues(promises);
                    _e.label = 5;
                case 5: return [4 /*yield*/, promises_1.next()];
                case 6:
                    if (!(promises_1_1 = _e.sent(), _b = promises_1_1.done, !_b)) return [3 /*break*/, 11];
                    _d = promises_1_1.value;
                    _a = false;
                    promise = _d;
                    _e.label = 7;
                case 7:
                    _e.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, predicate(promise)];
                case 8:
                    _e.sent();
                    return [2 /*return*/, true];
                case 9:
                    callbackError_1 = _e.sent();
                    l.info(templateObject_2 || (templateObject_2 = __makeTemplateObject(["", ""], ["", ""])), callbackError_1);
                    return [3 /*break*/, 10];
                case 10:
                    _a = true;
                    return [3 /*break*/, 5];
                case 11: return [3 /*break*/, 18];
                case 12:
                    e_1_1 = _e.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 18];
                case 13:
                    _e.trys.push([13, , 16, 17]);
                    if (!(!_a && !_b && (_c = promises_1.return))) return [3 /*break*/, 15];
                    return [4 /*yield*/, _c.call(promises_1)];
                case 14:
                    _e.sent();
                    _e.label = 15;
                case 15: return [3 /*break*/, 17];
                case 16:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 17: return [7 /*endfinally*/];
                case 18: return [2 /*return*/, false];
            }
        });
    });
}
var templateObject_1, templateObject_2;
