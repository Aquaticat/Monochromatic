console.log((function negative(num) {
    var result = '/* @__NO_SIDE_EFFECTS__ */ export type Negative<T extends number> = \n';
    for (var t = -num; t <= num; t++) {
        result += "T extends ".concat(t, "\n? ").concat(-t, ":");
    }
    result += 'T;';
    return result;
})(
// Max dprint can handle
48));
