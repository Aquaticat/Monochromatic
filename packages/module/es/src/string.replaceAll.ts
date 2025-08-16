import {
  consoleLogger,
  type Logger,
} from './string.log';

type StringReplaceAllPattern = Parameters<typeof String.prototype.replaceAll>[0];

type StringReplaceAllReplacement = string | (() => string);

export function stringReplaceAll(
  { str, pattern, replacement, l = consoleLogger, }: { str: string;
    pattern: StringReplaceAllPattern; replacement: StringReplaceAllReplacement;
    l: Logger; },
): string {
  l.trace(`stringReplaceAll`,);
  // @ts-expect-error -- TypeScript std lib types seems to be wrong. replaceAll does indeed accept string as 2nd param.
  return str.replaceAll(pattern, replacement,);
}

export function partialStringReplaceAll({
  pattern,
  replacement,
  l = consoleLogger,
}: { pattern: StringReplaceAllPattern; replacement: StringReplaceAllReplacement;
  l: Logger; },): (str: string,) => string
{
  l.trace(`partialStringReplaceAll`,);
  return function partialedStringReplaceAll(str: string,): string {
    return stringReplaceAll({ str, pattern, replacement, l, },);
  };
}
