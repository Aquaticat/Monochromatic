"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toExport = toExport;
var ts_1 = require("@monochromatic-dev/module-es/ts");
var unsupported = Object.freeze(['null', 'undefined', 'NaN', 'bigint', 'symbol']);
var primitive = Object.freeze(['boolean', 'string', 'number', 'date']);
function toExport(obj) {
    var objType = (0, ts_1.typeOf)(obj);
    if (unsupported.includes(objType))
        throw new TypeError("Unsupported obj ".concat(obj, " ").concat(JSON.stringify(obj), " type ").concat(objType));
    if (primitive.includes(objType)) {
        switch (objType) {
            case 'boolean': {
                return String(obj);
            }
            case 'number': {
                return String(obj);
            }
            case 'string': {
                return "".concat(JSON.stringify(obj));
            }
            case 'date': {
                return "new Date(".concat(JSON.stringify(obj), ")");
            }
            default: {
                throw new TypeError('Impossible!');
            }
        }
    }
    switch (objType) {
        case 'set': {
            return "Object.freeze(new Set([".concat(
            // @ts-expect-error TypeScript limitations
            Array.from(obj).map(function (_a) {
                var k = _a[0], v = _a[1];
                return "[".concat(toExport(k), ", ").concat(toExport(v), "]");
            }), "]))");
        }
        case 'map': {
            return "Object.freeze(new Map([".concat(
            // @ts-expect-error TypeScript limitations
            Array.from(obj).map(function (_a) {
                var k = _a[0], v = _a[1];
                return "[".concat(toExport(k), ", ").concat(toExport(v), "]");
            }), "]))");
        }
        case 'array': {
            return "Object.freeze([".concat(obj.map(function (i) { return toExport(i); }), "])");
        }
        case 'object': {
            return "Object.freeze(Object.fromEntries([".concat(Object.entries(obj).map(function (_a) {
                var k = _a[0], v = _a[1];
                return "[".concat(toExport(k), ", ").concat(toExport(v), "]");
            }), "]))");
        }
        default: {
            throw new TypeError("Unknown obj ".concat(obj, " ").concat(JSON.stringify(obj), " type ").concat(objType));
        }
    }
}
