import type {
  CreateOnceRule,
  ESTree,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { simpleBanRule, } from './_simple-ban-rule.ts';

/**
 * Requires `catch` clauses to bind caught values. Built via
 * {@link simpleBanRule}.
 *
 * `catch {}` hides the thrown value at the boundary where the failure is
 * observed. Bind the value, usually as `error`, so code can log it, rethrow it,
 * or make the intentional ignore visible in the block.
 *
 * @example
 * ```ts
 * // Bad
 * try {
 *   await run();
 * } catch {
 *   recover();
 * }
 *
 * // Good
 * try {
 *   await run();
 * } catch (caughtError) {
 *   logger.error(caughtError);
 *   recover();
 * }
 * ```
 */
export const catchBinding: CreateOnceRule = simpleBanRule({
  type: 'problem',
  nodeType: 'CatchClause',
  description:
    'Disallow catch clauses without bindings. Use a named catch binding so the thrown value stays available.',
  messageId: 'forbidden',
  message: [
    'catch without a binding is banned. Use `catch (error) {}` or another ',
    'named binding so the thrown value stays available.',
  ].join('',),
  shouldReport(node: ForeignBorrowed<ESTree.Node>,): boolean {
    return (node.type === 'CatchClause') && (node.param === null);
  },
},);
