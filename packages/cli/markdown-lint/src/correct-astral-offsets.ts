import type { ReadonlyDeep, } from 'type-fest';
import type {
  Nodes,
  Root,
} from 'mdast';
import type { Point, } from 'unist';

/**
 * Whether the source contains any astral (supplementary-plane) character, the
 * only case where Sätteri's code-point offsets diverge from remark's UTF-16
 * code-unit offsets. Iterating with `for...of` yields one string per code
 * point; an astral scalar value is a surrogate pair, so its string spans two
 * UTF-16 code units. A BMP-only source (the common case) returns after a
 * single linear pass.
 *
 * @param source - source under lint
 *
 * @returns whether any astral character is present
 *
 * @example
 * ```ts
 * hasAstralCodePoints('plain text'); // false
 * hasAstralCodePoints('rocket 🚀'); // true
 * ```
 */
export function hasAstralCodePoints(source: string,): boolean {
  for (const character of source) {
    if (character.length > 1) {
      return true;
    }
  }
  return false;
}

/**
 * A map from code-point index to UTF-16 code-unit index for a source. Index by
 * a Sätteri (code-point) offset to recover the UTF-16 offset JavaScript strings
 * and remark use. Length is one past the code-point count, so an offset at the
 * document end maps too.
 *
 * @param source - source under lint
 *
 * @returns code-point-index to UTF-16-index map
 *
 * @example
 * ```ts
 * codePointToUtf16Map('🚀a')[1]; // 2 (the `a` sits at UTF-16 index 2)
 * ```
 */
function codePointToUtf16Map(source: string,): readonly number[] {
  /**
   * UTF-16 index of each successive code point, plus an end sentinel.
   */
  const map: number[] = [];
  /**
   * Running UTF-16 code-unit index.
   */
  let utf16 = 0;
  for (const character of source) {
    map.push(utf16,);
    utf16 += character.length;
  }
  map.push(utf16,);
  return map;
}

/**
 * Parameters for {@link rewritePointToUtf16}.
 */
type RewritePointParams = {
  /**
   * Code-point-index to UTF-16-index map for the source.
   */
  readonly map: readonly number[];
  /**
   * Point whose `offset` is rewritten in place.
   */
  readonly point: Point;
};

/**
 * Rewrite one point's `offset` from a code-point index to a UTF-16 index using
 * the map. A point past the map (should not happen for parsed nodes) keeps its
 * original offset rather than becoming undefined.
 *
 * @param map - code-point-index to UTF-16-index map for the source
 *
 * @param point - point whose offset is rewritten in place
 */
function rewritePointToUtf16({
  map,
  point,
}: RewritePointParams,): void {
  /**
   * Sätteri's code-point offset for this point.
   */
  const codePointOffset = point.offset;
  if (codePointOffset !== undefined) {
    point.offset = map[codePointOffset] ?? codePointOffset;
  }
}

/**
 * Parameters for {@link correctAstralOffsets}.
 */
export type CorrectAstralOffsetsParams = {
  /**
   * Tree whose node offsets are rewritten in place.
   */
  readonly tree: Root;
  /**
   * Source the tree was parsed from.
   */
  readonly source: string;
};

/**
 * Rewrite every node's `position` start and end `offset` from Sätteri's
 * code-point offset to the UTF-16 code-unit offset remark and the source-offset
 * fixer expect. Mutates the freshly parsed tree in place and returns it. Only
 * meaningful when the source holds astral characters; callers gate on
 * {@link hasAstralCodePoints} so a BMP-only parse skips the walk. The walk is an
 * explicit work-stack so a degenerate spine cannot overflow the call stack.
 * Columns are left as Sätteri reports them (code-point based); the fixer edits
 * at offsets, so only offsets need correcting. See
 * `docs/troubleshooting/satteri-offsets.md`.
 *
 * @param tree - tree whose node offsets are rewritten in place
 *
 * @param source - source the tree was parsed from
 *
 * @returns same tree, with offsets in UTF-16 code units
 *
 * @example
 * ```ts
 * correctAstralOffsets({ tree, source }); // tree with UTF-16 offsets
 * ```
 */
export function correctAstralOffsets({
  tree,
  source,
}: ReadonlyDeep<CorrectAstralOffsetsParams>,): Root {
  /**
   * Code-point-index to UTF-16-index map for this source.
   */
  const map = codePointToUtf16Map(source,);
  /**
   * Work-stack of nodes still to correct, seeded with the root.
   */
  const stack: Nodes[] = [tree,];
  while (stack.length > 0) {
    /**
     * Node currently corrected; the loop guard guarantees it exists.
     */
    const node = stack.pop();
    if (node === undefined) {
      continue;
    }
    /**
     * Node position, absent only on synthesized nodes.
     */
    const { position, } = node;
    if (position !== undefined) {
      rewritePointToUtf16({
        map,
        point: position.start,
      },);
      rewritePointToUtf16({
        map,
        point: position.end,
      },);
    }
    if ('children' in node) {
      for (const child of node.children) {
        stack.push(child,);
      }
    }
  }
  return tree;
}
