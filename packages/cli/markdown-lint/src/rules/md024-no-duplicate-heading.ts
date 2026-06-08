import { diagnose, } from '../node-source.ts';
import { collectText, } from '../text.ts';
import type {
  Diagnostic,
  Rule,
  RuleContext,
} from '../types.ts';
import { walk, } from '../walk.ts';

/**
 * Rule id.
 */
const ID = 'MD024';

/**
 * One heading on the ancestor stack: its depth and rendered text, which
 * together scope a sibling group.
 */
type HeadingFrame = {
  /**
   * Heading depth (1 to 6).
   */
  readonly depth: number;
  /**
   * Heading rendered text.
   */
  readonly text: string;
};

/**
 * Depth of the top frame on the ancestor stack, or `0` when empty.
 *
 * @param stack - ancestor heading stack
 *
 * @returns depth of the deepest frame, or `0` when the stack is empty
 */
function topDepth(stack: readonly HeadingFrame[],): number {
  /**
   * Deepest frame on the stack, if any.
   */
  const top = stack.at(-1,);
  return top === undefined
    ? 0
    : top.depth;
}

/**
 * Flag headings whose text duplicates an earlier heading with the same parent
 * heading and depth (`siblings_only`). The parent scope is tracked with an
 * explicit ancestor stack: before each heading, frames at the same or a deeper
 * level are popped, leaving the heading's ancestor path. Two headings collide
 * only when that path, their depth, and their text all match.
 *
 * @param tree - mdast tree under lint
 *
 * @returns one diagnostic per duplicated sibling heading
 */
function checkNoDuplicateHeading({ tree, }: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  /**
   * Ancestor heading path above the current heading, shallowest first.
   */
  const ancestors: HeadingFrame[] = [];
  /**
   * Keys of sibling groups already seen, for duplicate detection.
   */
  const seen = new Set<string>();
  for (const { node, } of walk(tree,)) {
    if (node.type !== 'heading') {
      continue;
    }
    /**
     * This heading's rendered text.
     */
    const text = collectText(node,);
    while ((ancestors.length > 0) && (topDepth(ancestors,) >= node.depth)) {
      ancestors.pop();
    }
    /**
     * Ancestor path as depth/text pairs, scoping the sibling group.
     */
    const scope = ancestors.map(function toPair(frame: HeadingFrame,): readonly [
      number,
      string,
    ] {
      return [
        frame.depth,
        frame.text,
      ];
    },);
    /**
     * Collision key: ancestor path plus this heading's depth and text.
     */
    const key = JSON.stringify([
      scope,
      node.depth,
      text,
    ],);
    if (seen.has(key,)) {
      diagnostics.push(diagnose({
        ruleId: ID,
        message: `Duplicate heading "${text}" among sibling headings.`,
        node,
      },),);
    } else {
      seen.add(key,);
    }
    ancestors.push({
      depth: node.depth,
      text,
    },);
  }
  return diagnostics;
}

/**
 * MD024 no-duplicate-heading (siblings_only): sibling headings under the same
 * parent must have distinct text. Report-only.
 */
export const noDuplicateHeading: Rule = {
  id: ID,
  fixable: false,
  check: checkNoDuplicateHeading,
};
