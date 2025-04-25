import {
  type Config,
  getConsoleSink,
  getLevelFilter,
  withFilter,
} from '@logtape/logtape';

export const fallbackConfiguration: Config<string, string> = {
  reset: true,

  sinks: {
    console: getConsoleSink(),
    consoleInfoPlus: withFilter(getConsoleSink(), getLevelFilter('info')),
    consoleWarnPlus: withFilter(getConsoleSink(), getLevelFilter('warning')),
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
