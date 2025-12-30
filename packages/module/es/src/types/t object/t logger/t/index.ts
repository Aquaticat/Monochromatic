/**
 * Log severity levels ordered from least to most severe.
 */
export type Level = 'debug' | 'error' | 'fatal' | 'info' | 'trace' | 'warn';

/**
 * Structured log record written to sinks.
 */
export type LogRecord = {
  level: Level;
  message: string;
  timestamp: number;
};

/**
 * Sink function that receives log records.
 */
export type Sink = (record: LogRecord) => Promise<void> | void;

/**
 * Verification function that checks if a sink backend is available.
 */
export type Verify = () => Promise<boolean> | boolean;

/**
 * Logger interface with 6 log levels.
 */
export type $ = {
  debug: (message: string) => void;
  error: (message: string) => void;
  fatal: (message: string) => void;
  info: (message: string) => void;
  trace: (message: string) => void;
  warn: (message: string) => void;
};
