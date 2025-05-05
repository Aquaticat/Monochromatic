"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ts_1 = require("@monochromatic-dev/module-es/ts");
var bun_test_1 = require("bun:test");
await (0, ts_1.logtapeConfigure)(await (0, ts_1.logtapeConfiguration)());
(0, bun_test_1.describe)('isPositiveIntString', function () {
    (0, bun_test_1.describe)('digits', function () {
        (0, bun_test_1.test)('empty', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveIntString)(''))
                .toBe(false);
        });
        (0, bun_test_1.test)('0', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveIntString)('0'))
                .toBe(true);
        });
        (0, bun_test_1.test)('1', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveIntString)('1'))
                .toBe(true);
        });
        (0, bun_test_1.test)('-0', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveIntString)('-0'))
                .toBe(false);
        });
        (0, bun_test_1.test)('-1', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveIntString)('-1'))
                .toBe(false);
        });
    });
    (0, bun_test_1.describe)('two digits', function () {
        (0, bun_test_1.test)('01', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveIntString)('01'))
                .toBe(false);
        });
        (0, bun_test_1.test)('10', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveIntString)('10'))
                .toBe(true);
        });
        (0, bun_test_1.test)('11', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveIntString)('11'))
                .toBe(true);
        });
        (0, bun_test_1.test)('-01', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveIntString)('-01'))
                .toBe(false);
        });
        (0, bun_test_1.test)('-10', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveIntString)('-10'))
                .toBe(false);
        });
        (0, bun_test_1.test)('-11', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveIntString)('-11'))
                .toBe(false);
        });
    });
});
(0, bun_test_1.describe)('isNegativeIntString', function () {
    (0, bun_test_1.describe)('digits', function () {
        (0, bun_test_1.test)('empty', function () {
            (0, bun_test_1.expect)((0, ts_1.isNegativeIntString)(''))
                .toBe(false);
        });
        (0, bun_test_1.test)('0', function () {
            (0, bun_test_1.expect)((0, ts_1.isNegativeIntString)('0'))
                .toBe(false);
        });
        (0, bun_test_1.test)('1', function () {
            (0, bun_test_1.expect)((0, ts_1.isNegativeIntString)('1'))
                .toBe(false);
        });
        (0, bun_test_1.test)('-0', function () {
            (0, bun_test_1.expect)((0, ts_1.isNegativeIntString)('-0'))
                .toBe(true);
        });
        (0, bun_test_1.test)('-1', function () {
            (0, bun_test_1.expect)((0, ts_1.isNegativeIntString)('-1'))
                .toBe(true);
        });
    });
    (0, bun_test_1.describe)('two digits', function () {
        (0, bun_test_1.test)('01', function () {
            (0, bun_test_1.expect)((0, ts_1.isNegativeIntString)('01'))
                .toBe(false);
        });
        (0, bun_test_1.test)('10', function () {
            (0, bun_test_1.expect)((0, ts_1.isNegativeIntString)('10'))
                .toBe(false);
        });
        (0, bun_test_1.test)('11', function () {
            (0, bun_test_1.expect)((0, ts_1.isNegativeIntString)('11'))
                .toBe(false);
        });
        (0, bun_test_1.test)('-01', function () {
            (0, bun_test_1.expect)((0, ts_1.isNegativeIntString)('-01'))
                .toBe(false);
        });
        (0, bun_test_1.test)('-10', function () {
            (0, bun_test_1.expect)((0, ts_1.isNegativeIntString)('-10'))
                .toBe(true);
        });
        (0, bun_test_1.test)('-11', function () {
            (0, bun_test_1.expect)((0, ts_1.isNegativeIntString)('-11'))
                .toBe(true);
        });
    });
});
(0, bun_test_1.describe)('isPositiveFloatString', function () {
    (0, bun_test_1.describe)('digits', function () {
        (0, bun_test_1.test)('empty', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)(''))
                .toBe(false);
        });
        (0, bun_test_1.test)('0', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('0'))
                .toBe(false);
        });
        (0, bun_test_1.test)('1', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('1'))
                .toBe(false);
        });
        (0, bun_test_1.test)('-0', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('-0'))
                .toBe(false);
        });
        (0, bun_test_1.test)('-1', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('-1'))
                .toBe(false);
        });
    });
    (0, bun_test_1.describe)('with dot', function () {
        (0, bun_test_1.test)('0.', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('0.'))
                .toBe(false);
        });
        (0, bun_test_1.test)('0.0', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('0.0'))
                .toBe(false);
        });
        (0, bun_test_1.test)('1.1.1', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('1.1.1'))
                .toBe(false);
        });
        (0, bun_test_1.test)('0.1', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('0.1'))
                .toBe(true);
        });
        (0, bun_test_1.test)('0.00', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('0.00'))
                .toBe(false);
        });
        (0, bun_test_1.test)('00.0', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('00.0'))
                .toBe(false);
        });
        (0, bun_test_1.test)('0.10', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('0.10'))
                .toBe(true);
        });
        (0, bun_test_1.test)('01.10', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('01.10'))
                .toBe(false);
        });
        (0, bun_test_1.test)('10.10', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('10.10'))
                .toBe(true);
        });
    });
    (0, bun_test_1.describe)('two digits', function () {
        (0, bun_test_1.test)('01', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('01'))
                .toBe(false);
        });
        (0, bun_test_1.test)('10', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('10'))
                .toBe(false);
        });
        (0, bun_test_1.test)('11', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('11'))
                .toBe(false);
        });
        (0, bun_test_1.test)('-01', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('-01'))
                .toBe(false);
        });
        (0, bun_test_1.test)('-10', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('-10'))
                .toBe(false);
        });
        (0, bun_test_1.test)('-11', function () {
            (0, bun_test_1.expect)((0, ts_1.isPositiveFloatString)('-11'))
                .toBe(false);
        });
    });
});
