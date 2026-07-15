import type {
  Context,
  CreateOnceRule,
  ESTree,
  Fixer,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { ErrorDetectionFixKind, } from './prefer-error-is-error.constants.ts';
import {
  getEqualityDetectorReplacement,
  getInstanceofErrorArgumentText,
  isNegatedEqualityOperator,
} from './prefer-error-is-error.detectors.ts';
import { getIsNativeErrorArgumentText, } from './prefer-error-is-error.node-util.ts';
import { getObjectTagEndsWithArgumentText, } from './prefer-error-is-error.object-tag.ts';
import { buildErrorIsErrorCall, } from './prefer-error-is-error.syntax.ts';

//region Reporting

/**
 * Reports a replaceable alternative Error detector, building the
 * replacement text via {@link buildErrorIsErrorCall}.
 *
 * @param context - Oxlint rule context.
 *
 * @param node - Node to report and replace.
 *
 * @param argumentText - Source text for value being tested.
 *
 * @param negated - Whether replacement should be negated.
 *
 * @param fixKind - Fix channel to use for this replacement.
 *
 * @example
 * ```ts
 * reportReplacement({
 *   context,
 *   node,
 *   argumentText: 'error',
 *   negated: false,
 *   fixKind: 'fix',
 * });
 * ```
 *
 * @mutates context - Emits Oxlint diagnostics through foreign rule context.
 */
function reportReplacement(
  {
    context,
    node,
    argumentText,
    negated,
    fixKind,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly node: ESTree.Node;
    readonly argumentText: string;
    readonly negated: boolean;
    readonly fixKind: ErrorDetectionFixKind;
  }>,
): void {
  /**
   * Canonical Error.isError call replacement.
   */
  const callText = buildErrorIsErrorCall({ argumentText, },);
  /**
   * Final replacement, optionally preserving a negated detector.
   */
  const replacement = negated ? `!${callText}` : callText;
  if (fixKind === 'suggestion') {
    context.report({
      node,
      messageId: 'forbidden',
      suggest: [
        {
          desc: 'Replace with Error.isError(value).',
          fix(fixer: ForeignBorrowed<Fixer>,): ReturnType<Fixer['replaceText']> {
            return fixer.replaceText(
              node,
              replacement,
            );
          },
        },
      ],
    },);
    return;
  }
  context.report({
    node,
    messageId: 'forbidden',
    fix(fixer: ForeignBorrowed<Fixer>,): ReturnType<Fixer['replaceText']> {
      return fixer.replaceText(
        node,
        replacement,
      );
    },
  },);
}

//endregion Reporting

/**
 * Prefers `Error.isError()` over older Error detection idioms.
 *
 * `instanceof Error` fails across realms, `Object.prototype.toString` checks are
 * verbose and stringly typed, constructor comparisons reject Error subclasses,
 * and Node's `util.types.isNativeError()` is deprecated in favor of
 * `Error.isError()`. Detects each idiom via {@link getInstanceofErrorArgumentText},
 * {@link getEqualityDetectorReplacement} (negation read via
 * {@link isNegatedEqualityOperator}), {@link getIsNativeErrorArgumentText},
 * and {@link getObjectTagEndsWithArgumentText}, then reports and fixes every
 * match via {@link reportReplacement}.
 *
 * @example
 * ```ts
 * // Bad
 * value instanceof Error;
 * Object.prototype.toString.call(value) === '[object Error]';
 * util.types.isNativeError(value);
 *
 * // Good
 * Error.isError(value,);
 * ```
 */
export const preferErrorIsError: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    hasSuggestions: true,
    docs: {
      description:
        'Disallow legacy Error detection. Use Error.isError() instead.',
      recommended: true,
    },
    messages: {
      forbidden:
        'Use Error.isError(value) instead of legacy Error detection methods.',
    },
  },
  /**
   * Creates legacy Error detector visitor.
   *
   * @param context - Foreign rule context receiving diagnostics.
   *
   * @mutates context - Emits replacement diagnostics through foreign context.
   *
   * @example
   * ```ts
   * preferErrorIsError.createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return {
      BinaryExpression(node: ForeignBorrowed<ESTree.BinaryExpression>,): void {
        /**
         * `value instanceof Error` argument text, if matched.
         */
        const instanceofArgumentText = getInstanceofErrorArgumentText({
          context,
          binary: node,
        },);
        if ((typeof instanceofArgumentText) !== 'symbol') {
          reportReplacement({
            context,
            node,
            argumentText: instanceofArgumentText,
            negated: false,
            fixKind: 'fix',
          },);
          return;
        }
        /**
         * Equality-based detector replacement metadata, if matched.
         */
        const equalityReplacement = getEqualityDetectorReplacement({
          context,
          binary: node,
        },);
        if ((typeof equalityReplacement) === 'symbol')
          return;
        reportReplacement({
          context,
          node,
          argumentText: equalityReplacement.argumentText,
          negated: isNegatedEqualityOperator({ operator: node.operator, }),
          fixKind: equalityReplacement.fixKind,
        },);
      },
      CallExpression(node: ForeignBorrowed<ESTree.CallExpression>,): void {
        /**
         * Node isNativeError detector argument text, if matched.
         */
        const isNativeErrorArgumentText = getIsNativeErrorArgumentText({
          context,
          call: node,
        },);
        if ((typeof isNativeErrorArgumentText) !== 'symbol') {
          reportReplacement({
            context,
            node,
            argumentText: isNativeErrorArgumentText,
            negated: false,
            fixKind: 'fix',
          },);
          return;
        }
        /**
         * Object.prototype.toString suffix detector argument text, if matched.
         */
        const objectTagEndsWithArgumentText = getObjectTagEndsWithArgumentText({
          context,
          call: node,
        },);
        if ((typeof objectTagEndsWithArgumentText) === 'symbol')
          return;
        reportReplacement({
          context,
          node,
          argumentText: objectTagEndsWithArgumentText,
          negated: false,
          fixKind: 'fix',
        },);
      },
    };
  },
};
