import type { $ as Global, } from '../../../../../t/index.ts';

/**
 * Ensures a regular expression has the global flag set.
 * 
 * Creates a new RegExp instance with the global flag added to the existing flags.
 * This is useful when you need to ensure a regexp will match all occurrences
 * rather than stopping after the first match.
 * 
 * @param regexp - Regular expression to convert to global
 * @returns New RegExp instance with global flag enabled
 * 
 * @example
 * ```ts
 * const local = /abc/i;
 * const global = $({ regexp: local }); // /abc/gi
 * ```
 */
export function $({ regexp, }: { regexp: RegExp; },): Global {
  return new RegExp(regexp.source,
    regexp.flags.includes('g',) ? regexp.flags : `${regexp.flags}g`,) as Global;
}