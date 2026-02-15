import type { Promisable, } from 'type-fest';
import { unnamed, } from '../../type/custom/function/sink/index.ts';
import { notUndefinedOrThrow, } from '../../type/typeof/object/error/error.throw.ts';
import { throws, } from '../../type/typeof/object/error/error.throws.ts';
import type {
  MonochromaticGlobalThis,
} from '../../type/typeof/object/globalThis/monochromatic/basic.ts';
import { partialStringReplaceAll, } from '../../type/typeof/string/string.replaceAll.ts';
import { neversNoop, } from '../../type/typescript/never/noop.ts';

export type TemplateData = Record<string, string>;

export type Method = (message: string,
  record?: TemplateData | (() => Promisable<TemplateData>),) => unknown;

export type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type Logger = {
  trace: Method;
  debug: Method;
  info: Method;
  warn: Method;
  error: Method;
  fatal: Method;
};

export function getConsoleSinkUnnamedStringSync(
  level: Level,
): unnamed.$StringSync {
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

export function getMethod(level: Level,): Method {
  const consoleFunction = getConsoleSinkUnnamedStringSync(level,);

  return function writeMethod(message: string,
    record?: TemplateData | (() => Promisable<TemplateData>),)
  {
    if (!record)
      consoleFunction(message,);
    const recordOrFactory: Promisable<TemplateData> = typeof record === 'function'
      ? record()
      : notUndefinedOrThrow(record,);
    (async function writeWithTemplates(
      { message, recordOrFactory, }: { message: string;
        recordOrFactory: Promisable<TemplateData>; },
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

export const consoleLogger: Logger = {
  trace: getMethod('trace',),
  debug: getMethod('debug',),
  info: getMethod('info',),
  warn: getMethod('warn',),
  error: getMethod('error',),
  fatal: getMethod('fatal',),
};

export const noopLogger: Logger = {
  trace: neversNoop,
  debug: neversNoop,
  info: neversNoop,
  warn: neversNoop,
  error: neversNoop,
  fatal: neversNoop,
};

export function getDefaultLogger(): Logger {
  return (globalThis as MonochromaticGlobalThis).monochromatic?.logger
    ?? consoleLogger;
}

export type Logged = {
  l: Logger;
};
