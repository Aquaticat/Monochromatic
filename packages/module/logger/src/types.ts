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
 */
export type SinkFlush = () => Promise<void> | void;

/**
 * Sink that receives log records.
 * Sinks that buffer records (e.g. microtask-batched console) may
 * expose a `flush` hook so callers can force emission on demand.
 */
export type Sink = {
  flush?: SinkFlush;
  write: (record: LogRecord,) => Promise<void> | void;
};

/**
 * Verification function that checks if a sink backend is available.
 */
export type Verify = () => Promise<boolean> | boolean;

/**
 * Logger interface with 6 log levels plus `flush` for sinks that buffer.
 * `flush()` resolves once every available sink's own `flush` hook has
 * settled; sinks without a hook are skipped. Safe to call even when no
 * sink buffers; resolves immediately.
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
