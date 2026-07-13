import type {
  CreateOnceRule,
  ESTree,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts';

import { simpleBanRule, } from './_simple-ban-rule.ts';

/**
 * Bans `try...finally` blocks in favor of `using`/`await using` for cleanup.
 * Built via {@link simpleBanRule}.
 *
 * The `using` declaration with `Symbol.dispose`/`Symbol.asyncDispose` provides
 * deterministic cleanup without the nesting and control flow complexity of
 * `finally` blocks.
 *
 * Only the `finally` clause is banned; `try...catch` without `finally` is fine.
 *
 * @example
 * ```ts
 * // Bad
 * const handle = openResource();
 * try {
 *   await process(handle);
 * } finally {
 *   handle.close();
 * }
 *
 * // Good
 * await using handle = openResource();
 * await process(handle);
 * ```
 */
export const noTryFinally: CreateOnceRule = simpleBanRule({
  type: 'suggestion',
  nodeType: 'TryStatement',
  description:
    'Disallow try...finally blocks. Use using/await using for cleanup instead.',
  messageId: 'forbidden',
  message:
    'try...finally is banned. Use using/await using with Symbol.dispose for cleanup instead.',
  shouldReport(node: ForeignBorrowed<ESTree.Node>,): boolean {
    return (node.type === 'TryStatement') && (node.finalizer !== null);
  },
},);
