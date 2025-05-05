"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
};
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
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunksArray = chunksArray;
exports.chunksArrayLike = chunksArrayLike;
exports.chunksArrayLikeAsync = chunksArrayLikeAsync;
var ts_1 = require("@monochromatic-dev/module-es/ts");
var l = (0, ts_1.logtapeGetLogger)(['m', 'arrayLike.chunks']);
// TODO: Remove T_element everywhere and switch to infer.
/** Split an array into chunks length of your choosing,
 generating them one by one.

 @param array - readonly array of at least 1 element

                readonly here means you can be assured
                the array won't be changed while inside this function.

 @param n - how many elements of the array to chunk out at a time

            Cannot be bigger than the length of the array itself.

 @returns `Generator<Tuple<T_array[number], T_n>>`

          where Tuple returns a new tuple
          type of length `n` filled with type of `array` elements
          while n \<= 10,
          a regular array of type of `array` elements otherwise.

 @throws RangeError:

         1.  `array` is empty
         2.  `n` is
             1.  float
             2.  negative
             3.  bigger than the length of the array itself.

 @remarks
 From {@link https://stackoverflow.com/a/55435856}
 by {@link https://stackoverflow.com/users/10328101/ikechukwu-eze}
 with CC BY-SA 4.0
*/
/* @__NO_SIDE_EFFECTS__ */ function chunksArray(array, n) {
    var i;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if ((0, ts_1.arrayIsEmpty)(array)) {
                    throw new RangeError("What's to be chunked cannot be empty");
                }
                // TODO: Implement throw when n is 0
                if (n > array.length) {
                    throw new RangeError("Initial chunk index is already out of range.");
                }
                i = 0;
                _a.label = 1;
            case 1:
                if (!(i < array.length)) return [3 /*break*/, 4];
                return [4 /*yield*/, array.slice(i, i + n)];
            case 2:
                _a.sent();
                _a.label = 3;
            case 3:
                i += n;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}
/* @__NO_SIDE_EFFECTS__ */ function chunksArrayLike(arrayLike, n) {
    var arrayLikeArray;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                l.debug(templateObject_1 || (templateObject_1 = __makeTemplateObject(["chunksArrayLike(arrayLike: ", ", n: ", ")"], ["chunksArrayLike(arrayLike: ", ", n: ", ")"])), arrayLike, n);
                if (typeof (arrayLike === null || arrayLike === void 0 ? void 0 : arrayLike.length) === 'number') {
                    if ((0, ts_1.isEmptyArray)(arrayLike)) {
                        throw new RangeError("What's to be chunked: ".concat(JSON.stringify(arrayLike), " cannot be empty"));
                    }
                    if (n > arrayLike.length) {
                        throw new RangeError("Initial chunk index: ".concat(n, " is already out of range: ").concat(arrayLike.length));
                    }
                    l.debug(templateObject_2 || (templateObject_2 = __makeTemplateObject(["arrayLike.length: ", ", n: ", ""], ["arrayLike.length: ", ", n: ", ""])), arrayLike.length, n);
                }
                arrayLikeArray = Array
                    .from(arrayLike);
                l.debug(templateObject_3 || (templateObject_3 = __makeTemplateObject(["arrayLikeArray: ", ""], ["arrayLikeArray: ", ""])), arrayLikeArray);
                if (n > arrayLikeArray.length) {
                    throw new RangeError("Initial chunk index: ".concat(n, " is already out of range: ").concat(arrayLikeArray.length));
                }
                if ((0, ts_1.arrayIsEmpty)(arrayLikeArray)) {
                    throw new RangeError("What's to be chunked: ".concat(JSON.stringify(arrayLikeArray), " cannot be empty"));
                }
                if (!(0, ts_1.arrayIsNonEmpty)(arrayLikeArray)) return [3 /*break*/, 2];
                return [5 /*yield**/, __values(chunksArray(arrayLikeArray, n))];
            case 1:
                _a.sent();
                return [2 /*return*/];
            case 2: throw new Error("impossible state. ".concat(arrayLikeArray, " is neither empty nor non-empty"));
        }
    });
}
/* @__NO_SIDE_EFFECTS__ */ function chunksArrayLikeAsync(arrayLike, n) {
    return __asyncGenerator(this, arguments, function chunksArrayLikeAsync_1() {
        var arrayLikeArray;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // TODO: Switch this to lazy.
                    l.debug(templateObject_4 || (templateObject_4 = __makeTemplateObject(["chunksArrayLikeAsync(arrayLike: ", ", n: ", ")"], ["chunksArrayLikeAsync(arrayLike: ", ", n: ", ")"])), arrayLike, n);
                    if (typeof (arrayLike === null || arrayLike === void 0 ? void 0 : arrayLike.length)
                        === 'number') {
                        if ((0, ts_1.isEmptyArray)(arrayLike)) {
                            throw new RangeError("What's to be chunked: ".concat(JSON.stringify(arrayLike), " cannot be empty"));
                        }
                        if (n > arrayLike.length) {
                            throw new RangeError("Initial chunk index: ".concat(n, " is already out of range: ").concat(arrayLike.length));
                        }
                        l.debug(templateObject_5 || (templateObject_5 = __makeTemplateObject(["arrayLike.length: ", ", n: ", ""], ["arrayLike.length: ", ", n: ", ""])), arrayLike.length, n);
                    }
                    return [4 /*yield*/, __await(Array.fromAsync(arrayLike))];
                case 1:
                    arrayLikeArray = _a.sent();
                    l.debug(templateObject_6 || (templateObject_6 = __makeTemplateObject(["arrayLikeArray: ", ""], ["arrayLikeArray: ", ""])), arrayLikeArray);
                    if (n > arrayLikeArray.length) {
                        throw new RangeError("Initial chunk index: ".concat(n, " is already out of range: ").concat(arrayLikeArray.length));
                    }
                    if ((0, ts_1.arrayIsEmpty)(arrayLikeArray)) {
                        throw new RangeError("What's to be chunked: ".concat(JSON.stringify(arrayLikeArray), " cannot be empty"));
                    }
                    if (!(0, ts_1.arrayIsNonEmpty)(arrayLikeArray)) return [3 /*break*/, 5];
                    return [5 /*yield**/, __values(__asyncDelegator(__asyncValues(chunksArray(arrayLikeArray, n))))];
                case 2: return [4 /*yield*/, __await.apply(void 0, [_a.sent()])];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, __await(void 0)];
                case 4: return [2 /*return*/, _a.sent()];
                case 5: throw new Error("impossible state. ".concat(arrayLikeArray, " is neither empty nor non-empty"));
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;
