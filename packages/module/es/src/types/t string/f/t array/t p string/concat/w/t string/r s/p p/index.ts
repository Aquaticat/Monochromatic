import {$ as named} from '../p n/index.ts';

export function $(strings: string[], concatWith: string): string {
  return named({strings, concatWith});
}
