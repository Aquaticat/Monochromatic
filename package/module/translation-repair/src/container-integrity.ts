import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import type { ContainerSpan, } from './unwrap-container.ts';

//region Container integrity
// The thing no block-level check can see, because the thing at risk is not a
// block.
//
// `flattenContainers` promotes a disclosure element's children to top-level
// blocks so both language sides expose comparable structure. The element's own
// opening and closing tags are left behind: they belong to none of the promoted
// children, so they appear in no node, and every other invariant here reasons
// over nodes. `assertSpanContiguity` asks whether a range cuts a block,
// `assertSliceCoverage` asks whether a block reached a slice, and a tag is not
// a block for either of them.
//
// Assembly replaces a slice's RANGE and copies everything else through. So a
// range holding the opening tag and stopping short of the closing one deletes
// the opener, keeps the closer, and produces a page that both loses the
// element's contents and carries markup closing nothing.
//
// THE RULE IS BOTH TAGS OR NEITHER, not "no tag inside a range". An element
// wholly inside one slice puts both tags in that range, which is the ordinary
// healthy case: the slice text carries them, and a candidate that drops them is
// caught downstream where the page grammar refuses it. Refusing that case would
// refuse most of the pages that use containers at all.

/**
 * Raised when one slice range holds one of a container's tags and not the
 * other.
 *
 * @example
 * ```ts
 * throw new ContainerIntegrityError({ message: 'slice 1 holds the opening tag of details', },);
 * ```
 */
export class ContainerIntegrityError extends Error {
  /**
   * Builds the failure naming which element a range would break.
   *
   * @param message - which slice holds which half of which element
   *
   * @example
   * ```ts
   * throw new ContainerIntegrityError({ message: 'slice 1 splits details', },);
   * ```
   */
  public constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'ContainerIntegrityError';
  }
}

/**
 * Half-open range, named so the two questions asked of it read plainly.
 */
type Range = {
  /**
   * Absolute inclusive start.
   */
  readonly startOffset: number;

  /**
   * Absolute exclusive end.
   */
  readonly endOffset: number;
};

/**
 * Whether an outer range holds an inner one whole.
 *
 * @param outer - range doing the holding
 *
 * @param inner - range that must fit inside
 *
 * @returns Whether every character of inner lies in outer
 *
 * @example
 * ```ts
 * if (covers({ outer: span, inner: opener, },)) { }
 * ```
 */
function covers({ outer, inner, }: { readonly outer: Range; readonly inner: Range; },): boolean {
  return (inner.startOffset >= outer.startOffset)
    && (inner.endOffset <= outer.endOffset);
}

/**
 * Whether two ranges share any character at all.
 *
 * ASKED BESIDE {@link covers} rather than instead of it, because the two differ
 * exactly where a range ends part way through a tag. That range neither holds
 * the tag nor leaves it alone, and assembly would write over half of it.
 *
 * @param outer - range doing the overlapping
 *
 * @param inner - range being overlapped
 *
 * @returns Whether any character is common to both
 *
 * @example
 * ```ts
 * if (touches({ outer: span, inner: closer, },)) { }
 * ```
 */
function touches({ outer, inner, }: { readonly outer: Range; readonly inner: Range; },): boolean {
  return (inner.startOffset < outer.endOffset)
    && (inner.endOffset > outer.startOffset);
}

/**
 * Reads how a range stands towards one tag: holding it, ignoring it, or cutting
 * it.
 *
 * @param span - slice range assembly would replace
 *
 * @param tag - one container tag
 *
 * @returns Whether the range holds it, and whether it reaches it at all
 *
 * @example
 * ```ts
 * const { held, reached, } = standing({ span, tag, },);
 * ```
 */
function standing(
  { span, tag, }: { readonly span: Range; readonly tag: Range; },
): { readonly held: boolean; readonly reached: boolean; } {
  return {
    held: covers({ outer: span, inner: tag, },),
    reached: touches({ outer: span, inner: tag, },),
  };
}

/**
 * Refuses any slice whose range would break a container it does not own whole.
 *
 * CALLED AT PREPARATION, where the parsed document still remembers which
 * containers were dissolved. Nothing later can: the slices carry nodes and
 * offsets, and the tags are in neither.
 *
 * @param slices - prepared slice pairs
 *
 * @param containers - every container the parse dissolved, absolute offsets
 *
 * @throws {@link ContainerIntegrityError} when one range holds one tag of a
 * container without the other, or ends part way through a tag
 *
 * @example
 * ```ts
 * assertContainerIntegrity({ slices, containers: targetDocument.containers, },);
 * ```
 */
export function assertContainerIntegrity(
  {
    slices,
    containers,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly containers: readonly ContainerSpan[];
  },
): void {
  for (const slice of slices) {
    /**
     * Target side of this pair, which is the side assembly writes over.
     */
    const span = slice.target;

    // An insertion names a place rather than a range, so it replaces nothing
    // and can break no element. Where it lands inside a container is a question
    // about placement, which `span-contiguity.ts` already answers.
    if (isInsertionChunk(span,))
      continue;
    for (const container of containers) {
      /**
       * How this range stands towards the opening tag.
       */
      const opener = standing({
        span,
        tag: { startOffset: container.openerStartOffset, endOffset: container.openerEndOffset, },
      },);

      /**
       * How this range stands towards the closing tag.
       */
      const closer = standing({
        span,
        tag: { startOffset: container.closerStartOffset, endOffset: container.closerEndOffset, },
      },);

      /**
       * Element name in a form a reader can find on the page.
       */
      const named = container.name === ''
        ? 'a fragment'
        : `<${container.name}>`;
      if (opener.reached !== opener.held) {
        throw new ContainerIntegrityError({
          message: `slice ${String(span.chunkIndex,)} ends part way through the opening tag of ${named}, `
            + 'so assembly would replace half of it and leave the rest beside text written without it',
        },);
      }
      if (closer.reached !== closer.held) {
        throw new ContainerIntegrityError({
          message: `slice ${String(span.chunkIndex,)} ends part way through the closing tag of ${named}, `
            + 'so assembly would replace half of it and leave the rest beside text written without it',
        },);
      }
      if (opener.held === closer.held)
        continue;

      /**
       * Which half this range holds, which is the half assembly would delete.
       */
      const kept = opener.held
        ? 'opening'
        : 'closing';

      /**
       * Which half it leaves behind, which is the half that would be orphaned.
       */
      const orphaned = opener.held
        ? 'closing'
        : 'opening';
      throw new ContainerIntegrityError({
        message: `slice ${String(span.chunkIndex,)} covers the ${kept} tag of ${named} and not its `
          + `${orphaned} tag: assembly replaces the range, so that tag would be deleted while its `
          + 'partner survives, leaving the element without its contents and the page with markup '
          + 'that closes nothing',
      },);
    }
  }
}

//endregion Container integrity
