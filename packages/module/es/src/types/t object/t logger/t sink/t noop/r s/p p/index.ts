import type {
  LogRecord,
  Sink,
  Verify,
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
 * Noop sink that discards all log records.
 *
 * @param _record - log record to discard
 *
 * @example
 * ```ts
 * $({ level: 'debug', message: 'discarded', tags: [], timestamp: Date.now() }); // no-op
 * ```
 */
export function $(_record: LogRecord,): void {
  // Intentionally empty - discards all logs
}
