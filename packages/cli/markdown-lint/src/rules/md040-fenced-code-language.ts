import { isFencedCode, } from '../code.ts';
import { diagnose, } from '../node-source.ts';
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
    if (!isFencedCode({
      node,
      source,
    },)) {
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
