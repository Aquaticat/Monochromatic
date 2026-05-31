/**
 * Utility functions for LSP selection range chain processing.
 *
 * Flattening, comparison, and coordinate conversion for the
 * nested {@link SelectionRange} chains returned by the server.
 * Split from app-lsp-selection.ts to stay under max-lines.
 */

import type { SelectionRange, } from '../../../protocol.ts';

/**
 * Range coordinates used for comparison.
 */
export type FlatRange = {
  readonly startLine: number;
  readonly startCharacter: number;
  readonly endLine: number;
  readonly endCharacter: number;
};

/**
 * Flattens the nested `parent` chain of a {@link SelectionRange} into
 * a flat array ordered from innermost to outermost scope.
 *
 * @param root - top of the nested chain returned by the server
 *
 * @returns flat array where index 0 is the innermost range
 *
 * @example
 * ```ts
 * const result = flattenChain({ root: '/home/user/project', });
 * ```
 */
export function flattenChain({ root, }: { readonly root: SelectionRange; },): SelectionRange[] {
  /**
   * Accumulator filled by walking the parent chain below.
   */
  const result: SelectionRange[] = [];
  /**
   * Walker cursor; undefined exits the loop.
   */
  let current: SelectionRange | undefined = root;
  while (current !== undefined) {
    result.push(current,);
    current = current.parent;
  }
  return result;
}

/**
 * Checks whether range `outer` strictly contains range `inner`
 * (i.e. outer is larger and fully encloses inner).
 *
 * @param outer - candidate larger range
 *
 * @param inner - candidate smaller range
 *
 * @returns true if outer strictly contains inner
 *
 * @example
 * ```ts
 * const result = strictlyContains({ outer: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } }, inner: { start: { line: 2, character: 5 }, end: { line: 2, character: 15 } }, });
 * ```
 */
export function strictlyContains(
  {
    outer,
    inner,
  }: {
    readonly outer: FlatRange;
    readonly inner: FlatRange;
  },
): boolean {
  /**
   * True when outer's start is strictly earlier than inner's start.
   */
  const outerStartBefore = (outer.startLine
    < inner
    .startLine)
    || ((outer.startLine
      === inner
      .startLine)
      && (outer.startCharacter
        < inner
        .startCharacter));
  /**
   * True when outer's end is strictly later than inner's end.
   */
  const outerEndAfter = (outer.endLine
    > inner
    .endLine)
    || ((outer.endLine
      === inner
      .endLine) && (outer.endCharacter
        > inner
        .endCharacter));
  /**
   * True when starts coincide; pairs with {@link outerEndAfter} for the "extends end only" case.
   */
  const outerStartSame = (outer.startLine
    === inner
    .startLine)
    && (outer.startCharacter
      === inner
      .startCharacter);
  /**
   * True when ends coincide; pairs with {@link outerStartBefore} for the "extends start only" case.
   */
  const outerEndSame = (outer.endLine
    === inner
    .endLine)
    && (outer.endCharacter
      === inner
      .endCharacter);

  /**
   * Strictly larger: at least one boundary must differ outward.
   */
  if (outerStartBefore && outerEndAfter)
    return true;
  if (outerStartBefore && outerEndSame)
    return true;
  if (outerStartSame && outerEndAfter)
    return true;
  return false;
}

/**
 * Converts a {@link SelectionRange} to flat coordinates for comparison.
 *
 * @param sr - selection range from the chain
 *
 * @returns flat range coordinates
 *
 * @example
 * ```ts
 * const result = toFlat({ sr: selectionRange, });
 * ```
 */
export function toFlat({ sr, }: { readonly sr: SelectionRange; },): FlatRange {
  return {
    startLine: sr.range
      .start
      .line,
    startCharacter: sr.range
      .start
      .character,
    endLine: sr.range
      .end
      .line,
    endCharacter: sr.range
      .end
      .character,
  };
}
