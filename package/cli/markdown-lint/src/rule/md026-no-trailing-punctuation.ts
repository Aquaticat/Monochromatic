import {
  diagnose,
  offsetsOf,
} from '../node-source.ts';
import { textNodes, } from '../text.ts';
import type {
  Diagnostic,
  Rule,
  RuleContext,
} from '../types.ts';
import { walk, } from '../walk.ts';

/**
 * Rule id.
 */
const ID = 'MD026';

/**
 * Punctuation banned at the end of a heading, matching the repo's
 * `.markdownlint-cli2.jsonc` `punctuation: ".:"` setting.
 */
const TRAILING_PUNCTUATION: ReadonlySet<string> = new Set([
  '.',
  ':',
],);

/**
 * Count of banned punctuation characters at the end of a string.
 *
 * @param value - text to inspect
 *
 * @returns length of the trailing punctuation run
 */
function trailingPunctuationLength(value: string,): number {
  /**
   * Number of trailing punctuation characters counted so far.
   */
  let count = 0;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (!TRAILING_PUNCTUATION.has(value[index] ?? '',)) {
      break;
    }
    count += 1;
  }
  return count;
}

/**
 * Flag headings whose text ends in banned punctuation and attach a fix that
 * strips the trailing run. The edit lands on the heading's last `text` node, so
 * punctuation inside trailing emphasis (`**Done:**`) is stripped correctly.
 *
 * @param tree - mdast tree under lint
 *
 * @returns one diagnostic per heading ending in punctuation
 */
function checkNoTrailingPunctuation({ tree, }: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  for (const { node, } of walk(tree,)) {
    if (node.type !== 'heading') {
      continue;
    }
    /**
     * The heading's last text node, where any trailing punctuation lives.
     */
    const last = textNodes(node,)
      .at(-1,);
    if (last === undefined) {
      continue;
    }
    /**
     * Length of the trailing punctuation run on that text node.
     */
    const runLength = trailingPunctuationLength(last.value,);
    if (runLength === 0) {
      continue;
    }
    /**
     * Source offsets of the last text node.
     */
    const { end, } = offsetsOf(last,);
    diagnostics.push(diagnose({
      ruleId: ID,
      message: 'Heading ends with punctuation; remove the trailing punctuation.',
      node,
      fix: {
        start: end - runLength,
        end,
        insertText: '',
      },
    },),);
  }
  return diagnostics;
}

/**
 * MD026 no-trailing-punctuation: headings must not end with `.` or `:`.
 * Fixable: strips the trailing punctuation.
 */
export const noTrailingPunctuation: Rule = {
  id: ID,
  fixable: true,
  check: checkNoTrailingPunctuation,
};
