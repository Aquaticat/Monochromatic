import type { ReadonlyDeep, } from 'type-fest';
import type { Code, } from 'mdast';

import { sliceOf, } from './node-source.ts';

/**
 * Fence markers a fenced code block can open with.
 */
const FENCE_MARKERS: readonly string[] = [
  '```',
  '~~~',
];

/**
 * Parameters for {@link isFencedCode}.
 */
export type IsFencedCodeParams = {
  /**
   * Code node to classify.
   */
  readonly node: Code;
  /**
   * Original source.
   */
  readonly source: string;
};

/**
 * Whether a `code` node is a fenced block rather than an indented one. mdast
 * records no flag for this, so the written form is inspected: a fenced block's
 * source, once leading indentation is dropped, opens with a fence marker, while
 * an indented block opens with its content.
 *
 * @param node - code node to classify
 *
 * @param source - original source
 *
 * @returns whether the block is fenced
 *
 * @example
 * ```ts
 * isFencedCode({ node, source }); // true for ```ts ... ```
 * ```
 */
export function isFencedCode({
  node,
  source,
}: ReadonlyDeep<IsFencedCodeParams>,): boolean {
  /**
   * Code source with any leading indentation removed.
   */
  const opener = sliceOf({
    node,
    source,
  },)
    .trimStart();
  return FENCE_MARKERS.some(function opensWith(marker: string,): boolean {
    return opener.startsWith(marker,);
  },);
}
