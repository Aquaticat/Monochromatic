import type {
  LogRecord,
  Sink,
  Verify,
} from '../../../t/index.ts';

/** Cached `appendFile` from `node:fs/promises`, set during verification. */
let appendFile: typeof import('node:fs/promises').appendFile | null = null;

/** Path to the current log file, set during verification. */
let filePath: string | null = null;

/** Caches verification result to avoid repeated checks. */
let verified = false;

/** Whether file system backend is available for logging. */
let available = false;

/**
 * Verifies file system is available (Node.js) and can write/read data.
 * Short-circuits in non-Node environments to prevent browsers from
 * attempting to fetch `node:` protocol URLs (which triggers CORS errors
 * even though the resulting exception is caught).
 *
 * @returns whether file system logging is available
 */
export async function verify(): Promise<boolean> {
  if (verified)
    return available;
  verified = true;

  // Guard: skip dynamic import entirely outside Node.js to avoid
  // browser console errors from attempting to fetch node: URLs
  if (globalThis.process === undefined
    || globalThis.process.versions?.node === undefined)
  {
    available = false;
    return false;
  }

  try {
    // Dynamic import for Node.js modules -- cache appendFile for use in $()
    const fs = await import('node:fs/promises');
    const { join, } = await import('node:path');

    ({ appendFile, } = fs);

    const LOG_DIR = join(
      'node_modules',
      '.monochromatic',
    );
    await fs.mkdir(
      LOG_DIR,
      { recursive: true, },
    );

    const timestamp = new Date().toISOString().replaceAll(
      ':',
      '-',
    );
    filePath = join(
      LOG_DIR,
      `${timestamp}.log.jsonl`,
    );

    // Verify by writing and reading test data
    const testData = `{"test":true,"timestamp":${Date.now()}}\n`;
    await appendFile(
      filePath,
      testData,
    );
    const content = await fs.readFile(
      filePath,
      'utf8',
    );
    available = content.includes('"test":true',);
  }
  catch {
    available = false;
  }

  return available;
}

/**
 * File sink that writes log records to node_modules/.monochromatic/.
 * Uses cached `appendFile` from verification -- no dynamic import needed here.
 *
 * @param record - log record to write
 */
export async function $(record: LogRecord,): Promise<void> {
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- filePath is string|null, checking both conditions
  if (!available || !filePath || !appendFile)
    return;

  try {
    await appendFile(
      filePath,
      `${JSON.stringify(record,)}\n`,
    );
  }
  catch (error) {
    console.error(
      `logger internal error in fs sink ${
        (Error.isError(error,))
          ? error.message
          : 'unknown non-Error error'
      }`,
    );
  }
}
