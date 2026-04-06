import type {
  LogRecord,
  Sink,
  Verify,
} from '../../../t/index.ts';

/** Writable stream to the OPFS log file, kept open for performance. */
let writable: FileSystemWritableFileStream | null = null;

/** Caches verification result to avoid repeated checks. */
let verified = false;

/** Whether OPFS backend is available for logging. */
let available = false;

/**
 * Verifies OPFS is available and can write/read data.
 *
 * @returns whether OPFS logging is available
 *
 * @example
 * ```ts
 * if (await verify()) {
 *   await $(logRecord);
 * }
 * ```
 */
export async function verify(): Promise<boolean> {
  if (verified)
    return available;
  verified = true;

  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const timestamp = new Date().toISOString().replaceAll(
      ':',
      '-',
    );
    const fileHandle = await opfsRoot.getFileHandle(
      `monochromatic-${timestamp}.log.jsonl`,
      { create: true, },
    );
    // Write test data and close to flush; getFile() reads stale content
    // while a FileSystemWritableFileStream is still open
    const probeWritable = await fileHandle.createWritable({ keepExistingData: true, },);
    const testData = `{"test":true,"timestamp":${Date.now()}}\n`;
    await probeWritable.write(testData,);
    await probeWritable.close();

    const file = await fileHandle.getFile();
    const content = await file.text();
    available = content.includes('"test":true',);

    // Reopen for subsequent log writes
    writable = await fileHandle.createWritable({ keepExistingData: true, },);
  }
  catch {
    available = false;
  }

  return available;
}

/**
 * OPFS sink that writes log records to Origin Private File System.
 *
 * @param record - log record to write
 *
 * @example
 * ```ts
 * await $({ level: 'warn', message: 'quota nearing limit', tags: ['storage'], timestamp: Date.now() });
 * ```
 */
export async function $(record: LogRecord,): Promise<void> {
  if (!available || !writable)
    return;

  try {
    await writable.write(`${JSON.stringify(record,)}\n`,);
  }
  catch {
    // Silently fail
  }
}
