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
    });
    const writableStream = await fileHandle.createWritable();

    const fileSink = getStreamSink(writableStream, {
      formatter(log: LogRecord) {
        return `${JSON.stringify(log, null, 2)}\n`;
      },
    });

    fileSink[Symbol.asyncDispose] = async function disposeOpfs(): Promise<void> {
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

      const sessionStorageSink: Sink & AsyncDisposable = (record: LogRecord): void => {
        const lineNumber = Number(window.sessionStorage.getItem(`${appName}.line`)!) + 1;
        window.sessionStorage.setItem(`${appName}.line`, String(lineNumber));
        window.sessionStorage.setItem(
          `${appName}.${lineNumber}`,
          `${JSON.stringify(record, null, 2)}\n`,
        );
      };

      sessionStorageSink[Symbol.asyncDispose] =
        // eslint-disable-next-line require-await -- To keep the signature consistent, we have to make it an async function.
        async function disposeSessionStorage(): Promise<void> {
          console.log('disposing sessionStorage sink');
          const lineCount = Number(window.sessionStorage.getItem(`${appName}.line`)!);

          const lines = Array
            .from({ length: lineCount + 1 })
            .map(function popLine(_value, lineNumber) {
              const line = window.sessionStorage.getItem(`${appName}.${lineNumber}`)!;
              window.sessionStorage.removeItem(`${appName}.${lineNumber}`);
              return line;
            });

          window.sessionStorage.removeItem(`${appName}.line`);
          const content = lines.join('\n');
          console.log('disposed sessionStorage sink', 'with content length', content
            .length);
        };

      return sessionStorageSink;
    } catch (sessionStorageError) {
      console.log(
        `sessionStorage failed with ${sessionStorageError}, storing log in memory in array.`,
      );
      return createMemorySink();
    }
  }
};

/**
 @param [appName='monochromatic'] will be used as the name of log file.

 @returns a logtape configuration object with optional specified application name.

 @remarks
 Use it like this in your main executing file:

 import {
 logtapeConfiguration,
 logtapeId,
 logtapeGetLogger,
 logtapeConfigure,
 } from '@monochromatic-dev/module-util';

 await logtapeConfigure(await logtapeConfiguration());
 const l = logtapeGetLogger(logtapeId);

 For logger categories, a is short for app, m is short for module, t is short for test
 Sorry, but terminal space is precious.
 */
/* @__NO_SIDE_EFFECTS__ */ export const logtapeConfiguration = async (
  appName = 'monochromatic',
): Promise<Parameters<typeof configure>[0]> => {
  const fileSink = await createBrowserFileSink(appName);
  return createBaseConfig(fileSink);
};

export { logtapeId } from './logtape.shared.ts';
