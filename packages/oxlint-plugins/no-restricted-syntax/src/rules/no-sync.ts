import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import { getNodeSyncCalleeName, } from './no-sync.provenance.ts';

//region Rule definition

/**
 * Bans Node synchronous APIs while allowing non-Node libraries whose API names
 * merely end in `Sync`. Classifies each call callee via
 * {@link getNodeSyncCalleeName}.
 *
 * @example
 * ```ts
 * // Bad
 * import { readFileSync } from 'node:fs';
 * readFileSync(path);
 *
 * // Good
 * import { parseSync } from '\@optique/core/parser';
 * parseSync(parser, args);
 * ```
 */
export const noSync: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Node synchronous APIs while allowing non-Node Sync-named APIs.',
      recommended: true,
    },
    messages: {
      forbidden:
        'Node sync API `{{name}}` is banned. Use the asynchronous API instead.',
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
         * Node sync API name represented by this callee.
         */
        const calleeName = getNodeSyncCalleeName({
          context,
          expression: node.callee,
        },);
        if ((typeof calleeName) === 'symbol')
          return;
        context.report({
          node,
          messageId: 'forbidden',
          data: {
            name: calleeName,
          },
        },);
      },
    };
  },
};

//endregion Rule definition
