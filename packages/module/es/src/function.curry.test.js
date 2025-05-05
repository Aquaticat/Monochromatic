"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts_1 = require("@monochromatic-dev/module-es/ts");
var bun_test_1 = require("bun:test");
await (0, ts_1.logtapeConfigure)(await (0, ts_1.logtapeConfiguration)());
(0, bun_test_1.describe)('curry', function () {
    (0, bun_test_1.describe)('normal', function () {
        (0, bun_test_1.test)('empty', function () {
            (0, bun_test_1.expect)(function () {
                (0, ts_1.curry)(function empty() {
                    return;
                });
            })
                .toThrow();
        });
        (0, bun_test_1.test)('one', function () {
            (0, bun_test_1.expect)(function () {
                (0, ts_1.curry)(function one(a) {
                    return a;
                });
            })
                .toThrow();
        });
        (0, bun_test_1.test)('two', function () {
            (0, bun_test_1.expect)((0, ts_1.curry)(function two(a, b) {
                return a + b;
            })(1)(2))
                .toBe(3);
        });
        (0, bun_test_1.test)('ten', function () {
            (0, bun_test_1.expect)((0, ts_1.curry)(function ten(a, b, c, d, e, f, g, h, i, j) {
                return a + b + c + d + e + f + g + h + i + j;
            })(1)(2)(3)(4)(5)(6)(7)(8)(9)(10))
                .toBe(55);
        });
        (0, bun_test_1.test)('eleven', function () {
            (0, bun_test_1.expect)(function () {
                (0, ts_1.curry)(
                // @ts-expect-error Testing
                function eleven(a, b, c, d, e, f, g, h, i, j, k) {
                    return a + b + c + d + e + f + g + h + i + j + k;
                });
            })
                .toThrow();
        });
    });
});
