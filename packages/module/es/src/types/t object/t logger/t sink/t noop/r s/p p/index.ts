import type {
  LogRecord,
  Sink,
  Verify,
} from '../../../../t/index.ts';

/**
 * Noop sink is always available.
 */
export function verify(): boolean { return true }

/**
 * Noop sink that discards all log records.
 */
export function $(_record: LogRecord): void {
  // Intentionally empty - discards all logs
}
