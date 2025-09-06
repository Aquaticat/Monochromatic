import type { $ as Global, } from '@_/types/t object/t regexp/t global/t/index.ts';
import { $ as named, } from '../p n/index.ts';

export function $(str: string, trimmer: Global,): string {
  return named({ str, trimmer, },);
}
