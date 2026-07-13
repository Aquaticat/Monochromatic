import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import {
  getStaticCallMemberName,
  NO_STATIC_MEMBER_NAME,
} from './ast-shared.ts';

/**
 * Bans `.trimLeft()` and `.trimRight()` in favor of `.trimStart()` and
 * `.trimEnd()`, matched via {@link getStaticCallMemberName}.
 *
 * `trimLeft()` and `trimRight()` are deprecated aliases introduced before
 * the language adopted logical naming conventions. The standard names
 * `trimStart()` and `trimEnd()` align with `padStart()`/`padEnd()` and
 * avoid directional assumptions in RTL contexts.
 *
 * @example
 * ```ts
 * // Bad
 * str.trimLeft();
 * str.trimRight();
 *
 * // Good
 * str.trimStart();
 * str.trimEnd();
 * ```
 */
export const noTrimLeftRight: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow .trimLeft()/.trimRight(). Use .trimStart()/.trimEnd() instead.',
      recommended: true,
    },
    messages: {
      forbiddenLeft: '.trimLeft() is deprecated. Use .trimStart() instead.',
      forbiddenRight: '.trimRight() is deprecated. Use .trimEnd() instead.',
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
    return {
      CallExpression(node: ForeignBorrowed<ESTree.CallExpression>,): void {
        /**
         * Static member-access name, matched against the deprecated trim aliases.
         */
        const name = getStaticCallMemberName({ call: node, },);
        if (name === NO_STATIC_MEMBER_NAME)
          return;
        if (name === 'trimLeft') {
          context.report({
            node,
            messageId: 'forbiddenLeft',
          },);
        }
        else if (name === 'trimRight') {
          context.report({
            node,
            messageId: 'forbiddenRight',
          },);
        }
      },
    };
  },
};
