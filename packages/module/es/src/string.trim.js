"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trimEndWith = trimEndWith;
exports.trimStartWith = trimStartWith;
function trimEndWith(str, trimmer) {
    var reversedTrimmer = trimmer.split('').toReversed().join('');
    var modifingString = str;
    while (modifingString.endsWith(trimmer)) {
        modifingString = modifingString
            .split('')
            .toReversed()
            .join('')
            .replace(reversedTrimmer, '')
            .split('')
            .toReversed()
            .join('');
    }
    return modifingString;
}
function trimStartWith(str, trimmer) {
    var modifingString = str;
    while (modifingString.startsWith(trimmer)) {
        modifingString = modifingString.replace(trimmer, '');
    }
    return modifingString;
}
