"use strict";
// From https://stackoverflow.com/a/53930826 under https://creativecommons.org/licenses/by-sa/4.0/
Object.defineProperty(exports, "__esModule", { value: true });
exports.capitalize = capitalize;
function capitalize(str, locale) {
    return str.replace(/^\p{CWU}/u, function (char) { return char.toLocaleUpperCase(locale); });
}
