import type { Root, } from 'mdast';

import type { DeepReadonlyData, } from './readonly-data.ts';

import { parseMarkdownBody, } from './parse-mdx.ts';
import {
  blockDetail,
  readSliceSkeleton,
  type SkeletonRead,
} from './translate-skeleton.ts';

//region Page skeleton
// The PAGE side of the structural floor, which is a different job from the
// candidate side and needs a different grammar policy.
//
// A CANDIDATE THE STRICT GRAMMAR REFUSES IS A CANDIDATE TO REFUSE: we asked for
// it, and text we cannot parse is text we should not splice into a page.
// `readSliceSkeleton` is right to answer `unparseable` there, and
// `inspect-paragraph.ts` says the same thing for the paragraph inspector.
//
// THE PAGE IS NOT A CANDIDATE. It is archive text nobody in this pipeline
// wrote, and it can be refused for reasons no producer can act on. The measured
// case is a slice boundary falling between an opening `<details>` and its
// closing tag: the span carries no closing tag, the strict grammar demands one,
// and every rendering of that slice fails no matter how faithful. Document
// parsing already downgrades a whole page to plain markdown for exactly this,
// so the page side of the floor does too.
//
// WHY THIS IS NOT COSMETIC. Before this existed, a page the grammar refused
// became NO PAGE, the floor had no block list to compare against, and a
// candidate was measured against the source alone. On `Zha_Ke#1` of the sixth
// consolidation bed that let a 164-character rendering pass against a 3875-
// character page, deleting a person's will from a memorial while both lanes had
// carried it whole. A check that cannot run must not answer yes.

/**
 * Reading of a page that failed the strict grammar, under plain markdown.
 *
 * SEPARATE FROM {@link readSliceSkeleton} rather than a flag on it, because the
 * two callers want opposite things from the same refusal and a boolean would
 * hide which one a call site had chosen.
 *
 * @param text - exact page source, as the archive has it
 *
 * @returns Blocks and atoms under the looser grammar, or the refusal when even
 * plain markdown will not read it
 *
 * @example
 * ```ts
 * const relaxed = readRelaxed({ text: pageText, },);
 * ```
 */
function readRelaxed({ text, }: { readonly text: string; },): SkeletonRead {
  try {
    /**
     * Page under the grammar that tolerates an unbalanced tag.
     */
    const root: DeepReadonlyData<Root> = parseMarkdownBody({ body: text, },);
    return {
      kind: 'read',
      skeleton: {
        blocks: root.children
          .map(function toShape(node,) {
            return {
              kind: node.type,
              detail: blockDetail({ node, },),
            };
          },),
        // ATOMS ARE LEFT EMPTY on the relaxed reading. Plain markdown collapses
        // a whole html region into one opaque node, so the references and code
        // inside it are not visible as atoms, and reporting an empty atom list
        // as if it were complete would make the atom check pass by ignorance.
        // Only the block sequence is claimed here.
        atoms: [],
      },
    };
  }
  catch (error) {
    // Plain markdown refusing is close to impossible, and an unexpected state
    // rather than a grammar disagreement, so it is reported and not thrown:
    // the floor's fallback for a page it cannot read at all is still to fall
    // back to the original alone.
    return {
      kind: 'unparseable',
      detail: `plain markdown also refused: ${String(error,)}`,
    };
  }
}

/**
 * Reads the page a candidate would replace into its block sequence.
 *
 * Tries the strict grammar first so a well-formed page is read exactly as the
 * candidate side reads it, and downgrades to plain markdown only where the
 * strict grammar refuses.
 *
 * @param text - exact page source, empty where the slice has no page
 *
 * @returns Blocks and atoms, or the refusal when neither grammar reads it
 *
 * @example
 * ```ts
 * const page = readPageSkeleton({ text: pageText, },);
 * ```
 */
export function readPageSkeleton(
  { text, }: { readonly text: string; },
): SkeletonRead {
  /**
   * Strict reading, which is what a page written under this grammar gets.
   */
  const strict = readSliceSkeleton({ text, },);
  if (strict.kind === 'read')
    return strict;

  return readRelaxed({ text, },);
}

//endregion Page skeleton
