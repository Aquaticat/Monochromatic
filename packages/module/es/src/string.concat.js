"use strict";
// TODO: Handle the case user passes a single param of MaybeAsyncIterable<string>
Object.defineProperty(exports, "__esModule", { value: true });
exports.concatStrings = concatStrings;
/**
 Concats all the strings passed in as params into one string.
 There's no separator, or we could say the separator is ''.
 */
/* @__NO_SIDE_EFFECTS__ */ function concatStrings() {
    var strings = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        strings[_i] = arguments[_i];
    }
    return strings.join('');
}
