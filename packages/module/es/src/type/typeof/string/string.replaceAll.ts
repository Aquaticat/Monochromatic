import type { Logged, } from '../../custom/object/logged/logged.basic.ts';
import {
  consoleLogger,
  type Logger,
} from '../../custom/object/logger/basic.ts';

type StringReplaceAllPattern = Parameters<typeof String.prototype.replaceAll>[0];

type StringReplaceAllReplacement = string | (() => string);

export function stringReplaceAll(
  { str, pattern, replacement, l = consoleLogger, }:
    & { str: string; pattern: StringReplaceAllPattern;
      replacement: StringReplaceAllReplacement; }
    & Partial<Logged>,
): string {
  l.debug(stringReplaceAll.name,);
  // @ts-expect-error -- TypeScript std lib types seems to be wrong. replaceAll does indeed accept string as 2nd param.
  return str.replaceAll(pattern, replacement,);
}

export function partialStringReplaceAll({
  pattern,
  replacement,
  l = consoleLogger,
}:
  & { pattern: StringReplaceAllPattern; replacement: StringReplaceAllReplacement; }
  & Partial<Logged>,): (str: string,) => string
{
  l.debug(partialStringReplaceAll.name,);
  return function partialedStringReplaceAll(str: string,): string {
    return stringReplaceAll({ str, pattern, replacement, l, },);
  };
}
