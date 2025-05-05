"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logtapeGetLogger = exports.logtapeConfigure = exports.logtapeId = exports.logtapeConfiguration = void 0;
var logtape_1 = require("@logtape/logtape");
/**
 @param [appName='monochromatic'] will be used as the name of log file.

 @returns a logtape configuration object with optional specified application name.

 @remarks
 Use it like this in your main executing file:

  ```ts
  import {
    configure,
    getLogger,
  } from '@logtape/logtape';
  import {
    logtapeConfiguration,
    logtapeId,
  } from '@monochromatic-dev/module-util';

  await configure(await logtapeConfiguration());
  const l = getLogger(logtapeId);
  ```

  For logger categories, a is short for app, m is short for module, t is short for test
  Sorry, but terminal space is precious.
  */
/* @__NO_SIDE_EFFECTS__ */ var logtapeConfiguration = function () {
    var args_1 = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args_1[_i] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([], args_1, true), void 0, function (appName) {
        var fileSink;
        if (appName === void 0) { appName = 'monochromatic'; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (function () { return __awaiter(void 0, void 0, void 0, function () {
                        var opfsRoot, fileHandle_1, writableStream_1, fileSink_1, opfsError_1, fileSink_2, lines_1, fileSink_3;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 4, , 5]);
                                    return [4 /*yield*/, navigator.storage.getDirectory()];
                                case 1:
                                    opfsRoot = _a.sent();
                                    return [4 /*yield*/, opfsRoot.getFileHandle(appName, {
                                            create: true,
                                        })];
                                case 2:
                                    fileHandle_1 = _a.sent();
                                    return [4 /*yield*/, fileHandle_1.createWritable()];
                                case 3:
                                    writableStream_1 = _a.sent();
                                    fileSink_1 = (0, logtape_1.getStreamSink)(writableStream_1, {
                                        formatter: function (log) {
                                            return "".concat(JSON.stringify(log, null, 2), "\n");
                                        },
                                    });
                                    fileSink_1[Symbol.asyncDispose] = function () { return __awaiter(void 0, void 0, void 0, function () {
                                        var _a, _b, _c;
                                        return __generator(this, function (_d) {
                                            switch (_d.label) {
                                                case 0:
                                                    console.log('disposing OPFS sink');
                                                    return [4 /*yield*/, writableStream_1.close()];
                                                case 1:
                                                    _d.sent();
                                                    _b = (_a = console).log;
                                                    _c = ['disposed OPFS sink', 'with file content'];
                                                    return [4 /*yield*/, fileHandle_1
                                                            .getFile()];
                                                case 2: return [4 /*yield*/, (_d.sent())
                                                        .text()];
                                                case 3:
                                                    _b.apply(_a, _c.concat([_d.sent()]));
                                                    return [2 /*return*/];
                                            }
                                        });
                                    }); };
                                    return [2 /*return*/, fileSink_1];
                                case 4:
                                    opfsError_1 = _a.sent();
                                    // Trying sessionStorage
                                    console.log("opfs failed with ".concat(opfsError_1, ", trying sessionStorage"));
                                    try {
                                        window.sessionStorage.setItem('test', 'test');
                                        window.sessionStorage.removeItem('test');
                                        window.sessionStorage.setItem("".concat(appName, ".line"), '-1');
                                        fileSink_2 = function (record) {
                                            window.sessionStorage.setItem("".concat(appName, ".line"), String(Number(window
                                                .sessionStorage
                                                .getItem("".concat(appName, ".line")) + 1)));
                                            window.sessionStorage.setItem("".concat(appName, ".").concat(window.sessionStorage.getItem("".concat(appName, ".line"))), "".concat(JSON.stringify(record, null, 2), "\n"));
                                        };
                                        // eslint-disable-next-line require-await -- To keep the signature consistent, we have to make it an async function.
                                        fileSink_2[Symbol.asyncDispose] = function () { return __awaiter(void 0, void 0, void 0, function () {
                                            var lines, content;
                                            return __generator(this, function (_a) {
                                                console.log('disposing sessionStorage sink');
                                                lines = Array
                                                    .from({ length: Number(window.sessionStorage.getItem("".concat(appName, ".line"))) })
                                                    .map(function (_value, lineNumber) {
                                                    var line = window.sessionStorage.getItem("".concat(appName, ".").concat(lineNumber));
                                                    window.sessionStorage.removeItem("".concat(appName, ".").concat(lineNumber));
                                                    return line;
                                                });
                                                window.sessionStorage.removeItem("".concat(appName, ".line"));
                                                content = lines.join('\n');
                                                console.log('disposed sessionStorage sink', 'with file content', content);
                                                return [2 /*return*/];
                                            });
                                        }); };
                                        return [2 /*return*/, fileSink_2];
                                    }
                                    catch (sessionStorageError) {
                                        console.log("sessionStorage failed with ".concat(sessionStorageError, ", storing log in memory in array."));
                                        lines_1 = [];
                                        fileSink_3 = function (record) {
                                            lines_1.push(JSON.stringify(record, null, 2));
                                        };
                                        // eslint-disable-next-line require-await -- To keep the signature consistent, we have to make it an async function.
                                        fileSink_3[Symbol.asyncDispose] = function () { return __awaiter(void 0, void 0, void 0, function () {
                                            var content;
                                            return __generator(this, function (_a) {
                                                console.log('disposing in memory array sink');
                                                content = lines_1.join('\n');
                                                lines_1.length = 0;
                                                console.log('disposed sessionStorage sink', 'with file content', content);
                                                return [2 /*return*/];
                                            });
                                        }); };
                                        return [2 /*return*/, fileSink_3];
                                    }
                                    return [3 /*break*/, 5];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); })()];
                case 1:
                    fileSink = _a.sent();
                    return [2 /*return*/, {
                            reset: true,
                            sinks: {
                                console: (0, logtape_1.getConsoleSink)(),
                                consoleInfoPlus: (0, logtape_1.withFilter)((0, logtape_1.getConsoleSink)(), (0, logtape_1.getLevelFilter)('info')),
                                consoleWarnPlus: (0, logtape_1.withFilter)((0, logtape_1.getConsoleSink)(), (0, logtape_1.getLevelFilter)('warning')),
                                file: fileSink,
                            },
                            filters: {},
                            loggers: [
                                /* a is short for app, m is short for module, t is short for test
                                       Sorry, but terminal space is precious. */
                                { category: ['a'], lowestLevel: 'debug', sinks: ['file', 'consoleInfoPlus'] },
                                { category: ['t'], lowestLevel: 'debug', sinks: ['file', 'consoleInfoPlus'] },
                                { category: ['m'], lowestLevel: 'debug', sinks: ['file', 'consoleWarnPlus'] },
                                {
                                    category: ['esbuild-plugin'],
                                    lowestLevel: 'debug',
                                    sinks: ['file', 'consoleWarnPlus'],
                                },
                                { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
                            ],
                        }];
            }
        });
    });
};
exports.logtapeConfiguration = logtapeConfiguration;
/** Example logger id for your main executing file. */
/* @__NO_SIDE_EFFECTS__ */ exports.logtapeId = ['a', 'index'];
var logtape_2 = require("@logtape/logtape");
Object.defineProperty(exports, "logtapeConfigure", { enumerable: true, get: function () { return logtape_2.configure; } });
Object.defineProperty(exports, "logtapeGetLogger", { enumerable: true, get: function () { return logtape_2.getLogger; } });
