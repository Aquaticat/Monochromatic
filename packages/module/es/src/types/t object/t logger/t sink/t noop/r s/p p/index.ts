import type {
  LogRecord,
  Sink,
  Verify,
} from '../../../../t/index.ts';

/**
 * Noop sink is always available.
 */
export const verify: Verify = (): boolean => true;

/**
 * Noop sink that discards all log records.
 */
export const $: Sink = (_record: LogRecord): void => {
  // Intentionally empty - discards all logs
};
