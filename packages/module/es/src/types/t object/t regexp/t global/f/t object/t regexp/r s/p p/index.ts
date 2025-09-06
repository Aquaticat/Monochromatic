import type {$ as Global} from '../../../../../t/index.ts';

export function $(regexp: RegExp): Global {
  return new RegExp(regexp.source, regexp.flags.includes('g') ? regexp.flags : `${regexp.flags}g`) as Global;
}
