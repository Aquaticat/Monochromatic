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
const ID = 'MD036';

/**
 * Trailing punctuation that marks emphasized text as a real sentence rather
 * than a heading substitute, so the paragraph is left alone (markdownlint's
 * default MD036 punctuation set, ASCII and full-width).
 */
const SENTENCE_PUNCTUATION: ReadonlySet<string> = new Set([
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
  '。',
  '，',
  '；',
  '：',
  '！',
  '？',
],);

/**
 * Ancestors where a strong/emphasis-only paragraph is a label or term rather
 * than a heading substitute.
 */
const SKIP_ANCESTORS: ReadonlySet<string> = new Set([
  'listItem',
],);

/**
 * Whether emphasized text ends with sentence punctuation.
 *
 * @param text - emphasized text
 *
 * @returns whether the last character is sentence punctuation
 */
function endsWithSentencePunctuation(text: string,): boolean {
  /**
   * Final character of the text, or empty string when the text is empty.
   */
  const last = text.slice(-1,);
  return SENTENCE_PUNCTUATION.has(last,);
}

/**
 * Flag a paragraph whose sole child is `emphasis` or `strong` and whose text
 * does not end in sentence punctuation: such a paragraph reads as a heading
 * substitute. A genuinely emphasized sentence (ending in punctuation) is left
 * alone, as is an emphasized-only list item label.
 *
 * @param tree - mdast tree under lint
 *
 * @returns one diagnostic per emphasis-as-heading paragraph
 */
function checkNoEmphasisAsHeading({ tree, }: RuleContext,): readonly Diagnostic[] {
  /**
   * Diagnostics collected across the walk.
   */
  const diagnostics: Diagnostic[] = [];
  for (const {
    node,
    ancestors,
  } of walk(tree,)) {
    if (node.type !== 'paragraph') {
      continue;
    }
    if (ancestors.some(function shouldSkip(ancestor,): boolean {
      return SKIP_ANCESTORS.has(ancestor.type,);
    },)) {
      continue;
    }
    /**
     * The paragraph's sole child, if it has exactly one.
     */
    const [child, ...rest] = node.children;
    if (rest.length > 0) {
      continue;
    }
    if ((child === undefined) || ((child.type !== 'emphasis') && (child.type !== 'strong'))) {
      continue;
    }
    if (endsWithSentencePunctuation(collectText(child,),)) {
      continue;
    }
    diagnostics.push(diagnose({
      ruleId: ID,
      message: 'Emphasis used as a heading; use a real heading instead.',
      node,
    },),);
  }
  return diagnostics;
}

/**
 * MD036 no-emphasis-as-heading: a paragraph that is only emphasized text reads
 * as a heading substitute. Report-only.
 */
export const noEmphasisAsHeading: Rule = {
  id: ID,
  fixable: false,
  check: checkNoEmphasisAsHeading,
};
