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
const ID = 'MD001';

/**
 * Walk headings in document order and flag any whose depth jumps by more than
 * one from the previous heading (e.g. an `h1` followed directly by an `h3`).
 * The first heading sets the baseline and is never flagged.
 *
 * @param tree - mdast tree under lint
 *
 * @returns one diagnostic per skipped heading level
 */
function checkHeadingIncrement({ tree, }: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  /**
   * Depth of the previous heading; `0` until the first heading is seen.
   */
  let previousDepth = 0;
  for (const { node, } of walk(tree,)) {
    if (node.type !== 'heading') {
      continue;
    }
    if ((previousDepth !== 0) && (node.depth > (previousDepth + 1))) {
      diagnostics.push(diagnose({
        ruleId: ID,
        message: `Heading level jumps from ${previousDepth} to ${node.depth}; increment by one.`,
        node,
      },),);
    }
    previousDepth = node.depth;
  }
  return diagnostics;
}

/**
 * MD001 heading-increment: heading levels increment by at most one. Report-only.
 */
export const headingIncrement: Rule = {
  id: ID,
  fixable: false,
  check: checkHeadingIncrement,
};
