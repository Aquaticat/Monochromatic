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
const ID = 'MD025';

/**
 * Flag every level-1 heading after the first: a document should have a single
 * top-level heading. Unlike markdownlint's default, a frontmatter `title` is
 * not counted as an `h1` here; the rule's behavior is defined by its own tests.
 *
 * @param tree - mdast tree under lint
 *
 * @returns one diagnostic per extra top-level heading
 */
function checkSingleH1({ tree, }: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  /**
   * Count of level-1 headings seen so far.
   */
  let h1Count = 0;
  for (const { node, } of walk(tree,)) {
    if ((node.type !== 'heading') || (node.depth !== 1)) {
      continue;
    }
    h1Count += 1;
    if (h1Count > 1) {
      diagnostics.push(diagnose({
        ruleId: ID,
        message: 'Multiple top-level headings; a document should have a single h1.',
        node,
      },),);
    }
  }
  return diagnostics;
}

/**
 * MD025 single-h1: at most one level-1 heading per document. Report-only.
 */
export const singleH1: Rule = {
  id: ID,
  fixable: false,
  check: checkSingleH1,
};
