import { reportLoggerInternalError, } from '../error-format.ts';
import { detectSessionStorageQuotaChars, } from './session-storage-quota.ts';

import type { Sink, } from '../types.ts';

/**
 * Prefix for sessionStorage keys to namespace log entries.
 */
const STORAGE_KEY_PREFIX = 'monochromatic.log';

/**
 * Error `name` values engines raise for a storage quota overflow: the DOM
 * standard name every current browser and Node web storage use, plus Firefox's
 * legacy alias. Quota overflow is matched by `name` rather than by class or
 * numeric `code` because the concrete type differs by engine (a `DOMException`
 * in Chromium and Node, a differently-branded object historically in Firefox),
 * while the standard name is stable across them.
 */
const QUOTA_EXCEEDED_NAMES: ReadonlySet<string> = new Set([
  'QuotaExceededError',
  'NS_ERROR_DOM_QUOTA_REACHED',
]);

/**
 * Builds the namespaced sessionStorage key for a log entry at `index`.
 *
 * @param index - Zero-based slot number of an entry.
 *
 * @returns Prefixed key such as `monochromatic.log.3`.
 *
 * @example
 * ```ts
 * storageKey(3); // 'monochromatic.log.3'
 * ```
 */
function storageKey(index: number,): string {
  return `${STORAGE_KEY_PREFIX}.${index}`;
}

/**
 * Reports whether a caught `setItem` value is a storage quota overflow, so
 * eviction reclaims space only for a full store and never for an unrelated
 * write fault such as a disabled-storage `SecurityError`.
 *
 * @param error - Caught value from a `setItem` failure.
 *
 * @returns Whether `error` names a quota overflow.
 *
 * @example
 * ```ts
 * try { sessionStorage.setItem(k, v); }
 * catch (error: unknown) { if (isQuotaExceededError(error)) evictOldest(); }
 * ```
 */
function isQuotaExceededError(error: unknown,): boolean {
  return (
    ((typeof error) === 'object')
    && (error !== null)
      && ('name' in error)
      && ((typeof error.name) === 'string')
      && QUOTA_EXCEEDED_NAMES.has(error.name,)
  );
}

/**
 * Verifies sessionStorage actually persists data. Stateless: the logger calls
 * this once per sink at startup and owns the resulting availability, so no
 * verified/available flag is kept here.
 *
 * @returns Whether sessionStorage is available and round-trips a probe write.
 *
 * @example
 * ```ts
 * if (await verifySessionStorage()) {
 *   // sessionStorage usable
 * }
 * ```
 */
function verifySessionStorage(): Promise<boolean> {
  try {
    /**
     * Sentinel key used only for the probe write/read; removed afterward to avoid polluting real log entries.
     */
    const testKey = '__monochromatic_verify__';
    /**
     * Timestamp-based probe value so concurrent verifications never read each other's writes.
     */
    const testValue = `test-${Date.now()}`;
    globalThis.sessionStorage
      .setItem(
      testKey,
      testValue,
    );
    /**
     * Probe value read back from storage; equality with `testValue` proves writes actually persist.
     */
    const readBack = globalThis.sessionStorage
      .getItem(testKey,);
    globalThis.sessionStorage
      .removeItem(testKey,);
    return Promise.resolve(readBack === testValue,);
  }
  catch (error: unknown) {
    if ('sessionStorage' in globalThis)
      reportLoggerInternalError({
        context: 'sessionStorage sink verification failed',
        error,
      },);
    return Promise.resolve(false,);
  }
}

/**
 * Builds a sessionStorage sink that writes each record under a
 * counter-incremented key. The line counter lives in this instance's closure
 * (no module-global state), so independent loggers and tests never share keys
 * or need a reset hook. Writes persist immediately, so no `flush` hook is
 * exposed.
 *
 * The write caps the sink's own footprint at half the runtime's sessionStorage
 * quota, proactively dropping its oldest entries, and reactively drops them
 * again if the real store overflows; see {@link createSessionStorageSink.write}.
 *
 * @returns Sink backed by browser `sessionStorage`.
 *
 * @example
 * ```ts
 * const { logger } = createLogger({ sinks: [createSessionStorageSink()] });
 * logger.info('user signed in');
 * ```
 */
export function createSessionStorageSink(): Sink {
  /**
   * Instance-local write cursor, eviction watermark, and footprint tally.
   * `lineCounter` is the next slot to write and advances only when a `setItem`
   * actually lands, so this sink's present entries occupy the contiguous range
   * `[oldestIndex, lineCounter)`. `oldestIndex` is the lowest slot the sink
   * still owns; eviction removes that entry and climbs `oldestIndex` toward
   * `lineCounter`, so `oldestIndex < lineCounter` doubles as the "a prior write
   * succeeded and an owned entry remains" guard that keeps eviction from ever
   * touching another origin consumer's keys. `usedChars` tracks the code units
   * this sink currently occupies so the half-quota cap needs no re-summing.
   * `reportedFailure` gates the give-up diagnostic to once per failure episode:
   * a persistently full store (another writer owning the space) would otherwise
   * emit one `console.warn` per log call, so the flag stays set until a write
   * next lands, which re-arms a single report for the next episode.
   */
  const state: {
    lineCounter: number;
    oldestIndex: number;
    usedChars: number;
    reportedFailure: boolean;
  } = {
    lineCounter: 0,
    oldestIndex: 0,
    usedChars: 0,
    reportedFailure: false,
  };

  /**
   * Half the detected runtime sessionStorage quota, in UTF-16 code units, or
   * `Number.POSITIVE_INFINITY` on an unrecognized runtime. The sink keeps its
   * own footprint at or below this so the logger never claims more than half
   * the store, leaving the rest for the host application. An infinite cap
   * disables the proactive check, leaving only reactive quota-error eviction.
   */
  const capChars = detectSessionStorageQuotaChars() / 2;

  /**
   * Removes this sink's oldest still-present entry, advancing the watermark and
   * subtracting the reclaimed entry's code units from the running footprint.
   * Reading the value back before removal keeps `usedChars` honest even if the
   * entry drifted from what was written.
   */
  function evictOldest(): void {
    /**
     * Key of the oldest owned entry, removed to reclaim its slot and its space.
     */
    const key = storageKey(state.oldestIndex,);
    /**
     * Value being evicted, read back so its length can leave the footprint tally.
     */
    const evicted = globalThis.sessionStorage
      .getItem(key,);
    globalThis.sessionStorage
      .removeItem(key,);
    state.oldestIndex++;
    if (evicted !== null)
      state.usedChars = Math.max(
        0,
        state.usedChars - evicted.length,
      );
  }

  /**
   * Persists a log record to sessionStorage under a counter-incremented key.
   *
   * First it proactively drops its own oldest entries so its footprint stays at
   * or below half the runtime's sessionStorage quota, leaving the rest for the
   * host application. It then writes, and on a quota overflow (the store being
   * fuller than the cap accounts for), and only while an owned entry remains
   * (so the reclaimed keys are its own, never another origin consumer's), it
   * drops its oldest still-present entry and retries until the record fits or
   * nothing of its own remains to drop. A record larger than the whole quota
   * therefore evicts every owned entry, then reports and gives up rather than
   * looping forever. A non-quota failure is reported without any eviction. The
   * logger only writes to verified-available sinks, so no availability guard is
   * needed here.
   *
   * @param record - Log record to persist.
   *
   * @mutates record - `JSON.stringify` may invoke `toJSON`, getters, or proxy traps.
   */
  function write(record: object,): Promise<void> {
    /**
     * Serialized record; computed once so eviction retries re-set the same value without re-stringifying.
     */
    const serialized = JSON.stringify(record,);
    /**
     * Code units this record adds; the key's length is left out as a negligible near-constant.
     */
    const recordChars = serialized.length;

    // Proactively reclaim space so the sink's own footprint stays under the
    // half-quota cap, dropping oldest-first while an owned entry remains. An
    // infinite cap (unrecognized runtime) makes the guard always false.
    while ((state.oldestIndex < state.lineCounter) && ((state.usedChars + recordChars) > capChars)) {
      evictOldest();
    }

    // Side-effecting retry cursor over the mutable `state` object (the repo's
    // function-root-let-free loop shape): try the current slot, and on a quota
    // overflow with an owned entry still present, drop the oldest and retry.
    // Bounded by the count of owned entries, so it always terminates.
    while (true) {
      try {
        globalThis.sessionStorage
          .setItem(
          storageKey(state.lineCounter,),
          serialized,
        );
        state.lineCounter++;
        state.usedChars += recordChars;
        // A landed write re-arms a single give-up report for the next episode.
        state.reportedFailure = false;
        return Promise.resolve();
      }
      catch (error: unknown) {
        if (isQuotaExceededError(error,) && (state.oldestIndex < state.lineCounter)) {
          evictOldest();
          continue;
        }
        // Report once per failure episode, not once per unwritable record, so a
        // persistently full store does not flood the console every log call.
        if (!state.reportedFailure) {
          reportLoggerInternalError({
            context: 'sessionStorage sink record write failed (repeats suppressed until a write next succeeds)',
            error,
          },);
          state.reportedFailure = true;
        }
        return Promise.resolve();
      }
    }
  }

  return {
    verify: verifySessionStorage,
    write,
  };
}
