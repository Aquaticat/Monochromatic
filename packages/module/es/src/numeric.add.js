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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addNumbersAsync = addNumbersAsync;
exports.addNumbers = addNumbers;
exports.addBigintsAsync = addBigintsAsync;
exports.addBigints = addBigints;
exports.addNumericsAsync = addNumericsAsync;
exports.addNumerics = addNumerics;
/**
 Returns the total of an Iterable of numbers as a number, can be passed as a single argument or a argument list.

 @remarks
 From https://selfrefactor.github.io/rambdax
 We're not using Iterator helpers. See https://bugzilla.mozilla.org/show_bug.cgi?id=1568906
 */
/* @__NO_SIDE_EFFECTS__ */ function addNumbersAsync() {
    var numbers = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        numbers[_i] = arguments[_i];
    }
    return __awaiter(this, void 0, void 0, function () {
        var total, number, e_1_1;
        var _a, numbers_1, numbers_1_1;
        var _b, e_1, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    total = 0;
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 6, 7, 12]);
                    _a = true, numbers_1 = __asyncValues(numbers);
                    _e.label = 2;
                case 2: return [4 /*yield*/, numbers_1.next()];
                case 3:
                    if (!(numbers_1_1 = _e.sent(), _b = numbers_1_1.done, !_b)) return [3 /*break*/, 5];
                    _d = numbers_1_1.value;
                    _a = false;
                    number = _d;
                    total += number;
                    _e.label = 4;
                case 4:
                    _a = true;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 12];
                case 6:
                    e_1_1 = _e.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 12];
                case 7:
                    _e.trys.push([7, , 10, 11]);
                    if (!(!_a && !_b && (_c = numbers_1.return))) return [3 /*break*/, 9];
                    return [4 /*yield*/, _c.call(numbers_1)];
                case 8:
                    _e.sent();
                    _e.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 11: return [7 /*endfinally*/];
                case 12: return [2 /*return*/, total];
            }
        });
    });
}
/** {@inheritDoc addNumbersAsync} */
/* @__NO_SIDE_EFFECTS__ */ function addNumbers() {
    var numbers = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        numbers[_i] = arguments[_i];
    }
    var total = 0;
    for (var _a = 0, numbers_2 = numbers; _a < numbers_2.length; _a++) {
        var numberItem = numbers_2[_a];
        total += numberItem;
    }
    return total;
}
/**
 Returns the total of an Iterable of bigints as a bigint, can be passed as a single argument or a argument list.
 */
/* @__NO_SIDE_EFFECTS__ */ function addBigintsAsync() {
    var bigints = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        bigints[_i] = arguments[_i];
    }
    return __awaiter(this, void 0, void 0, function () {
        var total, bigintItem, e_2_1;
        var _a, bigints_1, bigints_1_1;
        var _b, e_2, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    total = 0n;
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 6, 7, 12]);
                    _a = true, bigints_1 = __asyncValues(bigints);
                    _e.label = 2;
                case 2: return [4 /*yield*/, bigints_1.next()];
                case 3:
                    if (!(bigints_1_1 = _e.sent(), _b = bigints_1_1.done, !_b)) return [3 /*break*/, 5];
                    _d = bigints_1_1.value;
                    _a = false;
                    bigintItem = _d;
                    total += bigintItem;
                    _e.label = 4;
                case 4:
                    _a = true;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 12];
                case 6:
                    e_2_1 = _e.sent();
                    e_2 = { error: e_2_1 };
                    return [3 /*break*/, 12];
                case 7:
                    _e.trys.push([7, , 10, 11]);
                    if (!(!_a && !_b && (_c = bigints_1.return))) return [3 /*break*/, 9];
                    return [4 /*yield*/, _c.call(bigints_1)];
                case 8:
                    _e.sent();
                    _e.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (e_2) throw e_2.error;
                    return [7 /*endfinally*/];
                case 11: return [7 /*endfinally*/];
                case 12: return [2 /*return*/, total];
            }
        });
    });
}
/** {@inheritDoc addBigintsAsync} */
/* @__NO_SIDE_EFFECTS__ */ function addBigints() {
    var numbers = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        numbers[_i] = arguments[_i];
    }
    var total = 0n;
    for (var _a = 0, numbers_3 = numbers; _a < numbers_3.length; _a++) {
        var bigintItem = numbers_3[_a];
        total += bigintItem;
    }
    return total;
}
/* @__NO_SIDE_EFFECTS__ */ function addNumericsAsync() {
    var numerics = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        numerics[_i] = arguments[_i];
    }
    return __awaiter(this, void 0, void 0, function () {
        var total, numericItem, e_3_1;
        var _a, numerics_1, numerics_1_1;
        var _b, e_3, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    total = 0;
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 6, 7, 12]);
                    _a = true, numerics_1 = __asyncValues(numerics);
                    _e.label = 2;
                case 2: return [4 /*yield*/, numerics_1.next()];
                case 3:
                    if (!(numerics_1_1 = _e.sent(), _b = numerics_1_1.done, !_b)) return [3 /*break*/, 5];
                    _d = numerics_1_1.value;
                    _a = false;
                    numericItem = _d;
                    if (typeof numericItem === 'bigint' && typeof total !== 'bigint') {
                        total = BigInt(total) + numericItem;
                        return [3 /*break*/, 4];
                    }
                    total += numericItem;
                    _e.label = 4;
                case 4:
                    _a = true;
                    return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 12];
                case 6:
                    e_3_1 = _e.sent();
                    e_3 = { error: e_3_1 };
                    return [3 /*break*/, 12];
                case 7:
                    _e.trys.push([7, , 10, 11]);
                    if (!(!_a && !_b && (_c = numerics_1.return))) return [3 /*break*/, 9];
                    return [4 /*yield*/, _c.call(numerics_1)];
                case 8:
                    _e.sent();
                    _e.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (e_3) throw e_3.error;
                    return [7 /*endfinally*/];
                case 11: return [7 /*endfinally*/];
                case 12: return [2 /*return*/, total];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function addNumerics() {
    var numerics = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        numerics[_i] = arguments[_i];
    }
    // Here is a rare case where dynamic typing saved us.
    var total = 0;
    for (var _a = 0, numerics_2 = numerics; _a < numerics_2.length; _a++) {
        var numericItem = numerics_2[_a];
        if (typeof numericItem === 'bigint' && typeof total !== 'bigint') {
            total = BigInt(total) + numericItem;
            continue;
        }
        total += numericItem;
    }
    return total;
}
