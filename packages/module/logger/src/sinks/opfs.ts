import type {
  LogRecord,
  Sink,
} from '../types.ts';

/**
 * Module-local mutable state grouped in a `const` container so module-root
 * state stays out of a top-level `let` (`no-module-root-let` would otherwise
 * reject it). `writable` is the kept-open OPFS stream reused across writes;
 * `verified` short-circuits repeat verification; `available` flips false on
 * a failed verification or a runtime throw.
 */
const state: {
  writable: FileSystemWritableFileStream | null;
  verified: boolean;
  available: boolean;
} = {
  available: false,
  verified: false,
  writable: null,
};

/**
 * Verifies OPFS is available and can write/read data.
 *
 * @returns whether OPFS logging is available
 *
 * @example
 * ```ts
 * if (await verifyOpfs()) {
 *   await opfsSink.write(logRecord);
 * }
 * ```
 */
export async function verifyOpfs(): Promise<boolean> {
  if (state.verified)
    return state.available;
  state.verified = true;

  try {
    /** Origin Private File System directory handle that hosts every monochromatic log file. */
    const opfsRoot = await navigator.storage
      .getDirectory();
    /** ISO timestamp with colons replaced by dashes so it can be embedded in a cross-platform file name. */
    const timestamp = new Date().toISOString()
      .replaceAll(
      ':',
      '-',
    );
    /** OPFS handle for the per-run log file, created on first verification and reused for subsequent writes. */
    const fileHandle = await opfsRoot.getFileHandle(
      `monochromatic-${timestamp}.log.jsonl`,
      { create: true, },
    );
    // Write test data and close to flush; getFile() reads stale content
    // while a FileSystemWritableFileStream is still open
    /** Throwaway writable used only to flush the probe so the next `getFile` returns persisted content. */
    const probeWritable = await fileHandle.createWritable({ keepExistingData: true, },);
    /** Probe record written and read back to confirm OPFS round-trips writes. */
    const testData = `{"test":true,"timestamp":${Date.now()}}\n`;
    await probeWritable.write(testData,);
    await probeWritable.close();

    /** File snapshot of the probe, taken after closing `probeWritable` so its bytes are flushed. */
    const file = await fileHandle.getFile();
    /** Probe contents read back; matching the literal `"test":true` proves OPFS persisted the data. */
    const content = await file.text();
    state.available = content.includes('"test":true',);

    // Reopen for subsequent log writes
    state.writable = await fileHandle.createWritable({ keepExistingData: true, },);
  }
  catch {
    state.available = false;
  }

  return state.available;
}

/**
 * Writes a single record as a JSONL line to the OPFS stream.
 *
 * @param record - log record to write
 */
async function write(record: LogRecord,): Promise<void> {
  if ((!state.available) || (!state.writable))
    return;

  try {
    await state.writable
      .write(`${JSON.stringify(record,)}\n`,);
  }
  catch {
    // Silently fail
  }
}

/**
 * OPFS sink that writes log records to Origin Private File System.
 * No `flush` hook: each `write` awaits the underlying stream write, so
 * ordering is already guaranteed at the record boundary.
 *
 * @example
 * ```ts
 * await opfsSink.write({ level: 'warn', message: 'quota nearing limit', timestamp: Date.now() });
 * ```
 */
export const opfsSink: Sink = {
  write,
};
