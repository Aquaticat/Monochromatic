import {
  diagnose,
  offsetsOf,
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
const ID = 'MD054';

/**
 * Flag shortcut reference links and images (`[label]`, `![label]`), the one
 * style the repo's MD054 config disallows (`shortcut: false`, every other
 * style allowed). The fix appends `[]` to convert the shortcut into the allowed
 * collapsed style, which resolves to the same definition. mdast's
 * `referenceType` already records the style, so no source slice is needed.
 *
 * @param tree - mdast tree under lint
 *
 * @returns one diagnostic per shortcut reference
 */
function checkLinkImageStyle({ tree, }: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  for (const { node, } of walk(tree,)) {
    if ((node.type !== 'linkReference') && (node.type !== 'imageReference')) {
      continue;
    }
    if (node.referenceType !== 'shortcut') {
      continue;
    }
    /**
     * Reference's source offsets; the fix inserts `[]` at its end.
     */
    const { end, } = offsetsOf(node,);
    diagnostics.push(diagnose({
      ruleId: ID,
      message: 'Shortcut reference style; use the collapsed `[label][]` style.',
      node,
      fix: {
        start: end,
        end,
        insertText: '[]',
      },
    },),);
  }
  return diagnostics;
}

/**
 * MD054 link-image-style: shortcut reference style is disallowed. Fixable:
 * converts a shortcut reference to the collapsed style.
 */
export const linkImageStyle: Rule = {
  id: ID,
  fixable: true,
  check: checkLinkImageStyle,
};
