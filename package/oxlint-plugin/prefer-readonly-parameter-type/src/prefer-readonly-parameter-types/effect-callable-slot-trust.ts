/**
 * Whether a callee's declared result type is a claim about a body or about a slot.
 *
 * The completion gate trusts a declared return type whenever it cannot resolve the callee to a body it
 * can read. That trust is right for most types and wrong for one, and the difference is a specific rule
 * in the language rather than anything about this analysis.
 *
 * TypeScript permits assigning a value-returning function where a `void`-returning one is expected. It
 * does not permit the same substitution for any other return type. Verified against the compiler rather
 * than recalled, with the control carrying the directive so an unused one would have reported:
 *
 * ```ts
 * export const acceptedAsVoid: () => void = produceRow;
 * // @ts-expect-error a row-returning callable is not assignable where a string-returning one is wanted
 * export const acceptedAsString: () => string = produceRow;
 * ```
 *
 * So `void` on a callable *type* constrains nothing about what the callable returns, while `string`
 * constrains it. Measured, that gap left a capture certified inert: a formal annotated `() => void`,
 * invoked inside a closure handed to a registry, while the caller passed `(): Row => config.row` and
 * the registry handed that row out.
 *
 * The distinction is not `void` against other types on its own. It is whether the annotation belongs to
 * a body or to a slot. An ambient `declare function` states `void` about its own implementation, and
 * nothing can substitute a different body for it. A parameter, a mutable local or a member signature
 * names a slot whose runtime value the language permits to return something.
 *
 * @module
 */

import type {
  CallExpression,
  Node,
} from 'typescript/unstable/ast';
import {
  isFunctionLikeDeclaration,
  isIdentifier,
} from 'typescript/unstable/ast/is';
import {
  type Project,
  TypeFlags,
} from 'typescript/unstable/sync';

import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';

/**
 * Tests whether one call's result can carry mutable state when no owned callee answered.
 *
 * Asked only where the callee resolved to nothing this analysis can read, so the declared type is all
 * that is left. Every type but `void` is taken at its word, which is what keeps
 * `(): string => String(config.row,)` offered and is the policy the rest of this rule follows for an
 * external declaration.
 *
 * @param project - TypeScript project resolving the callee and typing the result.
 *
 * @param root - Call expression standing as a completion.
 *
 * @returns whether the result can carry caller-owned mutable state.
 *
 * @example
 * ```ts
 * unresolvedResultCanCarryState({ project, root });
 * ```
 */
export function unresolvedResultCanCarryState({
  project,
  root,
}: {
  readonly project: Project;
  readonly root: CallExpression;
},): boolean {
  if (resultIsVoid({
    project,
    node: root,
  },)
    && (!calleeNamesCallableDeclaration({
      project,
      callee: root.expression,
    },)))
    return true;
  return expressionCanCarryMutableState({
    checker: project.checker,
    node: root,
  },);
}

/**
 * Tests whether one expression's type is `void`.
 *
 * Asked separately from the leaf test because `void` is a primitive by that test, which is exactly why
 * it certified a capture as inert.
 *
 * @param project - TypeScript project typing the expression.
 *
 * @param node - Expression whose type is wanted.
 *
 * @returns whether the type is `void`.
 *
 * @example
 * ```ts
 * resultIsVoid({ project, node });
 * ```
 */
function resultIsVoid({
  project,
  node,
}: {
  readonly project: Project;
  readonly node: Node;
},): boolean {
  /**
   * Semantic type of the expression, absent when the bridge cannot classify it.
   */
  const type = project.checker
    .getTypeAtLocation(node,);
  return (type !== undefined)
    && ((type.flags & TypeFlags.Void) !== 0);
}

/**
 * Tests whether one callee expression names callable declarations rather than a slot holding one.
 *
 * Every declaration the symbol names must be callable, not merely one of them. A symbol naming both a
 * declaration and a slot cannot promise the slot is unused, and this question exists to decide whether
 * a promise can be trusted.
 *
 * An absent symbol answers no, which withholds. A callee this analysis cannot even resolve to a symbol
 * is the last thing whose annotation should be believed.
 *
 * @param project - TypeScript project resolving the callee's symbol.
 *
 * @param callee - Callee expression of the call.
 *
 * @returns whether the callee names callable declarations only.
 *
 * @example
 * ```ts
 * calleeNamesCallableDeclaration({ project, callee });
 * ```
 */
function calleeNamesCallableDeclaration({
  project,
  callee,
}: {
  readonly project: Project;
  readonly callee: Node;
},): boolean {
  /**
   * Symbol the callee expression resolves to.
   */
  const symbol = isIdentifier(callee,)
    ? project.checker
      .getResolvedSymbol(callee,)
    : project.checker
      .getSymbolAtLocation(callee,);
  /**
   * Declarations that symbol names.
   */
  const declarations = symbol
    ?.declarations;
  if ((declarations === undefined) || (declarations.length === 0))
    return false;
  return declarations.every(function namesCallable(declaration,): boolean {
    /**
     * Declaration resolved into the project owning it.
     */
    const resolved = declaration.resolve(project,);
    return (resolved !== undefined)
      && isFunctionLikeDeclaration(resolved,);
  },);
}
