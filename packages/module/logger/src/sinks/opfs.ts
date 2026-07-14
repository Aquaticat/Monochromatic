import { reportLoggerInternalError, } from '../error-format.ts';

import type { Sink, } from '../types.ts';

/**
 * Builds an OPFS sink that appends JSONL records to a per-session file in the
 * Origin Private File System. The kept-open writable stream lives in this
 * instance's closure (no module-global state), so independent loggers and
 * tests never share a handle or need a reset hook. Each `write` awaits the
 * underlying stream write, so ordering holds at the record boundary and no
 * `flush` hook is needed.
 *
 * @returns Sink backed by OPFS.
 *
 * @example
 * ```ts
 * const { logger } = createLogger({ sinks: [createOpfsSink()] });
 * logger.warn('quota nearing limit');
 * ```
 */
export function createOpfsSink(): Sink {
  /**
   * Instance-local kept-open OPFS stream, opened by `verify` and reused by
   * every `write`. Absent until a successful verification.
   */
  const state: { writable?: FileSystemWritableFileStream; } = {};

  /**
   * Verifies OPFS is available and round-trips a probe write, then opens the
   * stream reused by subsequent writes. The logger calls this once and owns
   * the resulting availability.
   *
   * @returns Whether OPFS logging is available.
   */
  async function verify(): Promise<boolean> {
    try {
      /**
       * Origin Private File System directory handle that hosts every monochromatic log file.
       */
      const opfsRoot = await navigator.storage
        .getDirectory();
      /**
       * ISO timestamp with colons replaced by dashes so it can be embedded in a cross-platform file name.
       */
      const timestamp = new Date().toISOString()
        .replaceAll(
        ':',
        '-',
      );
      /**
       * OPFS handle for the per-run log file, created on first verification and reused for subsequent writes.
       */
      const fileHandle = await opfsRoot.getFileHandle(
        `monochromatic-${timestamp}.log.jsonl`,
        { create: true, },
      );
      // Write test data and close to flush; getFile() reads stale content
      // while a FileSystemWritableFileStream is still open.
      /**
       * Throwaway writable used only to flush the probe so the next `getFile` returns persisted content.
       */
      const probeWritable = await fileHandle.createWritable({ keepExistingData: true, },);
      /**
       * Probe record written and read back to confirm OPFS round-trips writes.
       */
      const testData = `{"test":true,"timestamp":${Date.now()}}\n`;
      await probeWritable.write(testData,);
      await probeWritable.close();

      /**
       * File snapshot of the probe, taken after closing `probeWritable` so its bytes are flushed.
       */
      const file = await fileHandle.getFile();
      /**
       * Probe contents read back; matching the literal `"test":true` proves OPFS persisted the data.
       */
      const content = await file.text();
      /**
       * Whether the probe round-tripped; only then is the reused stream opened.
       */
      const available = content.includes('"test":true',);

      if (available)
        // Reopen for subsequent log writes.
        state.writable = await fileHandle.createWritable({ keepExistingData: true, },);

      return available;
    }
    catch (error: unknown) {
      /**
       * OPFS storage object, present only when the current platform exposes the backend this sink verifies.
       */
      const opfsStorage = globalThis.navigator
        ?.storage;
      if ((opfsStorage !== undefined) && ('getDirectory' in opfsStorage))
        reportLoggerInternalError({
          context: 'OPFS sink verification failed',
          error,
        },);
      return false;
    }
  }

  /**
   * Writes a single record as a JSONL line to the OPFS stream.
   *
   * @param record - Log record to write.
   *
   * @mutates record - `JSON.stringify` may invoke `toJSON`, getters, or proxy traps.
   */
  async function write(record: object,): Promise<void> {
    if (!state.writable)
      return;

    try {
      await state.writable
        .write(`${JSON.stringify(record,)}\n`,);
    }
    catch (error: unknown) {
      reportLoggerInternalError({
        context: 'OPFS sink record write failed',
        error,
      },);
    }
  }

  return {
    verify,
    write,
  };
}
