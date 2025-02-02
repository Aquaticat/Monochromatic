import {
  type configure,
  getConsoleSink,
  getFileSink,
  getLevelFilter,
  withFilter,
} from '@logtape/logtape';

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

  await configure(logtapeConfiguration());
  const l = getLogger(logtapeId);
  ```

  For logger categories, a is short for app, m is short for module, t is short for test
  Sorry, but terminal space is precious.
  */
/* @__NO_SIDE_EFFECTS__ */ export function logtapeConfiguration(
  appName = 'monochromatic',
): Parameters<typeof configure>[0] {
  return {
    sinks: {
      console: getConsoleSink(),
      consoleInfoPlus: withFilter(getConsoleSink(), getLevelFilter('info')),
      consoleWarnPlus: withFilter(getConsoleSink(), getLevelFilter('warning')),
      file: getFileSink(`${appName}.log`, {
        formatter(log: any) {
          return `${JSON.stringify(log, null, 2)}\n`;
        },
      }),
    },

    filters: {},

    loggers: [
      /* a is short for app, m is short for module, t is short for test
         Sorry, but terminal space is precious. */
      { category: ['a'], level: 'debug', sinks: ['file', 'consoleInfoPlus'] },
      { category: ['t'], level: 'debug', sinks: ['file', 'consoleInfoPlus'] },
      { category: ['m'], level: 'debug', sinks: ['file', 'consoleWarnPlus'] },
      {
        category: ['esbuild-plugin'],
        level: 'debug',
        sinks: ['file', 'consoleWarnPlus'],
      },
      { category: ['logtape', 'meta'], level: 'warning', sinks: ['console'] },
    ],
  };
}

/** Example logger id for your main executing file. */
/* @__NO_SIDE_EFFECTS__ */ export const logtapeId = ['a', 'index'] as const;
