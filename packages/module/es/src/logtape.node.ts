import type {
  configure,
  LogRecord,
  Sink,
} from '@logtape/logtape';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureFile } from './fs.ensurePath.ts';
import {
  createBaseConfig,
  createMemorySink,
} from './logtape.shared.ts';

async function disposeFileSink(): Promise<void> {
  // No need to close the file stream, as we're using appendFile
}

async function createFileSink(appName: string): Promise<Sink & AsyncDisposable> {
  try {
    const fileName = `${appName}.${
      new Date().toISOString().replaceAll(':', '')
    }.log.jsonl`;
    const filePath = join('logs', fileName);

    await ensureFile(filePath);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- Not really a misused promise. An async function assigned to a variable.
    const fileSink: Sink & AsyncDisposable = async function logToFile(
      record: LogRecord,
    ): Promise<void> {
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
}

/**
 * Creates a logtape configuration object optimized for Node.js environments.
 *
 * This function provides a complete logging configuration that automatically
 * handles file-based logging with timestamped JSONL files. It creates log files
 * in the './logs' directory with the format `{appName}.{timestamp}.log.jsonl`.
 * Falls back to in-memory storage if file system operations fail.
 *
 * @param appName - Application name used for log file naming (defaults to 'monochromatic')
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
 * await logtapeConfigure(await logtapeConfiguration('my-server'));
 * const logger = logtapeGetLogger(logtapeId);
 *
 * logger.info('Server started');
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
 * await logtapeConfigure(await logtapeConfiguration('my-server'));
 * const logger = logtapeGetLogger(logtapeId);
 *
 * // Logger categories: 'a' (app), 'm' (module), 't' (test)
 * logger.debug('Debug message', { category: 'a' });
 * ```
 *
 * @remarks
 * File storage characteristics:
 * - **Log Directory**: `./logs/` (created automatically)
 * - **File Format**: `{appName}.{ISO-timestamp}.log.jsonl`
 * - **Content Format**: Pretty-printed JSON with newlines for readability
 * - **Fallback**: In-memory array storage if filesystem fails
 *
 * Logger category abbreviations are used to save terminal space:
 * - `a` = app (application-level logging)
 * - `m` = module (module-level logging)
 * - `t` = test (testing-related logging)
 */
export const logtapeConfiguration = async (
  appName = 'monochromatic',
): Promise<Parameters<typeof configure>[0]> => {
  const fileSink = await createFileSink(appName);
  return createBaseConfig(fileSink);
};

export { logtapeId } from './logtape.shared.ts';
