import type {$ as Global} from '@_/types/t object/t regexp/t global/t/index.ts';

export function $(value: RegExp): value is Global {
  return value.global;
}
