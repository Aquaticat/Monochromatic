"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fallbackConfiguration = void 0;
var logtape_1 = require("@logtape/logtape");
exports.fallbackConfiguration = {
    reset: true,
    sinks: {
        console: (0, logtape_1.getConsoleSink)(),
        consoleInfoPlus: (0, logtape_1.withFilter)((0, logtape_1.getConsoleSink)(), (0, logtape_1.getLevelFilter)('info')),
        consoleWarnPlus: (0, logtape_1.withFilter)((0, logtape_1.getConsoleSink)(), (0, logtape_1.getLevelFilter)('warning')),
    },
    filters: {},
    loggers: [
        /* a is short for app, m is short for module, t is short for test
             Sorry, but terminal space is precious. */
        { category: ['a'], lowestLevel: 'debug', sinks: ['console'] },
        { category: ['t'], lowestLevel: 'debug', sinks: ['consoleInfoPlus'] },
        { category: ['m'], lowestLevel: 'debug', sinks: ['consoleInfoPlus'] },
        {
            category: ['esbuild-plugin'],
            lowestLevel: 'debug',
            sinks: ['consoleWarnPlus'],
        },
        { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
    ],
};
