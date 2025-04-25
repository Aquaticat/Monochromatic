import { getFileSink } from '@logtape/file';
import {
  type configure,
  getConsoleSink,
  getLevelFilter,
  withFilter,
} from '@logtape/logtape';
import { fallbackConfiguration } from './logtape.shared.ts';

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
/* @__NO_SIDE_EFFECTS__ */ export const logtapeConfiguration = (
  appName = 'monochromatic',
): Parameters<typeof configure>[0] => {
  try {
    const fileSink = getFileSink(`${appName}.log`, {
      formatter(log: any) {
        return `${JSON.stringify(log, null, 2)}\n`;
      },
    });

    return ({
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
  } catch (error) {
    console.log(
      `Running in node but fs is unavailable because of ${error}, falling back to console logging only. App debug messages and module info messages would be logged to console in this mode.`,
    );
    return fallbackConfiguration;
  }
};

/** Example logger id for your main executing file. */
/* @__NO_SIDE_EFFECTS__ */ export const logtapeId = ['a', 'index'] as const;

export {
  configure as logtapeConfigure,
  getLogger as logtapeGetLogger,
} from '@logtape/logtape';
