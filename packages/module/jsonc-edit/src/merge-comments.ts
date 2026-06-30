import type { JsoncComment, } from './comment.ts';

/**
 * Merges two optional comments into one, the way stacked comments against a
 * single node collapse during parsing.
 *
 * Returns `undefined` when both inputs are absent, the present one when only one
 * is, and a combined comment when both exist. Combined bodies join with a single
 * newline and are left untrimmed so `//region` and indentation conventions
 * survive. The combined type is the shared type, or `mixed` when the two differ.
 *
 * @param first - Earlier comment, or `undefined`.
 *
 * @param second - Later comment, or `undefined`.
 *
 * @returns Merged comment, the single present comment, or `undefined`.
 *
 * @example
 * ```ts
 * mergeComments({
 *   first: { type: 'block', text: 'region' },
 *   second: { type: 'inline', text: ' note' },
 * });
 * // => { type: 'mixed', text: 'region\n note' }
 * ```
 */
export function mergeComments({
  first,
  second,
}: {
  first?: JsoncComment | undefined;
  second?: JsoncComment | undefined;
},): JsoncComment | undefined {
  if (first === undefined)
    return second;
  if (second === undefined)
    return first;

  /**
   * Joined body keeping a newline between the two original comment bodies.
   */
  const text = `${first.text}\n${second.text}`;
  /**
   * Shared type when both comments agree, otherwise `mixed`.
   */
  const type = (first.type === second.type)
    ? first.type
    : 'mixed';
  return {
    type,
    text,
  };
}
