"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wait = void 0;
// eslint-disable avoid-new
var wait = function (timeInMs) {
    return new Promise(function (_resolve) { return setTimeout(_resolve, timeInMs); });
};
exports.wait = wait;
