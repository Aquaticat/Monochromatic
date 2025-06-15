/* istanbul ignore file */
// we know it works well enough
import type {
  configure,
  LogRecord,
  Sink,
} from '@logtape/logtape';
import {
  appendFile,
  mkdir,
  readFile,
  rm,
} from 'node:fs/promises';
import { join } from 'node:path';
import {
  emptyDir,
  removeEmptyFilesInDir,
} from './fs.emptyPath.ts';
import { ensureFile } from './fs.ensurePath.ts';
import {
  createBaseConfig,
  createMemorySink,
} from './logtape.shared.ts';

const disposeFileSink = async (): Promise<void> => {
  // No need to close the file stream, as we're using appendFile
};

const createFileSink = async (appName: string): Promise<Sink & AsyncDisposable> => {
  try {
    const fileName = `${appName}.${
      new Date().toISOString().replaceAll(':', '')
    }.log.jsonl`;
    const filePath = join('logs', fileName);

    await ensureFile(filePath);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Not really a misused promise. An async function assigned to a variable.
    const fileSink: Sink & AsyncDisposable = async (
      record: LogRecord,
    ): Promise<void> => {
      const log = JSON.stringify(record, null, 2) + '\n';

      // It's, in fact, working correctly.
      await appendFile(filePath, log);
    };

    fileSink[Symbol.asyncDispose] = disposeFileSink;

    return fileSink;
  } catch (fsError: any) {
    console.log(`fs failed with ${fsError}, storing log in memory in array.`);
    return createMemorySink();
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
export const logtapeConfiguration = async (
  appName = 'monochromatic',
): Promise<Parameters<typeof configure>[0]> => {
  const fileSink = await createFileSink(appName);
  return createBaseConfig(fileSink);
};

export { logtapeId } from './logtape.shared.ts';
