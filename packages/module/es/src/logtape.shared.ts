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
): Config<string, string> => {
  const myProcess = typeof process === 'undefined' ? undefined : process as unknown as {
    env: { NODE_ENV: string | undefined; NO_COLOR: undefined | boolean | string; };
  };
  const noColor = Boolean(myProcess?.env.NODE_ENV === 'test'
    || myProcess?.env.NO_COLOR
    // This somehow doesn't work?
    || (import.meta as unknown as { vitest: boolean; }).vitest);
  const consoleSink = noColor
    ? getConsoleSink({
      formatter: function consoleFormatter(record: LogRecord): readonly unknown[] {
        // Copypasted from https://jsr.io/@logtape/logtape/0.10.0/formatter.ts
        let msg = '';
        const values: unknown[] = [];
        for (let i = 0; i < record.message.length; i++) {
          if (i % 2 === 0) {
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands -- Good enough for defaultConsoleFormatter in logtape library, good enough for the library.
            msg += record.message[i];
          } else {
            msg += '%o';
            values.push(record.message[i]);
          }
        }
        const date = new Date(record.timestamp);
        const time = `${date.getUTCHours().toString().padStart(2, '0')}:${
          date
            .getUTCMinutes()
            .toString()
            .padStart(2, '0')
        }:${date.getUTCSeconds().toString().padStart(2, '0')}.${
          date.getUTCMilliseconds().toString().padStart(3, '0')
        }`;
        return [
          `${time} ${record.level.slice(0, 3)} ${record.category.join('\u00B7')} ${msg}`,
          ...values,
        ];
      },
    })
    : getConsoleSink();
  return ({
    reset: true,

    sinks: {
      console: consoleSink,
      consoleInfoPlus: withFilter(consoleSink, getLevelFilter('info')),
      consoleWarnPlus: withFilter(consoleSink, getLevelFilter('warning')),
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
};

// Memory fallback sink creation
export const createMemorySink = (): Sink & AsyncDisposable => {
  const lines: string[] = [];

  const memorySink: Sink & AsyncDisposable = (record: LogRecord): void => {
    lines.push(JSON.stringify(record, null, 2));
  };

  // eslint-disable-next-line @typescript-eslint/require-await -- To keep the signature consistent, we've to make it an async function.
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
