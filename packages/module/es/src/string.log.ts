import type {
  Promisable,
  UnknownRecord,
} from 'type-fest';
import { noop, } from './anys.noop.ts';
import { notUndefinedOrThrow, } from './error.throw.ts';
import { throws, } from './error.throws.ts';
import type { MonochromaticGlobalThis, } from './monochromatic.basic.ts';
import { partialStringReplaceAll, } from './string.replaceAll.ts';

export type StringRecord = Record<string, string>;

export type LoggerLogger = (message: string,
  record?: StringRecord | (() => Promisable<StringRecord>),) => unknown;

export type LoggerLevels = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type Logger = {
  trace: LoggerLogger;
  debug: LoggerLogger;
  info: LoggerLogger;
  warn: LoggerLogger;
  error: LoggerLogger;
  fatal: LoggerLogger;
};

export function getConsoleLoggerLogger(level: LoggerLevels,): LoggerLogger {
  const loggerLoggerLogger = (function getLoggerLoggerLogger(level: LoggerLevels,) {
    let myLoggerLoggerLogger: (message: string,) => unknown;
    switch (level) {
      case 'trace':
        {
          myLoggerLoggerLogger = console.trace;
        }
        break;
      case 'debug':
        {
          myLoggerLoggerLogger = console.debug;
        }
        break;
      case 'info':
        {
          myLoggerLoggerLogger = console.info;
        }
        break;
      case 'warn':
        {
          myLoggerLoggerLogger = console.warn;
        }
        break;
      case 'error':
        {
          myLoggerLoggerLogger = console.error;
        }
        break;
      case 'fatal': {
        myLoggerLoggerLogger = console.error;
      }
    }
    return myLoggerLoggerLogger;
  })(level,);

  return function myConsoleLoggerLogger(message: string,
    record?: StringRecord | (() => Promisable<StringRecord>),)
  {
    if (!record)
      loggerLoggerLogger(message,);
    const promisableRecord: Promisable<StringRecord> = typeof record === 'function'
      ? record()
      : notUndefinedOrThrow(record,);
    (async function asyncWrapper(
      { message, promisableRecord, }: { message: string;
        promisableRecord: Promisable<StringRecord>; },
    ) {
      const myRecord = await promisableRecord;
      const transforms = Object.entries(myRecord,).map(
        function toReplacementFunction([key, value,],) {
          return partialStringReplaceAll({ pattern: `{${key}}`, replacement: value, },);
        },
      );

      const replacedMessage: string = transforms.reduce(
        function executeTransform(message: string,
          transform: (message: string,) => string,)
        {
          return transform(message,);
        },
        message,
      );

      loggerLoggerLogger(replacedMessage,);
    })({ message, promisableRecord, },)
      .catch(throws,);
  };
}

export const consoleLogger: Logger = {
  trace: getConsoleLoggerLogger('trace',),
  debug: getConsoleLoggerLogger('debug',),
  info: getConsoleLoggerLogger('info',),
  warn: getConsoleLoggerLogger('warn',),
  error: getConsoleLoggerLogger('error',),
  fatal: getConsoleLoggerLogger('fatal',),
};

export const noopLogger: Logger = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
};

export function getDefaultLogger(): Logger {
  return (globalThis as MonochromaticGlobalThis).monochromatic?.logger
    ?? consoleLogger;
}
