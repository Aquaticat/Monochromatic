console.log((function abs(num) {
    var result = '/* @__NO_SIDE_EFFECTS__ */ export type Abs<T extends number> = \n';
    for (var t = -num; t < 0; t++) {
        result += "T extends ".concat(t, "\n? ").concat(Math.abs(t), "\n:");
    }
    result += 'T;';
    return result;
})(
// Max dprint can handle
48));
