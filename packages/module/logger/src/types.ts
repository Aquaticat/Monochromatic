/**
 * Log severity levels ordered from least to most severe.
 */
export type Level = 'debug' | 'error' | 'fatal' | 'info' | 'trace' | 'warn';

/**
 * Structured log record written to sinks.
 */
export type LogRecord = {
  readonly level: Level;
  readonly message: string;
  readonly timestamp: number;
};

/**
 * Optional drain hook for sinks that buffer records internally.
 * Called via logger-level `flush()` to force buffered work through
 * before a process exit, critical error boundary, or assertion.
 *
 * Always async: sinks whose drain is synchronous return an
 * already-resolved promise so callers `await` uniformly. A `void` arm is
 * not used; under the `no-optional-escape` rule `T | void` is a banned
 * fake-optional encoding, and there is no real synchronous value to carry.
 */
export type SinkFlush = () => Promise<void>;

/**
 * Sink that receives log records.
 * Sinks that buffer records (e.g. microtask-batched console) may
 * expose a `flush` hook so callers can force emission on demand.
 *
 * `write` is always async: a synchronous sink does its work eagerly and
 * returns an already-resolved promise, so the logger observes a uniform
 * `Promise<void>` (and can mark a sink unavailable when one rejects). A
 * `void` arm is not used, for the reason stated on `SinkFlush`.
 */
export type Sink = {
  flush?: SinkFlush;
  write: (record: LogRecord,) => Promise<void>;
};

/**
 * Verification function that checks if a sink backend is available.
 */
export type Verify = () => Promise<boolean> | boolean;

/**
 * Logger interface with 6 log levels plus `flush` for startup and sink drains.
 * `flush()` resolves once startup verification has completed, tracked sink
 * writes have settled, and every available sink's own `flush` hook has
 * settled. Safe to call even when no sink buffers.
 */
export type Logger = {
  readonly debug: (message: string,) => void;
  readonly error: (message: string,) => void;
  readonly fatal: (message: string,) => void;
  readonly flush: () => Promise<void>;
  readonly info: (message: string,) => void;
  readonly trace: (message: string,) => void;
  readonly warn: (message: string,) => void;
};
