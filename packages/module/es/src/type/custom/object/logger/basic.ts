import type { Promisable, } from 'type-fest';
import { notUndefinedOrThrow, } from '../../../typeof/object/error/error.throw.ts';
import { throws, } from '../../../typeof/object/error/error.throws.ts';
import type {
  MonochromaticGlobalThis,
} from '../../../typeof/object/globalThis/monochromatic/basic.ts';
import { partialStringReplaceAll, } from '../../../typeof/string/string.replaceAll.ts';
import { neversNoop, } from '../../../typescript/never/noop.ts';

export type Logger_TemplateData = Record<string, string>;

export type Logger_Method = (message: string,
  record?: Logger_TemplateData | (() => Promisable<Logger_TemplateData>),) => unknown;

export type Logger_Level = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type Logger = {
  trace: Logger_Method;
  debug: Logger_Method;
  info: Logger_Method;
  warn: Logger_Method;
  error: Logger_Method;
  fatal: Logger_Method;
};

export function Logger_getConsoleFunction(
  level: Logger_Level,
): (message: string,) => unknown {
  let consoleFunction: (message: string,) => unknown;
  switch (level) {
    case 'trace':
      {
        consoleFunction = console.trace;
      }
      break;
    case 'debug':
      {
        consoleFunction = console.debug;
      }
      break;
    case 'info':
      {
        consoleFunction = console.info;
      }
      break;
    case 'warn':
      {
        consoleFunction = console.warn;
      }
      break;
    case 'error':
      {
        consoleFunction = console.error;
      }
      break;
    case 'fatal': {
      consoleFunction = console.error;
    }
  }
  return consoleFunction;
}

export function Logger_createMethod(level: Logger_Level,): Logger_Method {
  const consoleFunction = Logger_getConsoleFunction(level,);

  return function writeMethod(message: string,
    record?: Logger_TemplateData | (() => Promisable<Logger_TemplateData>),)
  {
    if (!record)
      consoleFunction(message,);
    const recordOrFactory: Promisable<Logger_TemplateData> = typeof record === 'function'
      ? record()
      : notUndefinedOrThrow(record,);
    (async function writeWithTemplates(
      { message, recordOrFactory, }: { message: string;
        recordOrFactory: Promisable<Logger_TemplateData>; },
    ) {
      const templateData = await recordOrFactory;
      const transforms = Object.entries(templateData,).map(
        function createReplacer([key, value,],) {
          return partialStringReplaceAll({ pattern: `{${key}}`, replacement: value, },);
        },
      );

      const replacedMessage: string = transforms.reduce(
        function applyReplacer(message: string,
          transform: (message: string,) => string,)
        {
          return transform(message,);
        },
        message,
      );

      consoleFunction(`${replacedMessage}, ${JSON.stringify(templateData,)}`,);
    })({ message, recordOrFactory, },)
      .catch(throws,);
  };
}

export const Logger_console: Logger = {
  trace: Logger_createMethod('trace',),
  debug: Logger_createMethod('debug',),
  info: Logger_createMethod('info',),
  warn: Logger_createMethod('warn',),
  error: Logger_createMethod('error',),
  fatal: Logger_createMethod('fatal',),
};

export const Logger_noop: Logger = {
  trace: neversNoop,
  debug: neversNoop,
  info: neversNoop,
  warn: neversNoop,
  error: neversNoop,
  fatal: neversNoop,
};

export function Logger_getDefault(): Logger {
  return (globalThis as MonochromaticGlobalThis).monochromatic?.logger
    ?? Logger_console;
}
