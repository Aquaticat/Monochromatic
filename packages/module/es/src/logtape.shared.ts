import {
  type Config,
  getConsoleSink,
  getLevelFilter,
  type LogRecord,
  type Sink,
  withFilter,
} from '@logtape/logtape';

// Common configuration for all environments
export const createBaseConfig = (
  fileSink: Sink & AsyncDisposable,
): Config<string, string> => ({
  reset: true,

  sinks: {
    console: getConsoleSink(),
    consoleInfoPlus: withFilter(getConsoleSink(), getLevelFilter('info')),
    consoleWarnPlus: withFilter(getConsoleSink(), getLevelFilter('warning')),
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

// Memory fallback sink creation
export const createMemorySink = (): Sink & AsyncDisposable => {
  const lines: string[] = [];

  const memorySink: Sink & AsyncDisposable = (record: LogRecord): void => {
    lines.push(JSON.stringify(record, null, 2));
  };

  // eslint-disable-next-line require-await -- To keep the signature consistent, we have to make it an async function.
  memorySink[Symbol.asyncDispose] = async function disposeMemorySink(): Promise<void> {
    console.log('disposing in memory array sink');
    const content = lines.join('\n');
    lines.length = 0;
    console.log('disposed memory sink', 'with content length', content.length);
  };

  return memorySink;
};

/** Example logger id for your main executing file. */
/* @__NO_SIDE_EFFECTS__ */ export const logtapeId = ['a', 'index'] as const;

export {
  configure as logtapeConfigure,
  getLogger as logtapeGetLogger,
} from '@logtape/logtape';
