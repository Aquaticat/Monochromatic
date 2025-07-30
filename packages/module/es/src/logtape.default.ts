import {
  type configure,
  getStreamSink,
  type LogRecord,
  type Sink,
} from '@logtape/logtape';
import {
  createBaseConfig,
  createMemorySink,
} from './logtape.shared.ts';

const createBrowserFileSink = async (
  appName: string,
): Promise<Sink & AsyncDisposable> => {
  try {
    // Trying opfs
    const opfsRoot = await navigator.storage.getDirectory();
    const fileHandle = await opfsRoot.getFileHandle(appName, {
      create: true,
    },);
    const writableStream = await fileHandle.createWritable();

    const fileSink = getStreamSink(writableStream, {
      formatter(log: LogRecord,) {
        return `${JSON.stringify(log, null, 2,)}\n`;
      },
    },);

    fileSink[Symbol.asyncDispose] = async function disposeOpfs(): Promise<void> {
      console.log('disposing OPFS sink',);
      await writableStream.close();
      console.log('disposed OPFS sink', 'with file content', await (await fileHandle
        .getFile())
        .text(),);
    };

    return fileSink;
  }
  catch (opfsError) {
    // Trying sessionStorage
    console.log(`opfs failed with ${opfsError}, trying sessionStorage`,);

    try {
      globalThis.sessionStorage.setItem('test', 'test',);
      globalThis.sessionStorage.removeItem('test',);

      globalThis.sessionStorage.setItem(`${appName}.line`, '-1',);

      const sessionStorageSink: Sink & AsyncDisposable = (record: LogRecord,): void => {
        const lineNumber = Number(globalThis.sessionStorage.getItem(`${appName}.line`,)!,)
          + 1;
        globalThis.sessionStorage.setItem(`${appName}.line`, String(lineNumber,),);
        globalThis.sessionStorage.setItem(
          `${appName}.${lineNumber}`,
          `${JSON.stringify(record, null, 2,)}\n`,
        );
      };

      sessionStorageSink[Symbol.asyncDispose] =
        // eslint-disable-next-line require-await -- To keep the signature consistent, we've to make it an async function.
        async function disposeSessionStorage(): Promise<void> {
          console.log('disposing sessionStorage sink',);
          const lineCount = Number(
            globalThis.sessionStorage.getItem(`${appName}.line`,)!,
          );

          const lines = Array
            .from({ length: lineCount + 1, },)
            .map(function popLine(_value, lineNumber,) {
              const line = globalThis.sessionStorage.getItem(
                `${appName}.${lineNumber}`,
              )!;
              globalThis.sessionStorage.removeItem(`${appName}.${lineNumber}`,);
              return line;
            },);

          globalThis.sessionStorage.removeItem(`${appName}.line`,);
          const content = lines.join('\n',);
          console.log('disposed sessionStorage sink', 'with content length', content
            .length,);
        };

      return sessionStorageSink;
    }
    catch (sessionStorageError) {
      console.log(
        `sessionStorage failed with ${sessionStorageError}, storing log in memory in array.`,
      );
      return createMemorySink();
    }
  }
};

/**
 * Creates a logtape configuration object optimized for browser environments.
 *
 * This function provides a complete logging configuration that automatically
 * handles different browser storage mechanisms. It attempts to use OPFS (Origin Private File System)
 * first, falls back to sessionStorage, and finally uses in-memory storage if neither is available.
 * The configuration includes proper sinks, formatters, and disposal mechanisms for each storage type.
 *
 * @param appName - Application name used for log file naming and storage keys (defaults to 'monochromatic')
 * @returns Configuration object compatible with logtape's configure function
 *
 * @example
 * Basic usage with default app name:
 * ```ts
 * import { logtapeConfigure } from '@logtape/logtape';
 * import { logtapeConfiguration } from '@monochromatic-dev/module-es';
 *
 * await logtapeConfigure(await logtapeConfiguration());
 * ```
 *
 * @example
 * Custom application name:
 * ```ts
 * import { logtapeConfigure } from '@logtape/logtape';
 * import { logtapeConfiguration, logtapeGetLogger, logtapeId } from '@monochromatic-dev/module-es';
 *
 * await logtapeConfigure(await logtapeConfiguration('my-app'));
 * const logger = logtapeGetLogger(logtapeId);
 *
 * logger.info('Application started');
 * ```
 *
 * @example
 * Complete setup in main application file:
 * ```ts
 * import {
 *   logtapeConfiguration,
 *   logtapeId,
 *   logtapeGetLogger,
 *   logtapeConfigure,
 * } from '@monochromatic-dev/module-es';
 *
 * // Initialize logging
 * await logtapeConfigure(await logtapeConfiguration('my-app'));
 * const logger = logtapeGetLogger(logtapeId);
 *
 * // Logger categories: 'a' (app), 'm' (module), 't' (test)
 * logger.debug('Debug message', { category: 'a' });
 * ```
 *
 * @remarks
 * Storage fallback hierarchy:
 * 1. **OPFS (Origin Private File System)** - Persistent file storage (preferred)
 * 2. **SessionStorage** - Session-scoped browser storage
 * 3. **Memory** - In-memory array storage (fallback)
 *
 * Logger category abbreviations are used to save terminal space:
 * - `a` = app (application-level logging)
 * - `m` = module (module-level logging)
 * - `t` = test (testing-related logging)
 */
/* @__NO_SIDE_EFFECTS__ */ export const logtapeConfiguration = async (
  appName = 'monochromatic',
): Promise<Parameters<typeof configure>[0]> => {
  const fileSink = await createBrowserFileSink(appName,);
  return createBaseConfig(fileSink,);
};

export { logtapeId, } from './logtape.shared.ts';
