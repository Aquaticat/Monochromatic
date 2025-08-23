import { doubleQuotes, } from 'src/type/custom/object/rangeInt/named/is/inside/index.ts';
import { unnamed as int, } from '../../../../../number/int/index.ts';
import { unnamed as rangeInt, } from '../../../../../object/rangeInt/index.ts';
import {
  unnamed as withCLikeBlockComments,
} from '../../../../withCLikeBlockComments/index.ts';

export function is(value: string,): value is withCLikeBlockComments.$ {
  // No need to escape here since c style comments don't support escaping
  // TODO: Write a correctly typed String.prototype.matchAll to avoid casting.
  const matches = Array.from(value.matchAll(/\/\*/g,),);

  if (matches.length === 0)
    return false;

  for (const match of matches) {
    const endInclusive = (match.index + (match.at(0,))!.length - 1) as int.$;
    const myRangeInt = { startInclusive: match.index as int.$,
      endInclusive, } as rangeInt.$;
    if (!doubleQuotes.$({ value: myRangeInt, str: value.slice(0, match.index,), },)) {
      // non-double-quotes-enclosed match
      return true;
    }
  }

  return false;
}