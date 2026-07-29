/**
 * Every expression one expression can evaluate to, without evaluating anything.
 *
 * The store path asks what a value handed outward can be, and it had been asking by testing
 * syntax: is this written as a callable. That answered for the inline form and missed the two
 * shapes ordinary source actually writes, both falsified:
 *
 * ```ts
 * holder.produce = condition ? ((): Row => config.row) : fallback;
 *
 * const box = { produce: (): Row => config.row, };
 * holder.box = box;
 * ```
 *
 * A branch per form is what this exists to avoid. The question is one question, so it gets one
 * walk, and the callers then ask their own questions of each answer: whether it is a callable,
 * or what origins it packages.
 *
 * Additive rather than substitutive. Every node reports itself alongside whatever it can be
 * followed to, so a caller that already handled the written form keeps handling it. An
 * identifier aliasing `config.row` therefore still answers with the identifier, whose origins
 * the binding map holds, as well as with the initializer it was bound to.
 *
 * What it refuses to enter is as load-bearing as what it follows. A call is not descended,
 * because a call's result is a separate relation with its own deferral machinery, and claiming
 * the callee expression is a possible result would make every call look like its own callee. A
 * conditional's condition, an assignment's target, a computed key, a discarded operand and any
 * arithmetic operand are not values the expression evaluates to. A nested callable's body is
 * not entered either, because what a callable can be is the callable, and what it can reach is
 * the question `effect-callable-capture-closure.ts` answers.
 *
 * @module
 */

import {
  type Identifier,
  type Node,
  SyntaxKind,
} from 'typescript/unstable/ast';
import {
  isAssertionExpression,
  isBinaryExpression,
  isConditionalExpression,
  isIdentifier,
  isNonNullExpression,
  isParenthesizedExpression,
  isSatisfiesExpression,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

/**
 * Operators whose right operand alone is the value of the expression.
 *
 * `&&` yields its right operand only when it yields anything derived from the left at all, and
 * its left operand is discarded whenever the right is produced. Assignment yields what was
 * assigned. A comma yields its right operand and evaluates the left for effect.
 */
const RIGHT_OPERAND_VALUE_OPERATORS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.EqualsToken,
  SyntaxKind.CommaToken,
],);

/**
 * Operators where either operand can be the value of the expression.
 */
const EITHER_OPERAND_VALUE_OPERATORS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.QuestionQuestionToken,
  SyntaxKind.BarBarToken,
],);

/**
 * Collects every expression one expression can evaluate to, following aliases and branches.
 *
 * @param project - TypeScript project resolving identifiers to their declarations.
 *
 * @param node - Expression whose possible values are wanted.
 *
 * @returns nodes the expression can evaluate to, including the expression itself.
 *
 * @example
 * ```ts
 * possibleValueNodes({ project, node });
 * ```
 */
export function possibleValueNodes({
  project,
  node,
}: {
  readonly project: Project;
  readonly node: Node;
},): readonly Node[] {
  /**
   * Answers found so far, keyed by source span so an alias cycle terminates.
   */
  const seen = new Map<string, Node>();
  /**
   * Expressions still to expand.
   */
  const pending: Node[] = [node,];
  while (pending.length > 0) {
    /**
     * Next expression being expanded.
     */
    const current = pending.pop();
    if (current === undefined)
      continue;
    /**
     * Span identifying this expression across one analysis.
     */
    const key = `${current.getSourceFile()
      .fileName}:${String(current.pos,)}:${String(current.end,)}`;
    if (seen.has(key,))
      continue;
    seen.set(
      key,
      current,
    );
    followedValues({
      project,
      node: current,
    },)
      .forEach(function enqueueFollowed(followed,): void {
        pending.push(followed,);
      },);
  }
  return [...seen.values(),];
}

/**
 * Names the expressions one expression hands its value on from.
 *
 * @param project - TypeScript project resolving identifiers to their declarations.
 *
 * @param node - Expression being expanded by one step.
 *
 * @returns expressions whose value this expression can take.
 *
 * @example
 * ```ts
 * followedValues({ project, node });
 * ```
 */
function followedValues({
  project,
  node,
}: {
  readonly project: Project;
  readonly node: Node;
},): readonly Node[] {
  if (isParenthesizedExpression(node,)
    || isNonNullExpression(node,)
    || isAssertionExpression(node,)
    || isSatisfiesExpression(node,))
    return [node.expression,];
  if (isConditionalExpression(node,))
    return [
      node.whenTrue,
      node.whenFalse,
    ];
  if (isBinaryExpression(node,)) {
    /**
     * Operator deciding which operands carry the value.
     */
    const operator = node.operatorToken
      .kind;
    if (EITHER_OPERAND_VALUE_OPERATORS.has(operator,))
      return [
        node.left,
        node.right,
      ];
    if (RIGHT_OPERAND_VALUE_OPERATORS.has(operator,))
      return [node.right,];
    return [];
  }
  if (!isIdentifier(node,))
    return [];
  return aliasedInitializer({
    project,
    node,
  },);
}

/**
 * Follows one identifier to the initializer it was bound to, when it has one.
 *
 * Only a declaration with an initializer answers. A parameter, an import and a binding filled
 * by assignment alone hand back nothing here, which is correct for this walk: what they can be
 * is not written at their declaration, and guessing would claim a value the source never gave.
 *
 * @param project - TypeScript project resolving the identifier.
 *
 * @param node - Identifier being followed.
 *
 * @returns initializer the identifier was bound to, or nothing.
 *
 * @example
 * ```ts
 * aliasedInitializer({ project, node });
 * ```
 */
function aliasedInitializer({
  project,
  node,
}: {
  readonly project: Project;
  readonly node: Identifier;
},): readonly Node[] {
  /**
   * Symbol the identifier resolves to.
   */
  const symbol = project.checker
    .getResolvedSymbol(node,);
  /**
   * Declaration owning that symbol.
   */
  const first = symbol
    ?.declarations
    .at(0,);
  /**
   * Declaration the symbol names, preferring the one carrying its value.
   */
  const declared = symbol
    ?.valueDeclaration
    ?? first;
  /**
   * Declaration resolved into the project owning it.
   */
  const declaration = declared
    ?.resolve(project,);
  if (declaration === undefined)
    return [];
  if (!isVariableDeclaration(declaration,))
    return [];
  if (declaration.initializer === undefined)
    return [];
  return [declaration.initializer,];
}
