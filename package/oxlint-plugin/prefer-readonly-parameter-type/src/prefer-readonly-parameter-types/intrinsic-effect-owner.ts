/**
 * Authored declaration owners for intrinsic effect identities.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import {
  isIdentifier,
  isSourceFile,
  isTypeAliasDeclaration,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';

/**
 * Sentinel when callable member has no enclosing authored declaration owner.
 */
export const NAMED_INTRINSIC_OWNER_UNAVAILABLE: unique symbol = Symbol(
  'absent named declaration owner for exact callable member',
);

/**
 * Finds named type-alias or ambient-var owner for anonymous callable member.
 *
 * Ambient `var` declarations identify DOM constructor objects such as
 * `AbortSignal`. Internal `const` fixtures remain anonymous so existing
 * package catalog identities do not depend on declaration implementation names.
 *
 * @param node - Callable member declaration parent.
 *
 * @returns Authored owner name or absence sentinel.
 *
 * @example
 * ```ts
 * intrinsicNamedOwner(declaration.parent);
 * ```
 */
export function intrinsicNamedOwner(
  node: Node,
): string | typeof NAMED_INTRINSIC_OWNER_UNAVAILABLE {
  /**
   * Parent cursor bounded by source-file root.
   */
  const cursor: { current: Node; } = { current: node, };
  while (!isSourceFile(cursor.current,)) {
    /**
     * Current ancestor isolated so property reads stay shallow.
     */
    const { current, } = cursor;
    if (isTypeAliasDeclaration(current,)) {
      /**
       * Authored alias name.
       */
      const { name, } = current;
      return name.text;
    }
    if (isVariableDeclaration(current,)) {
      /**
       * Candidate ambient variable name.
       */
      const { name, } = current;
      if (isIdentifier(name,)) {
        /**
         * Declaration-list text distinguishes ambient global `var` from package-local `const` fixtures.
         */
        const declarationListText = current
          .parent
          .getText();
        if (declarationListText.startsWith('var ',))
          return name.text;
      }
    }
    cursor.current = current.parent;
  }
  return NAMED_INTRINSIC_OWNER_UNAVAILABLE;
}
