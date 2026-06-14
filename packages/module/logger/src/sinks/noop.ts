import type {
  LogRecord,
  Sink,
} from '../types.ts';

/**
 * Noop sink is always available.
 *
 * @returns always true
 *
 * @example
 * ```ts
 * verifyNoop(); // true
 * ```
 */
export function verifyNoop(): boolean {
  return true;
}

/**
 * Discards a log record. Matches the `Sink['write']` signature.
 *
 * @param _record - log record to discard
 */
function write(_record: LogRecord,): Promise<void> {
  // Intentionally discards all logs; resolves immediately to match the async Sink contract
  return Promise.resolve();
}

/**
 * Noop sink that discards all log records. Exposes no `flush` because
 * there is nothing to drain.
 *
 * @example
 * ```ts
 * noopSink.write({ level: 'debug', message: 'discarded', timestamp: Date.now() }); // no-op
 * ```
 */
export const noopSink: Sink = {
  verify: verifyNoop,
  write,
};
