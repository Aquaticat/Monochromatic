/**
 Assemble ordered parser-owned source replacements without copying a growing accumulator.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';

//region Ordered original source spans produce disjoint output fragments

/**
 Original token order establishes disjoint source spans before this assembly boundary.
 */
export type NativeSourceEdit = {
  /**
   First original UTF-16 code unit replaced by this edit.
   */
  readonly start: number;
  /**
   First original UTF-16 code unit after this edit.
   */
  readonly end: number;
  /**
   Replacement already encoded for its destination JavaScript syntax.
   */
  readonly text: string;
};

/**
 Source assembly diagnostics remain separate from the selection of original native edits.
 */
const l = tagged({ tag: 'auto-mode-native-build-spans' });

/**
 Join ordered parser-owned edits while copying every untouched source segment once.

 @param source - original source supplying parser coordinates

 @param edits - disjoint replacement spans already ordered by original tokens

 @returns source with the selected encoded replacements

 @example
 ```ts
 applyNativeSourceEdits({ source: 'old();', edits: [{ start: 0, end: 3, text: 'owned' }] });
 ```
 */
export function applyNativeSourceEdits({
  source,
  edits
}: {
  readonly source: string;
  readonly edits: readonly NativeSourceEdit[];
}): string {
  /**
   Fragment assembly retains its own diagnostic boundary.
   */
  const rl = tagged({
    tag: applyNativeSourceEdits.name,
    l
  });
  rl.debug(`assembling ${edits.length} original source edits`);
  /**
   Each untouched interval and replacement is copied once before the final join.
   */
  const fragments = edits.flatMap(function sourceFragments(
    edit,
    index
  ): readonly string[] {
    return [
      source.slice(
        edits[index - 1]
          ?.end
          ?? 0,
        edit.start
      ),
      edit.text
    ];
  });
  fragments.push(source.slice(edits.at(-1)
    ?.end
    ?? 0));
  return fragments.join('');
}

//endregion Ordered original source spans produce disjoint output fragments
