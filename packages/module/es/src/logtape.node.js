"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logtapeGetLogger = exports.logtapeConfigure = exports.logtapeId = exports.logtapeConfiguration = void 0;
var file_1 = require("@logtape/file");
var logtape_1 = require("@logtape/logtape");
var logtape_shared_ts_1 = require("./logtape.shared.ts");
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
/* @__NO_SIDE_EFFECTS__ */ var logtapeConfiguration = function (appName) {
    if (appName === void 0) { appName = 'monochromatic'; }
    try {
        var fileSink = (0, file_1.getFileSink)("".concat(appName, ".log"), {
            formatter: function (log) {
                return "".concat(JSON.stringify(log, null, 2), "\n");
            },
        });
        return ({
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
        });
    }
    catch (error) {
        console.log("Running in node but fs is unavailable because of ".concat(error, ", falling back to console logging only. App debug messages and module info messages would be logged to console in this mode."));
        return logtape_shared_ts_1.fallbackConfiguration;
    }
};
exports.logtapeConfiguration = logtapeConfiguration;
/** Example logger id for your main executing file. */
/* @__NO_SIDE_EFFECTS__ */ exports.logtapeId = ['a', 'index'];
var logtape_2 = require("@logtape/logtape");
Object.defineProperty(exports, "logtapeConfigure", { enumerable: true, get: function () { return logtape_2.configure; } });
Object.defineProperty(exports, "logtapeGetLogger", { enumerable: true, get: function () { return logtape_2.getLogger; } });
