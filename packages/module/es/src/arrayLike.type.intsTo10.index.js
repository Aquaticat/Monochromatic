var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
(function intsTo(num, minGap) {
    var _loop_1 = function (fromInclusive) {
        // type any union less than minGap on your own.
        for (var toInclusive = fromInclusive + minGap; toInclusive <= num; toInclusive++) {
            if (!([-num, -1, 0, 1, num].includes(toInclusive))) {
                continue;
            }
            console.log("/* @__NO_SIDE_EFFECTS__ */ export type Ints".concat(fromInclusive < 0 ? "Negative".concat(-fromInclusive) : fromInclusive, "to").concat(toInclusive < 0 ? "Negative".concat(-toInclusive) : toInclusive, " = ").concat(toInclusive === fromInclusive
                ? toInclusive
                : "(".concat(__spreadArray([], Array(toInclusive + 1 - fromInclusive).keys(), true).map(function (current) {
                    return current + fromInclusive;
                })
                    .join('|'), ")"), ";"));
        }
    };
    for (var _i = 0, _a = [-num, -1, 0, 1, num]; _i < _a.length; _i++) {
        var fromInclusive = _a[_i];
        _loop_1(fromInclusive);
    }
})(
// Max TypeScript can handle
10, 
// Min gap
9);
