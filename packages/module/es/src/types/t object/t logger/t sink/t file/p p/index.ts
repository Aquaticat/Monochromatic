import type {
  LogRecord,
  Sink,
  Verify,
} from '../../../t/index.ts';

/** Path to the current log file, set during verification. */
let filePath: string | null = null;

/** Caches verification result to avoid repeated checks. */
let verified = false;

/** Whether file system backend is available for logging. */
let available = false;

/**
 * Verifies file system is available (Node.js) and can write/read data.
 */
export const verify: Verify = async (): Promise<boolean> => {
  if (verified) return available;
  verified = true;

  try {
    // Dynamic import for Node.js modules
    const { appendFile, mkdir, readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');

    const LOG_DIR = join('node_modules', '.monochromatic');
    await mkdir(LOG_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replaceAll(':', '-');
    filePath = join(LOG_DIR, `${timestamp}.log.jsonl`);

    // Verify by writing and reading test data
    const testData = `{"test":true,"timestamp":${Date.now()}}\n`;
    await appendFile(filePath, testData);
    const content = await readFile(filePath, 'utf-8');
    available = content.includes('"test":true');
  } catch {
    available = false;
  }

  return available;
};

/**
 * File sink that writes log records to node_modules/.monochromatic/.
 */
export const $: Sink = async (record: LogRecord): Promise<void> => {
  if (!available || !filePath) return;

  try {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(filePath, JSON.stringify(record) + '\n');
  } catch {
    // Silently fail
  }
};
