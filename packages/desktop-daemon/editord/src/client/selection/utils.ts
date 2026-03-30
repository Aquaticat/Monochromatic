/**
 * Utility functions for LSP selection range chain processing.
 *
 * Flattening, comparison, and coordinate conversion for the
 * nested {@link SelectionRange} chains returned by the server.
 * Split from app-lsp-selection.ts to stay under max-lines.
 */

import type { SelectionRange, } from '../../../protocol.ts';

/** Range coordinates used for comparison. */
export type FlatRange = {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
};

/**
 * Flattens the nested `parent` chain of a {@link SelectionRange} into
 * a flat array ordered from innermost to outermost scope.
 *
 * @param root - top of the nested chain returned by the server
 *
 * @returns flat array where index 0 is the innermost range
 */
export function flattenChain({ root, }: { root: SelectionRange; },): SelectionRange[] {
  const result: SelectionRange[] = [];
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
 */
export function strictlyContains(
  {
    outer,
    inner,
  }: {
    outer: FlatRange;
    inner: FlatRange;
  },
): boolean {
  const outerStartBefore = outer.startLine < inner.startLine
    || (outer.startLine === inner.startLine
      && outer.startCharacter < inner.startCharacter);
  const outerEndAfter = outer.endLine > inner.endLine
    || (outer.endLine === inner.endLine && outer.endCharacter > inner.endCharacter);
  const outerStartSame = outer.startLine === inner.startLine
    && outer.startCharacter === inner.startCharacter;
  const outerEndSame = outer.endLine === inner.endLine
    && outer.endCharacter === inner.endCharacter;

  /** Strictly larger: at least one boundary must differ outward. */
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
 */
export function toFlat({ sr, }: { sr: SelectionRange; },): FlatRange {
  return {
    startLine: sr.range.start.line,
    startCharacter: sr.range.start.character,
    endLine: sr.range.end.line,
    endCharacter: sr.range.end.character,
  };
}
