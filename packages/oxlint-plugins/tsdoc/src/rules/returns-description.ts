/**
 * TSDoc returns description validation rule.
 *
 * Extracted from `returns.ts` to keep files under 100 countable lines.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts/foreign-borrowed.ts';
import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  commentReportLoc,
  createFunctionTsdocVisitor,
} from './tsdoc-visitors.ts';

/**
 * Requires that returns tags have a description.
 *
 * Relies on the scanner's precomputed `hasDescription`, which is true when the
 * block has any non-whitespace text after the `\@returns` tag.
 *
 * @example
 * ```ts
 * // Bad; empty returns tag
 * /\** @returns *\/
 * function getName(): string { return 'name'; }
 *
 * // Good
 * /\** @returns display name of current user *\/
 * function getName(): string { return 'name'; }
 * ```
 */
export const requireReturnsDescription: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require descriptions for @returns tags.',
      recommended: true,
    },
    messages: {
      missingDescription: '@returns tag is missing a description.',
    },
  },
  /**
   * Handles effectful plugin callback.
   *
   * @param context - Foreign callback value carrying diagnostic capability.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return createFunctionTsdocVisitor({
      context,
      handler: function requireReturnsDescHandler(
        _node,
        result,
      ): void {
        /**
         * Parsed `\@returns` block on the comment; absent means nothing to validate.
         */
        const { returnsBlock, } = result.docComment;
        if (returnsBlock === undefined)
          return;
        if (!returnsBlock.hasDescription) {
          context.report({
            loc: commentReportLoc(result.comment,),
            messageId: 'missingDescription',
          },);
        }
      },
    },);
  },
};
