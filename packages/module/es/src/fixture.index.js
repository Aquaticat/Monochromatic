// Quick and dirty.
//
// This file is now ran manually with `yarn node --experimental-strip-types src/fixture.index.ts`
// In the future, this file would be built and ran only when changed automatically.
//
// Named *.index.ts instead of index.*.ts because it's not a module entry,
// but merely something to be ran **only** when changed.
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
// array0to999
console.log(JSON.stringify(__spreadArray([], Array.from(Array(1000)).keys(), true)));
// promises0to999
console.log(JSON
    .stringify(__spreadArray([], Array
    .from(Array(1000))
    .keys(), true).map(function (element) {
    return "(async () => {await (new Promise((resolve) => setTimeout(resolve, ".concat(element, ")));return ").concat(element, ";})()");
}))
    .replaceAll('"', ''));
