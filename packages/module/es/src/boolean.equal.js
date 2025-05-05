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
exports.isPrimitive = isPrimitive;
exports.equal = equal;
exports.equalAsync = equalAsync;
var ts_1 = require("@monochromatic-dev/module-es/ts");
var l = (0, ts_1.logtapeGetLogger)(['m', 'boolean.equal']);
// TODO: Do not consider BigInt a primitive.
// Write three functions in total to better express the intended purpose.
/**
 Warning: BigInt is considered a primitive.

 @param value any value to check

 @returns if the value is primitive.
 We define primitive here in terms of what Object.is considers to be primitive:

 1.  undefined
 2.  null
 3.  true
 4.  false
 5.  string
 6.  bigint and BigInt
 7.  symbol
 8.  number
 9.  NaN
 */
/* @__NO_SIDE_EFFECTS__ */ function isPrimitive(value) {
    if (Object.is(value, undefined)) {
        return true;
    }
    if (Object.is(value, null)) {
        return true;
    }
    if (typeof value === 'boolean') {
        return true;
    }
    if ((0, ts_1.isString)(value)) {
        return true;
    }
    if (typeof value === 'bigint'
        || Object.prototype.toString.call(value) === '[object BigInt]') {
        return true;
    }
    if (typeof value === 'symbol') {
        return true;
    }
    // typeof Number.NaN is also number
    if (typeof value === 'number') {
        return true;
    }
    l.debug(templateObject_1 || (templateObject_1 = __makeTemplateObject(["value ", " is not a primitive"], ["value ", " is not a primitive"])), value);
    return false;
}
/* @__NO_SIDE_EFFECTS__ */ function equal(a, b) {
    // TODO: Check for object value equality, not strict equality.
    // MAYBE: Switch to @std/assert, and use error handling.
    //        It'd be ugly but at least I'd offload the burden.
    // logtape doesn't support serializing BigInt yet,
    // so we have to do it ourselves before reaching the point we can be sure none is BigInt.
    // TODO: Raise an issue to logtape or do a pr
    //
    /* FTL logtape·meta Failed to emit a log record to sink [Function: sink] {
    [length]: 1,
    [name]: 'sink',
    [Symbol(nodejs.dispose)]: [Function (anonymous)] { [length]: 0, [name]: '' }
    }: TypeError: Do not know how to serialize a BigInt
      at JSON.stringify (<anonymous>)
      at formatter (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/packages/module/util/dist/final/boolean.equal.test.js:2374:26)
      at sink (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/.yarn/cache/@jsr-logtape__logtape-npm-0.4.2-d81e45c652-a49422555c.zip/node_modules/@jsr/logtape__logtape/logtape/sink.js:91:42)
      at LoggerImpl.emit (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/.yarn/cache/@jsr-logtape__logtape-npm-0.4.2-d81e45c652-a49422555c.zip/node_modules/@jsr/logtape__logtape/logtape/logger.js:94:9)
      at LoggerImpl.logTemplate (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/.yarn/cache/@jsr-logtape__logtape-npm-0.4.2-d81e45c652-a49422555c.zip/node_modules/@jsr/logtape__logtape/logtape/logger.js:144:10)
      at LoggerImpl.debug (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/.yarn/cache/@jsr-logtape__logtape-npm-0.4.2-d81e45c652-a49422555c.zip/node_modules/@jsr/logtape__logtape/logtape/logger.js:158:12)
      at equal (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/packages/module/util/dist/final/boolean.equal.test.js:2032:10)
      at file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/packages/module/util/dist/final/boolean.equal.test.js:2513:14
      at test (file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/packages/module/util/dist/final/boolean.equal.test.js:2477:24)
      at file:///home/user/Text/Projects/Aquaticat/monochromatic2024MAR06/packages/module/util/dist/final/boolean.equal.test.js:2512:5 {
    [stack]: [Getter/Setter],
    [message]: 'Do not know how to serialize a BigInt'
    } */
    l.debug(templateObject_2 || (templateObject_2 = __makeTemplateObject(["a: ", ", b: ", ""], ["a: ", ", b: ", ""])), String(a), String(b));
    // Check for referencial equality and equality of primitive values.
    if (Object.is(a, b)) {
        return true;
    }
    l.debug(templateObject_3 || (templateObject_3 = __makeTemplateObject(["ref/primitive eq failed on a: ", ", b: ", ""], ["ref/primitive eq failed on a: ", ", b: ", ""])), String(a), String(b));
    // We failed the referencial equality check,
    // and if any of a and b is a primitive value,
    // we have determined they are in fact not equal.
    if (isPrimitive(a) || isPrimitive(b)) {
        l.debug(templateObject_4 || (templateObject_4 = __makeTemplateObject(["At least one of a: ", " and b: ", " is primitive"], ["At least one of a: ", " and b: ", " is primitive"])), String(a), String(b));
        return false;
    }
    l.debug(templateObject_5 || (templateObject_5 = __makeTemplateObject(["non-primitives a: ", ", b: ", ""], ["non-primitives a: ", ", b: ", ""])), a, b);
    // a and b are both non-primitive values. What now?
    // Let's narrow down the other cases one by one.
    // We cannot handle comparing Promises in this sync version isEqual.
    // Let's bail.
    if ((0, ts_1.isPromise)(a) || (0, ts_1.isPromise)(b)) {
        throw new TypeError("At least one of a: ".concat(a, " and b: ").concat(b, " is a thenable.\n      We cannot handle comparing them in a sync function.\n      Try equalAsync()"));
    }
    if (typeof a === 'function') {
        if (typeof b !== 'function') {
            l
                .info(templateObject_6 || (templateObject_6 = __makeTemplateObject(["Is it intentional trying to compare a function a: ", " to not function b: ", "?"], ["Is it intentional trying to compare a function a: ", " to not function b: ", "?"])), a, b);
            return false;
        }
        l
            .warn(templateObject_7 || (templateObject_7 = __makeTemplateObject(["cannot compare two functions accurately due to the inherent unpredictability of functions.\n    See https://stackoverflow.com/a/32061834 by https://stackoverflow.com/users/1742789/julian-de-bhal\n    The string representations of both functions are not normalized before comparison.\n    Nor were the functions converted to there AST form.\n    Therefore, this comparison has a high chance of giving a false negative or false positive.\n    "], ["cannot compare two functions accurately due to the inherent unpredictability of functions.\n    See https://stackoverflow.com/a/32061834 by https://stackoverflow.com/users/1742789/julian-de-bhal\n    The string representations of both functions are not normalized before comparison.\n    Nor were the functions converted to there AST form.\n    Therefore, this comparison has a high chance of giving a false negative or false positive.\n    "])));
        return "".concat(a) === "".concat(b);
    }
    if (Array.isArray(a)) {
        if (!Array.isArray(b)) {
            l.info(templateObject_8 || (templateObject_8 = __makeTemplateObject(["Is it intentional trying to compare an array a: ", " to not array b: ", "?"], ["Is it intentional trying to compare an array a: ", " to not array b: ", "?"])), a, b);
            return false;
        }
        l.debug(templateObject_9 || (templateObject_9 = __makeTemplateObject(["arrays a: ", " b: ", ""], ["arrays a: ", " b: ", ""])), a, b);
        if (a.length !== b.length) {
            return false;
        }
        if (a.length === 0) {
            return true;
        }
        // Now that we know a and b are arrays of the same length,
        // let's compare all the values within them.
        return a.every(function (aValue, aIndex) {
            // Have to do a recursion here because the two arrays might not just contain primitives.
            return equal(aValue, b[aIndex]);
        });
    }
    // Not providing a predicate for typeof a === 'object'
    // because it's rarely useful knowing something is an object,
    // but not what subtype of object it is.
    if (typeof a === 'object') {
        if (typeof b !== 'object') {
            l
                .warn(templateObject_10 || (templateObject_10 = __makeTemplateObject(["b is not a primitive, not a Promise, not a function, not an array, not an object.\n        What is b: ", "?"], ["b is not a primitive, not a Promise, not a function, not an array, not an object.\n        What is b: ", "?"])), b);
            return false;
        }
        l.debug(templateObject_11 || (templateObject_11 = __makeTemplateObject(["objects a: ", " b: ", ""], ["objects a: ", " b: ", ""])), a, b);
        var aPrototype = Object.prototype.toString.call(a);
        var bPrototype = Object.prototype.toString.call(b);
        // Test for gen ahead of iterable because gen may have more behaviors.
        if ((0, ts_1.isAsyncGenerator)(a)
            || (0, ts_1.isAsyncGenerator)(b)) {
            throw new TypeError("At least one of a: ".concat(a, " and b: ").concat(b, " is an AsyncGenerator.\n          We cannot handle comparing them in a sync function.\n          Try equalAsync()"));
        }
        if ((0, ts_1.isAsyncIterable)(a) || (0, ts_1.isAsyncIterable)(b)) {
            throw new TypeError("At least one of a: ".concat(a, " and b: ").concat(b, " is an AsyncIterable.\n      We cannot handle comparing them in a sync function.\n      Try equalAsync()"));
        }
        if ((0, ts_1.isObjectDate)(a)) {
            if (!(0, ts_1.isObjectDate)(b)) {
                l.info(templateObject_12 || (templateObject_12 = __makeTemplateObject(["Is it intentional trying to compare a Date a: ", " to not a Date b: ", "?"], ["Is it intentional trying to compare a Date a: ", " to not a Date b: ", "?"])), a, b);
                return false;
            }
            l.debug(templateObject_13 || (templateObject_13 = __makeTemplateObject(["dates a: ", " b: ", ""], ["dates a: ", " b: ", ""])), a, b);
            if (a.getTime() === b.getTime()) {
                return true;
            }
            return false;
        }
        if (aPrototype === '[object Boolean]') {
            l
                .warn(templateObject_14 || (templateObject_14 = __makeTemplateObject(["The use of Boolean() the object wrapper is greatly discouraged. Found a: ", ""], ["The use of Boolean() the object wrapper is greatly discouraged. Found a: ", ""])), a);
            if (bPrototype !== '[object Boolean]') {
                l
                    .info(templateObject_15 || (templateObject_15 = __makeTemplateObject(["Is it intentional trying to compare a Boolean wrapped a: ", " to not a Boolean wrapped b: ", "?"], ["Is it intentional trying to compare a Boolean wrapped a: ", " to not a Boolean wrapped b: ", "?"])), a, b);
                return false;
            }
            l.debug(templateObject_16 || (templateObject_16 = __makeTemplateObject(["Boolean wraps a: ", " b: ", ""], ["Boolean wraps a: ", " b: ", ""])), a, b);
            if (a.valueOf() === b.valueOf()) {
                return true;
            }
            return false;
        }
        if ((0, ts_1.isError)(a)) {
            if (!(0, ts_1.isError)(b)) {
                l.info(templateObject_17 || (templateObject_17 = __makeTemplateObject(["Is it intentional trying to compare a error a: ", " to not error b: ", "?"], ["Is it intentional trying to compare a error a: ", " to not error b: ", "?"])), a, b);
                return false;
            }
            l.debug(templateObject_18 || (templateObject_18 = __makeTemplateObject(["Errors a: ", " b: ", ""], ["Errors a: ", " b: ", ""])), a, b);
            if (a.message !== b.message) {
                return false;
            }
            if (a.name !== b.name) {
                l
                    .info(templateObject_19 || (templateObject_19 = __makeTemplateObject(["Is it intentional,\n          giving two errors of different classes a: ", " b: ", "\n          the same message: ", "?"], ["Is it intentional,\n          giving two errors of different classes a: ", " b: ", "\n          the same message: ", "?"])), a.name, b.name, a.message);
                return false;
            }
            if (equal(a === null || a === void 0 ? void 0 : a.cause, b === null || b === void 0 ? void 0 : b.cause)) {
                return true;
            }
            return false;
        }
        if ((0, ts_1.isGenerator)(a)) {
            if (!(0, ts_1.isGenerator)(b)) {
                l
                    .info(templateObject_20 || (templateObject_20 = __makeTemplateObject(["Is it intentional trying to compare a Generator a: ", " to not a Generator b: ", "?"], ["Is it intentional trying to compare a Generator a: ", " to not a Generator b: ", "?"])), a, b);
                return false;
            }
            l
                .info(templateObject_21 || (templateObject_21 = __makeTemplateObject(["comparing two Generators would only succeed\n        if both of them never takes any parameters."], ["comparing two Generators would only succeed\n        if both of them never takes any parameters."])));
            return equal(Array.from(a), Array.from(b));
        }
        if ((0, ts_1.isObjectRegexp)(a)) {
            if (!(0, ts_1.isObjectRegexp)(b)) {
                l
                    .info(templateObject_22 || (templateObject_22 = __makeTemplateObject(["Is it intentional trying to compare a regex a: ", " to not a regex b: ", "?"], ["Is it intentional trying to compare a regex a: ", " to not a regex b: ", "?"])), a, b);
                return false;
            }
            l.debug(templateObject_23 || (templateObject_23 = __makeTemplateObject(["regexps a: ", " b: ", ""], ["regexps a: ", " b: ", ""])), a, b);
            // TODO: Is this enough? I sure hope so.
            return "".concat(a) === "".concat(b);
        }
        // TODO: Turn those prototype comparisions into type predicates.
        if ((0, ts_1.isMap)(a)) {
            if (!(0, ts_1.isMap)(b)) {
                l.info(templateObject_24 || (templateObject_24 = __makeTemplateObject(["Is it intentional trying to compare a map a: ", " to not a map b: ", "?"], ["Is it intentional trying to compare a map a: ", " to not a map b: ", "?"])), a, b);
                return false;
            }
            l.debug(templateObject_25 || (templateObject_25 = __makeTemplateObject(["maps a: ", " b: ", ""], ["maps a: ", " b: ", ""])), a, b);
            if (a.size !== b.size) {
                return false;
            }
            if (a.size === 0) {
                return true;
            }
            return equal(Array.from(a), Array.from(b));
        }
        if ((0, ts_1.isSet)(a)) {
            if (!(0, ts_1.isSet)(b)) {
                l.info(templateObject_26 || (templateObject_26 = __makeTemplateObject(["Is it intentional trying to compare a set a: ", " to not a set b: ", "?"], ["Is it intentional trying to compare a set a: ", " to not a set b: ", "?"])), a, b);
                return false;
            }
            l.debug(templateObject_27 || (templateObject_27 = __makeTemplateObject(["sets a: ", " b: ", ""], ["sets a: ", " b: ", ""])), a, b);
            if (a.size !== b.size) {
                return false;
            }
            if (a.size === 0) {
                return true;
            }
            return equal(Array.from(a), Array.from(b));
        }
        if ((0, ts_1.isWeakMap)(a) || (0, ts_1.isWeakMap)(b)) {
            throw new TypeError("WeakMaps are not enumerable, therefore cannot be compared.");
        }
        if ((0, ts_1.isWeakSet)(a) || (0, ts_1.isWeakSet)(b)) {
            throw new TypeError("WeakSets are not enumerable, therefore cannot be compared.");
        }
        if ((0, ts_1.isObject)(a)) {
            l
                .info(templateObject_28 || (templateObject_28 = __makeTemplateObject(["Comparing two objects cannot rule out Proxy objects. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy#constructor"], ["Comparing two objects cannot rule out Proxy objects. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy#constructor"])));
            if (!(0, ts_1.isObject)(b)) {
                l
                    .info(templateObject_29 || (templateObject_29 = __makeTemplateObject(["Is it intentional trying to compare an object Object a: ", " to not an object Object b: ", "?"], ["Is it intentional trying to compare an object Object a: ", " to not an object Object b: ", "?"])), a, b);
                return false;
            }
            l.debug(templateObject_30 || (templateObject_30 = __makeTemplateObject(["Objects a: ", " b: ", ""], ["Objects a: ", " b: ", ""])), a, b);
            if (Object.keys(a).length !== Object.keys(b).length) {
                return false;
            }
            return Object.keys(a).every(function (aKey) { return equal(a[aKey], b[aKey]); });
        }
        throw new TypeError("The comparison of object types ".concat(aPrototype, " and ").concat(bPrototype, " have not been implemented."));
    }
    throw new TypeError("at least one of a and b are not primitives, not Promises, not functions, not arrays, not objects.\n  What are they?\n  a: ".concat(a, "\n  b: ").concat(b));
}
/**
 @remarks
 We only handle two additional cases than {@inheritDoc equal}:
 1.  Both a and b are Promises
 2.  Both a and b are AsyncGenerators | AsyncIterables
 */
/* @__NO_SIDE_EFFECTS__ */ function equalAsync(a, b) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, settledA, settledB, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    if (!((0, ts_1.isPromise)(a) || (0, ts_1.isPromise)(b))) return [3 /*break*/, 2];
                    l.debug(templateObject_31 || (templateObject_31 = __makeTemplateObject(["Promises a: ", " b: ", ""], ["Promises a: ", " b: ", ""])), a, b);
                    return [4 /*yield*/, Promise.allSettled([a, b])];
                case 1:
                    _a = _f.sent(), settledA = _a[0], settledB = _a[1];
                    l.debug(templateObject_32 || (templateObject_32 = __makeTemplateObject(["settled a: ", " b: ", ""], ["settled a: ", " b: ", ""])), settledA, settledB);
                    return [2 /*return*/, equal(settledA, settledB)];
                case 2:
                    if (!((0, ts_1.isAsyncGenerator)(a) && (0, ts_1.isAsyncGenerator)(b))) return [3 /*break*/, 5];
                    l.info(templateObject_33 || (templateObject_33 = __makeTemplateObject(["Comparing two Generators or AsyncGenerators can only succeed\n    if both of them never takes any parameters."], ["Comparing two Generators or AsyncGenerators can only succeed\n    if both of them never takes any parameters."])));
                    _b = equal;
                    return [4 /*yield*/, Array.fromAsync(a)];
                case 3:
                    _c = [_f.sent()];
                    return [4 /*yield*/, Array.fromAsync(b)];
                case 4: return [2 /*return*/, _b.apply(void 0, _c.concat([_f.sent()]))];
                case 5:
                    if (!((0, ts_1.isAsyncIterable)(a) && (0, ts_1.isAsyncIterable)(b))) return [3 /*break*/, 8];
                    _d = equal;
                    return [4 /*yield*/, Array.fromAsync(a)];
                case 6:
                    _e = [_f.sent()];
                    return [4 /*yield*/, Array.fromAsync(b)];
                case 7: return [2 /*return*/, _d.apply(void 0, _e.concat([_f.sent()]))];
                case 8: return [2 /*return*/, equal(a, b)];
            }
        });
    });
}
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26, templateObject_27, templateObject_28, templateObject_29, templateObject_30, templateObject_31, templateObject_32, templateObject_33;
// TODO: Write a better typeof leveraging Object.prototype.toString.call
