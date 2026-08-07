/**
 * Which value a local binding was declared with.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import {
  isIdentifier,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import type {
  Checker,
  Project,
} from 'typescript/unstable/sync';

/**
 * Sentinel when a name stands for no local declaration carrying a value.
 *
 * A sentinel rather than `undefined`, since this repo models absence without nullish
 * unions.
 */
export const NO_BINDING_INITIALIZER: unique symbol = Symbol(
  'name declares no local initializer',
);

/**
 * Resolves the value a name was declared with, when it names one local declaration.
 *
 * One definition of the declaration hop, shared rather than repeated. Both walks that need
 * it ask a different question afterwards, and that is exactly why the step itself has to be
 * the same: `containerElementReceiver` follows it looking for a call carrying a container
 * relation, while `expressionElementOrigins` follows it looking for anywhere a relation
 * might be, including inside a selector. When the hop lived only in the first, the two could
 * not compose, and `const copy = cond ? rows.slice() : [];` reached neither answer.
 *
 * Only a declaration initializer is resolved, never a later assignment. That is the
 * over-attributing direction and deliberate: a reassigned local keeps answering for the
 * container it was declared with, which costs precision and never an offer.
 *
 * A binding with more than one declaration answers the sentinel. Merged declarations mean
 * the name does not stand for one value, and picking one of them would assert an identity
 * nothing here proves.
 *
 * @param project - TypeScript project resolving declarations.
 *
 * @param checker - TypeScript checker resolving binding symbols.
 *
 * @param node - Name whose declared value is wanted.
 *
 * @returns declared initializer, or sentinel when there is no single local one.
 *
 * @example
 * ```ts
 * bindingDeclarationInitializer({ project, checker, node: receiver });
 * ```
 */
export function bindingDeclarationInitializer({
  project,
  checker,
  node,
}: {
  readonly project: Project;
  readonly checker: Checker;
  readonly node: Node;
},): Node | typeof NO_BINDING_INITIALIZER {
  if (!isIdentifier(node,))
    return NO_BINDING_INITIALIZER;
  /**
   * Binding this name stands for.
   */
  const symbol = checker.getSymbolAtLocation(node,);
  if ((symbol === undefined)
    || (symbol.declarations
      .length
      !== 1))
    return NO_BINDING_INITIALIZER;
  /**
   * Declaration the binding was introduced by, resolved into this project.
   */
  const declaration = symbol.declarations[0]
    ?.resolve(project,);
  if ((declaration === undefined)
    || (!isVariableDeclaration(declaration,))
    || (declaration.initializer === undefined))
    return NO_BINDING_INITIALIZER;
  return declaration.initializer;
}
