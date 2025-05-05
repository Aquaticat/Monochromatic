var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
console.log((function negIntToInt(num) {
    var result = '/* @__NO_SIDE_EFFECTS__ */ export type Ints<fromInclusive extends number, toInclusive extends number,> =\n';
    var _loop_1 = function (fromInclusive) {
        result += "fromInclusive extends ".concat(fromInclusive, "\n?");
        for (var toInclusive = fromInclusive; toInclusive <= num; toInclusive++) {
            result += "toInclusive extends ".concat(toInclusive, " ? ").concat(toInclusive === fromInclusive
                ? toInclusive
                : "(".concat(__spreadArray([], Array.from({ length: toInclusive + 1 - fromInclusive }).keys(), true).map(function (current) { return current + fromInclusive; })
                    .join('|'), ")"), " :");
        }
        result += 'number\n:';
    };
    // Originally decided to support -100 to 100. But then dprint said call stack exhausted.
    for (var fromInclusive = -num; fromInclusive <= num; fromInclusive++) {
        _loop_1(fromInclusive);
    }
    result += 'number;';
    return result;
})(
// Max dprint can handle
48));
