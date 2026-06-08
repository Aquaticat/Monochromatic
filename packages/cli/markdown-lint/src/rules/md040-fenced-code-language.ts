import {
  diagnose,
  sliceOf,
} from '../node-source.ts';
import type {
  Diagnostic,
  Rule,
  RuleContext,
} from '../types.ts';
import { walk, } from '../walk.ts';

/**
 * Rule id.
 */
const ID = 'MD040';

/**
 * Fence markers a fenced code block can open with.
 */
const FENCE_MARKERS: readonly string[] = [
  '```',
  '~~~',
];

/**
 * Whether a code node is a fenced block (as opposed to an indented one). mdast
 * does not record this directly, so the written form is inspected: a fenced
 * block's source, once leading indentation is dropped, opens with a fence
 * marker, while an indented block opens with its content.
 *
 * @param slice - code node's source slice
 *
 * @returns whether the block is fenced
 */
function isFenced(slice: string,): boolean {
  /**
   * Slice with any leading indentation removed.
   */
  const opener = slice.trimStart();
  return FENCE_MARKERS.some(function opensWith(marker: string,): boolean {
    return opener.startsWith(marker,);
  },);
}

/**
 * Flag fenced code blocks with no language label. Indented code blocks carry no
 * language and are never flagged.
 *
 * @param tree - mdast tree under lint
 *
 * @param source - original source, to tell fenced from indented blocks
 *
 * @returns one diagnostic per unlabeled fenced block
 */
function checkFencedCodeLanguage({
  tree,
  source,
}: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  for (const { node, } of walk(tree,)) {
    if (node.type !== 'code') {
      continue;
    }
    if ((node.lang !== null) && (node.lang !== '')) {
      continue;
    }
    if (!isFenced(sliceOf({
      node,
      source,
    },),)) {
      continue;
    }
    diagnostics.push(diagnose({
      ruleId: ID,
      message: 'Fenced code block has no language label.',
      node,
    },),);
  }
  return diagnostics;
}

/**
 * MD040 fenced-code-language: fenced code blocks must declare a language.
 * Report-only.
 */
export const fencedCodeLanguage: Rule = {
  id: ID,
  fixable: false,
  check: checkFencedCodeLanguage,
};
