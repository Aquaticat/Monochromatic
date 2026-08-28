import type {
  ChunkPair,
  SliceSyntax,
} from './chunk-document.ts';
import type { FrontMatterBlock, } from './front-matter.ts';

//region Front matter slice
// Metadata is visible localized page content, but Markdown parsing deliberately
// excludes it from document nodes. This factory gives it one explicit syntax-
// bearing slice without pretending YAML keys are Markdown blocks.

/**
 * Refusal when only one side declares front matter.
 *
 * @example
 * ```ts
 * throw new FrontMatterAlignmentError({ missing: 'translation', });
 * ```
 */
export class FrontMatterAlignmentError extends Error {
  /**
   * Message names side and operation only.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Builds refusal for missing side.
   *
   * @param missing - side without front matter
   */
  public constructor({ missing, }: { readonly missing: 'original' | 'translation'; }) {
    super(`cannot review front matter because ${missing} document has none`,);
    this.name = 'FrontMatterAlignmentError';
  }
}

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
 * @returns Tagged syntax-bearing pair or explicit no-metadata result
 *
 * @throws FrontMatterAlignmentError when exactly one side has front matter
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
  if (source === undefined) {
    if (target === undefined)
      return { kind: 'none', };
    throw new FrontMatterAlignmentError({ missing: 'original', });
  }
  if (target === undefined)
    throw new FrontMatterAlignmentError({ missing: 'translation', });

  /**
   * Exact source metadata bytes.
   */
  const { raw: sourceRaw, } = source;
  /**
   * Exact target metadata bytes.
   */
  const { raw: targetRaw, } = target;
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
      target: {
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

/**
 * Restores page-separating line break model completions commonly omit.
 *
 * Front matter parsed alone may close at end of input without a trailing line
 * break. Placing those same bytes before page body joins closing fence and body
 * onto one line, so complete page no longer has front matter. Target slice
 * carries exact separator used by page and remains source of boundary style.
 *
 * @param syntax - prepared role deciding whether boundary governs
 *
 * @param targetText - archive slice carrying page separator
 *
 * @param candidateText - settled replacement to make assembly-safe
 *
 * @returns Candidate with required front matter separator restored
 *
 * @example
 * ```ts
 * restoreSyntaxSliceBoundary({ syntax: 'front-matter', targetText: '---\nname: Cat\n---\n', candidateText: '---\nname: Kitty\n---', });
 * ```
 */
export function restoreSyntaxSliceBoundary(
  {
    syntax,
    targetText,
    candidateText,
  }: {
    readonly syntax?: SliceSyntax;
    readonly targetText: string;
    readonly candidateText: string;
  },
): string {
  if (syntax !== 'front-matter')
    return candidateText;
  if ((!targetText.endsWith('\n',)) || candidateText.endsWith('\n',))
    return candidateText;
  /**
   * Exact line ending target page uses at metadata-to-body boundary.
   */
  const boundary = targetText.endsWith('\r\n',) ? '\r\n' : '\n';
  return `${candidateText}${boundary}`;
}

//endregion Front matter slice
