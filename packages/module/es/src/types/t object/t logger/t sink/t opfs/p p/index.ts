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
 */
export async function verify(): Promise<boolean> {
  if (verified)
    return available;
  verified = true;

  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const timestamp = new Date().toISOString().replaceAll(':', '-',);
    const fileHandle = await opfsRoot.getFileHandle(
      `monochromatic-${timestamp}.log.jsonl`,
      { create: true, },
    );
    writable = await fileHandle.createWritable({ keepExistingData: true, },);

    // Verify by writing and reading test data
    const testData = `{"test":true,"timestamp":${Date.now()}}\n`;
    await writable.write(testData,);

    const file = await fileHandle.getFile();
    const content = await file.text();
    available = content.includes('"test":true',);
  }
  catch {
    available = false;
  }

  return available;
}

/**
 * OPFS sink that writes log records to Origin Private File System.
 */
export async function $(record: LogRecord,): Promise<void> {
  if (!available || !writable)
    return;

  try {
    await writable.write(JSON.stringify(record,) + '\n',);
  }
  catch {
    // Silently fail
  }
}
