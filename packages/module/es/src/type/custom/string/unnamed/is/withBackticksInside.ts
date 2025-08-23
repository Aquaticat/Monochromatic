import type { $ as withSingleQuotesInside, } from '../../withSingleQuotesInside/unnamed/type.ts';

// First encountered quote wins.
export function $(value: string,): value is withSingleQuotesInside {
  const firstMatchArray = value.match(/(?<!\\)(?:\\\\)*["'`]/,);
  if (!firstMatchArray) {
    return false;
  }
  const [firstMatch] = firstMatchArray;

  return (firstMatch === "'")
}
