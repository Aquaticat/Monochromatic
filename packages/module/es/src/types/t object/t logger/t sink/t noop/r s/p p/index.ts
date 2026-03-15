import type {
  LogRecord,
  Sink,
  Verify,
} from '../../../../t/index.ts';

/**
 * Noop sink is always available.
 *
 * @returns always true
 */
export function verify(): boolean {
  return true;
}

/**
 * Noop sink that discards all log records.
 *
 * @param _record - log record to discard
 */
export function $(_record: LogRecord,): void {
  // Intentionally empty - discards all logs
}
