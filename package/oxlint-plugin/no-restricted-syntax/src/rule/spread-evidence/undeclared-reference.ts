/**
 Scope check for identifiers that no declaration in the linted file binds.

 `sourceCode.isGlobalReference` only recognizes globals the lint configuration
 declares. Measured on oxlint 1.85.0: without `env`, `Array` and `Object` are
 global and `Buffer` is not; with the shared config's
 `env: { browser, node, es2024 }`, `Buffer` is global but `Array` and `Object`
 are not, because an explicit `env` replaces the default builtin globals. Either
 way such an identifier names a host namespace or constructor, not a local
 binding, so this module asks the scope chain whether the file declares it.

 @module
 */

import type {
  Context,
  ESTree,
  Scope,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 Whether any scope from `scope` outward declares `name` with a definition in this file.

 @param scope - Innermost scope containing the reference.

 @param name - Referenced identifier name.

 @returns Whether a file-local declaration binds the name.

 @example
 ```ts
 isDeclaredInFile({ scope, name: 'rows' });
 ```
 */
function isDeclaredInFile(
  {
    scope,
    name,
  }: ForeignBorrowed<{
    readonly scope: Scope;
    readonly name: string;
  }>,
): boolean {
  /**
   Variable of that name in this scope, if any.
   */
  const variable = scope.set
    .get(name,);
  if ((variable !== undefined) && (variable.defs
    .length
    > 0))
    return true;
  /**
   Enclosing scope; the recursion depth is the file's scope nesting depth.
   */
  const { upper, } = scope;
  return (upper !== null) && isDeclaredInFile({
    scope: upper,
    name,
  },);
}

/**
 Whether an identifier refers to something no declaration in this file binds:
 a configured global, a host global the configuration does not list, or an
 implicit global.

 @param context - Rule context supplying scope analysis.

 @param identifier - Identifier reference to classify.

 @returns Whether the identifier is not bound by any file-local declaration.

 @example
 ```ts
 isUndeclaredReference({ context, identifier }); // true for Buffer in Buffer.concat(chunks)
 ```
 */
export function isUndeclaredReference(
  {
    context,
    identifier,
  }: ForeignBorrowed<{
    readonly context: Context;
    readonly identifier: ESTree.IdentifierReference;
  }>,
): boolean {
  if (context.sourceCode
    .isGlobalReference(identifier,))
    return true;
  return !isDeclaredInFile({
    scope: context.sourceCode
      .getScope(identifier,),
    name: identifier.name,
  },);
}
