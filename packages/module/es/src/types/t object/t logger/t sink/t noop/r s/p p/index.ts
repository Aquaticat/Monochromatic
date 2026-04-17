import type {
  LogRecord,
  Sink,
} from '../../../../t/index.ts';

/**
 * Noop sink is always available.
 *
 * @returns always true
 *
 * @example
 * ```ts
 * verify(); // true
 * ```
 */
export function verify(): boolean {
  return true;
}

/**
 * Discards a log record. Matches the `Sink['write']` signature.
 *
 * @param _record - log record to discard
 */
function write(_record: LogRecord,): void {
  // Intentionally empty - discards all logs
}

/**
 * Noop sink that discards all log records. Exposes no `flush` because
 * there is nothing to drain.
 *
 * @example
 * ```ts
 * $.write({ level: 'debug', message: 'discarded', timestamp: Date.now() }); // no-op
 * ```
 */
export const $: Sink = {
  write,
};
