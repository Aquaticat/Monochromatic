import type { IndexPair, } from './pair-agreement.ts';

//region Index pair list
// The shape every pairing answer and its cache record share: a list of
// correspondences, each naming one index on each side. The block pairing
// reader (`pair-blocks-wire.ts`), the section pairing reader
// (`pair-sections-read.ts`) and the slice cache (`slice-cache-store.ts`) each
// kept their own copy of this test (audit area six, 2026-09-28); a cache that
// accepted what the wire refuses would hand a stage a pairing no model gave.

/**
 Whether a parsed value is a list of correspondences.

 SHAPE ONLY. What a pairing must satisfy against the blocks or sections it
 describes is each reader's own question.

 @param value - candidate list, still unknown in type

 @returns Whether it is an array whose every entry names two integer indices

 @example
 ```ts
 isIndexPairList([{ source: 0, target: 0, },],); // true
 isIndexPairList([{ source: 0, target: 1.5, },],); // false
 ```
 */
export function isIndexPairList(value: unknown,): value is readonly IndexPair[] {
  if (!Array.isArray(value,))
    return false;
  return value.every(function isPair(entry: unknown,): boolean {
    if ((typeof entry) !== 'object')
      return false;
    if (entry === null)
      return false;
    if (!('source' in entry))
      return false;
    if (!('target' in entry))
      return false;

    /**
     Candidate indices, still unknown in type.
     */
    const {
      source,
      target,
    } = entry;
    return Number.isInteger(source,) && Number.isInteger(target,);
  },);
}

//endregion Index pair list
