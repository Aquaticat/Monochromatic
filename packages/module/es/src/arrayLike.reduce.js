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
exports.reduceArrayLikeAsync = reduceArrayLikeAsync;
exports.reduceArrayLike = reduceArrayLike;
var ts_1 = require("@monochromatic-dev/module-es/ts");
/* @__NO_SIDE_EFFECTS__ */ function reduceArrayLikeAsync(initialValue_1, reducer_1, arrayLike_1) {
    return __awaiter(this, arguments, void 0, function (initialValue, reducer, arrayLike, internalCurrentIndex) {
        var arrayLikeArray, _a;
        if (internalCurrentIndex === void 0) { internalCurrentIndex = 0; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, Array.fromAsync(arrayLike)];
                case 1:
                    arrayLikeArray = _b.sent();
                    // Unfortunately, directly calling reduce is incorrect because reducer might be async.
                    /*return arrayLikeArray.reduce(
                      reducer as any,
                      initialValue,
                    ) as T_accumulated;*/
                    if ((0, ts_1.isEmptyArray)(arrayLikeArray)) {
                        return [2 /*return*/, initialValue];
                    }
                    _a = reduceArrayLikeAsync;
                    return [4 /*yield*/, reducer(initialValue, // Built-in at doesn't know there's something at(0)
                        // even though I just checked for length and it's not empty?
                        arrayLikeArray[0], internalCurrentIndex, arrayLikeArray)];
                case 2: return [4 /*yield*/, _a.apply(void 0, [_b.sent(), reducer,
                        arrayLikeArray.slice(1),
                        internalCurrentIndex + 1])];
                case 3: 
                // FIXME: Would probably fill up the stack.
                return [2 /*return*/, _b.sent()];
            }
        });
    });
}
/* @__NO_SIDE_EFFECTS__ */ function reduceArrayLike(initialValue, reducer, arrayLike) {
    var arrayLikeArray = Array.from(arrayLike);
    return arrayLikeArray.reduce(reducer, initialValue);
}
