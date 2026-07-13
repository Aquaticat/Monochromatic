import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '../foreign-borrowed.ts';

import {
  isSymbolCall,
  isSymbolForCall,
  staticDescription,
} from './ast.ts';
import { classifySymbolDescription, } from './classify.ts';

/**
 * Shared final sentence for every low-information Symbol diagnostic.
 *
 * Keeping the hint in one constant makes it hard for future branches to omit
 * the reader-context requirement that descriptions must stand on their own.
 *
 * @example
 * ```ts
 * `${tooFewWordsMessage} ${IMMEDIATE_UNDERSTANDABILITY_HINT}`;
 * ```
 */
const IMMEDIATE_UNDERSTANDABILITY_HINT = 'Every Symbol description must explain the Symbol in plain language by itself: someone seeing only this string, with no repo, code, variable name, or comments, should understand what the Symbol represents and when it appears.';

/**
 * Requires static Symbol descriptions to carry enough debugging information.
 *
 * Sentinel Symbols stand in for nullish unions, so their descriptions are the
 * only debugging identity at a crash site. Descriptions that read like generic
 * code identifiers, generic absence labels, or repeated low-information phrases
 * report; descriptions with enough contextual detail pass even when short.
 *
 * Only static `Symbol('...')`, `Symbol.for('...')`, and zero-expression
 * template-literal descriptions are checked. Absent, dynamic, and non-string
 * descriptions are skipped because type information is unavailable in an oxlint
 * JS plugin. No-argument `Symbol()` is never reported.
 *
 * The classifier is structural: word counts, casing, namespace shape, repetition,
 * and a small set of grammar hooks (`no`, `not`, `because`, `ed`, `ing`). It uses
 * no Shannon entropy, no global compression, and no broad vocabulary lists.
 *
 * @example
 * ```ts
 * // Bad
 * const A = Symbol('meow');
 * const B = Symbol('not-found');
 * const C = Symbol('runWithContext');
 *
 * // Good
 * const D = Symbol('github token expired');
 * const E = Symbol('penpot/figma-input-has-no-counterpart');
 * const F = Symbol('average divisor is zero');
 * ```
 */
export const noLowInformationSymbolDescription: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require static Symbol descriptions to carry enough debugging information; reject generic identifiers, absence labels, and repeated low-information phrases.',
      recommended: true,
    },
    messages: {
      tooFewWords:
        `Symbol description has fewer than 3 distinct words, so it carries little debugging signal. Name what is absent and why, for example "config file missing on disk". ${IMMEDIATE_UNDERSTANDABILITY_HINT}`,
      allUppercase:
        `Symbol description is entirely uppercase words, which reads like a constant name. Use a descriptive lowercase phrase, for example "github token expired". ${IMMEDIATE_UNDERSTANDABILITY_HINT}`,
      bareCamelIdentifier:
        `Symbol description is a bare camelCase or PascalCase identifier with no separators, which reads like a function name. Describe the condition as a phrase, for example "run completed without a context". ${IMMEDIATE_UNDERSTANDABILITY_HINT}`,
      repeatedMeaningfulWord:
        `Symbol description repeats a meaningful word, which adds no information. Replace the repetition with concrete detail about the condition. ${IMMEDIATE_UNDERSTANDABILITY_HINT}`,
      shortNamespacedTail:
        `Symbol description has a namespace prefix but a tail shorter than 3 words. A namespace does not rescue a generic tail; expand it, for example "penpot/figma-input-has-no-counterpart". ${IMMEDIATE_UNDERSTANDABILITY_HINT}`,
      startsWithNoWithoutMarker:
        `Symbol description starts with "no" but has no specificity marker (uppercase, digit, dot, underscore, or a consonant-dense token). Name the specific thing that is absent, for example "no upstream branch for HEAD". ${IMMEDIATE_UNDERSTANDABILITY_HINT}`,
      startsWithNotWithoutMarker:
        `Symbol description starts with "not" but has no specificity marker. Name the specific condition, for example "not inside a Git worktree". ${IMMEDIATE_UNDERSTANDABILITY_HINT}`,
      shortPhraseLacksSpecificityMarker:
        `Symbol description is a 3-word phrase with no specificity marker and no past-tense or continuous verb. Add a concrete technical token or describe the action, for example "average divisor is zero". ${IMMEDIATE_UNDERSTANDABILITY_HINT}`,
    },
  },
  /**
   * Handles foreign Oxlint callback.
   *
   * @param context - Foreign rule context receiving diagnostics.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    /**
     * Reports a Symbol or Symbol.for call, detected via {@link isSymbolCall}
     * and {@link isSymbolForCall}, whose static description (read via
     * {@link staticDescription}) fails {@link classifySymbolDescription}.
     * Calls without a static string description are skipped.
     *
     * @param node - call expression visited by oxlint
     */
    function checkCallExpression(node: ForeignBorrowed<ESTree.CallExpression>,): void {
      if ((!isSymbolCall({ node, },)) && (!isSymbolForCall({ node, },)))
        return;
      /**
       * Static description text, or sentinel when not statically known.
       */
      const description = staticDescription({ node, },);
      if ((typeof description) !== 'string')
        return;
      /**
       * Verdict from the structural classifier.
       */
      const verdict = classifySymbolDescription({ description, },);
      if (verdict.status === 'pass')
        return;
      context.report({
        node,
        messageId: verdict.messageId,
      },);
    }

    return {
      CallExpression: checkCallExpression,
    };
  },
};
