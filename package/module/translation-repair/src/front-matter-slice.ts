import type {
  ChunkPair,
  SliceSyntax,
} from './chunk-document.ts';
import { makeInsertionChunk, } from './chunk-placement.ts';
import type { FrontMatterBlock, } from './front-matter.ts';

//region Front matter slice
// Metadata is visible localized page content, but Markdown parsing deliberately
// excludes it from document nodes. This factory gives it one explicit syntax-
// bearing slice without pretending YAML keys are Markdown blocks.

/**
 * Result of aligning optional front matter.
 *
 * @example
 * ```ts
 * const result: FrontMatterSliceResult = { kind: 'none', };
 * ```
 */
export type FrontMatterSliceResult = {
  readonly kind: 'none';
} | {
  readonly kind: 'paired';
  readonly slice: ChunkPair;
};

/**
 * Creates front-matter slice when both documents declare one.
 *
 * @param source - original front matter
 *
 * @param target - translation front matter
 *
 * @returns Tagged syntax-bearing pair,
 * insertion pair for source-only metadata,
 * or no localized slice
 *
 * @example
 * ```ts
 * const pair = frontMatterSlice({ source, target, });
 * ```
 */
export function frontMatterSlice(
  {
    source,
    target,
  }: {
    readonly source?: FrontMatterBlock;
    readonly target?: FrontMatterBlock;
  },
): FrontMatterSliceResult {
  if (source === undefined)
    return { kind: 'none', };

  /**
   * Exact source metadata bytes.
   */
  const { raw: sourceRaw, } = source;
  /**
   * Exact target metadata bytes when archive already carries metadata.
   */
  const targetRaw = target?.raw;
  return {
    kind: 'paired',
    slice: {
      syntax: 'front-matter',
      source: {
        kind: 'content',
        sliceIndex: 0,
        nodes: [],
        startOffset: 0,
        endOffset: sourceRaw.length,
        text: sourceRaw,
      },
      target: (targetRaw === undefined)
        ? makeInsertionChunk({
          sliceIndex: 0,
          offset: 0,
        },)
        : {
          kind: 'content',
          sliceIndex: 0,
          nodes: [],
          startOffset: 0,
          endOffset: targetRaw.length,
          text: targetRaw,
        },
    },
  };
}

/**
 * Names syntax-bearing metadata slices in prepared order.
 *
 * @param slices - prepared document slices
 *
 * @returns Set of front matter slice indexes
 *
 * @example
 * ```ts
 * const indexes = frontMatterSliceIndexes({ slices, });
 * ```
 */
export function frontMatterSliceIndexes(
  { slices, }: { readonly slices: readonly ChunkPair[]; },
): ReadonlySet<number> {
  return new Set(slices
    .filter(function hasSyntax(slice,): boolean {
      return slice.syntax === ('front-matter' satisfies SliceSyntax);
    },)
    .map(function toIndex(slice,): number {
      return slice.target
        .sliceIndex;
    },),);
}

//endregion Front matter slice
