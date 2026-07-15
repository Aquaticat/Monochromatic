export { createLogger, } from './create-logger.ts';
export {
  initPromise,
  logger,
} from './logger.ts';
export * as sinks from './sink/index.ts';
export { tagged, } from './tagged.ts';
export type {
  Level,
  Logger,
  LogRecord,
  Sink,
  SinkFlush,
  Verify,
} from './types.ts';
