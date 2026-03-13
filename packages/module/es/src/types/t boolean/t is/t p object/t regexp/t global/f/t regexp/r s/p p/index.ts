import type { $ as Global, } from '@_/types/t object/t regexp/t global/t/index.ts';

/**
 * Type guard checking whether a RegExp has the global flag set.
 *
 * @param value - regexp to check
 *
 * @returns `true` when the regexp has the `g` flag
 */
export function $(value: RegExp,): value is Global {
  return value.global;
}
