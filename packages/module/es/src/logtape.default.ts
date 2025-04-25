import {
  type configure,
  getConsoleSink,
  getLevelFilter,
  getStreamSink,
  type LogRecord,
  type Sink,
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

  await configure(await logtapeConfiguration());
  const l = getLogger(logtapeId);
  ```

  For logger categories, a is short for app, m is short for module, t is short for test
  Sorry, but terminal space is precious.
  */
/* @__NO_SIDE_EFFECTS__ */ export const logtapeConfiguration = async (
  appName = 'monochromatic',
): Promise<Parameters<typeof configure>[0]> => {
  // try {
  const fileSink: Sink & AsyncDisposable =
    await (async (): Promise<Sink & AsyncDisposable> => {
      try {
        // Trying opfs
        // FIXME: Figma frontend error in using opfs TypeError: Cannot read properties of undefined (reading 'getDirectory')    at <anonymous>:757:48    at logtapeConfiguration (<anonymous>:778:5)    at <anonymous>:803:39
        const opfsRoot = await navigator.storage.getDirectory();
        const fileHandle = await opfsRoot.getFileHandle(appName, {
          create: true,
        });
        const writableStream = await fileHandle.createWritable();

        const fileSink = getStreamSink(writableStream, {
          formatter(log: any) {
            return `${JSON.stringify(log, null, 2)}\n`;
          },
        });

        fileSink[Symbol.asyncDispose] = async (): Promise<void> => {
          console.log('disposing OPFS sink');
          await writableStream.close();
          console.log('disposed OPFS sink', 'with file content', await (await fileHandle
            .getFile())
            .text());
        };

        return fileSink;
      } catch (opfsError) {
        // Trying sessionStorage

        console.log(`opfs failed with ${opfsError}, trying sessionStorage`);

        try {
          window.sessionStorage.setItem('test', 'test');
          window.sessionStorage.removeItem('test');

          window.sessionStorage.setItem(`${appName}.line`, '-1');

          const fileSink: Sink & AsyncDisposable = (record: LogRecord): void => {
            window.sessionStorage.setItem(`${appName}.line`, String(Number(window
              .sessionStorage
              .getItem(`${appName}.line`)! + 1)));

            window.sessionStorage.setItem(
              `${appName}.${window.sessionStorage.getItem(`${appName}.line`)}`,
              `${JSON.stringify(record, null, 2)}\n`,
            );
          };

          // eslint-disable-next-line require-await -- To keep the signature consistent, we have to make it an async function.
          fileSink[Symbol.asyncDispose] = async (): Promise<void> => {
            console.log('disposing sessionStorage sink');

            const lines = Array
              .from({ length: Number(window.sessionStorage.getItem(`${appName}.line`)!) })
              .map((_value, lineNumber) => {
                const line = window.sessionStorage.getItem(`${appName}.${lineNumber}`)!;
                window.sessionStorage.removeItem(`${appName}.${lineNumber}`);
                return line;
              });

            window.sessionStorage.removeItem(`${appName}.line`);

            const content = lines.join('\n');

            console.log('disposed sessionStorage sink', 'with file content', content);
          };

          return fileSink;
        } catch (sessionStorageError) {
          console.log(
            `sessionStorage failed with ${sessionStorageError}, storing log in memory in array.`,
          );

          const lines: string[] = [];

          const fileSink: Sink & AsyncDisposable = (record: LogRecord): void => {
            lines.push(JSON.stringify(record, null, 2));
          };

          // eslint-disable-next-line require-await -- To keep the signature consistent, we have to make it an async function.
          fileSink[Symbol.asyncDispose] = async (): Promise<void> => {
            console.log('disposing in memory array sink');

            const content = lines.join('\n');

            lines.length = 0;

            console.log('disposed sessionStorage sink', 'with file content', content);
          };

          return fileSink;
        }
      }
    })();

  return {
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
  };
  /*   } catch (error) {
    console.log(
      `Not running in node but both navigator.storage.getDirectory() and window.sessionStorage are unavailable because of ${error}, falling back to console logging only. App debug messages and module info messages would be logged to console in this mode.`,
    );
    // TODO: Make this use a in memory string as fs.
    return fallbackConfiguration;
  } */
};

/** Example logger id for your main executing file. */
/* @__NO_SIDE_EFFECTS__ */ export const logtapeId = ['a', 'index'] as const;

export {
  configure as logtapeConfigure,
  getLogger as logtapeGetLogger,
} from '@logtape/logtape';
