/**
 * Where a tracked value ends up, following the expressions that hand it onward.
 *
 * Split from `effect-result-escape.ts` because that file needed two answers from one walk
 * and could only express one. Ascending to the expression that finally consumes a value
 * is the right question for classifying that consumer, and it is the wrong question for
 * an assignment: `sink.value = selected` forwards its own value outward to whatever reads
 * the assignment expression, while separately storing into `sink`. A single terminal node
 * cannot represent both, so the store is classified during the ascent and the consumer is
 * returned from it.
 *
 * @module
 */

import {
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
  isPropertyAssignment,
  isSatisfiesExpression,
  isShorthandPropertyAssignment,
  isSpreadAssignment,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

/**
 * Operators whose value may be either operand's.
 *
 * Exported so `effect-result-holders.ts` descends by the same policy this file ascends
 * by. Two copies of the operand rules would let the holder closure disagree with the
 * consumer walk about which operand carries a value.
 */
export const EITHER_OPERAND_PASSES: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.QuestionQuestionToken,
  SyntaxKind.BarBarToken,
],);

/**
 * Operators whose value is always the right operand's.
 *
 * {@inheritDoc EITHER_OPERAND_PASSES}
 */
export const RIGHT_OPERAND_PASSES: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.EqualsToken,
  SyntaxKind.CommaToken,
],);

/**
 * Tests whether a node's parent yields this node's own value.
 *
 * @param node - Candidate contributing operand.
 *
 * @returns whether parent's value can be this node's value.
 *
 * @example
 * ```ts
 * passesValueOutward({ node, });
 * ```
 */
export function passesValueOutward({ node, }: { readonly node: Node; },): boolean {
  /**
   * Syntactic context possibly forwarding this value.
   */
  const { parent, } = node;
  if (isParenthesizedExpression(parent,)
    || isNonNullExpression(parent,)
    || isAssertionExpression(parent,)
    || isSatisfiesExpression(parent,))
    return true;
  if (isConditionalExpression(parent,))
    return (parent.whenTrue === node) || (parent.whenFalse === node);
  /* A property's value flows into the literal that holds it, so the position that
   * decides escape is the literal's, not the property's. Without this step the
   * enclosing literal is never reached: the parent of a property value is the
   * `PropertyAssignment`, and the literal is its grandparent. */
  if (isPropertyAssignment(parent,)
    || isShorthandPropertyAssignment(parent,)
    || isSpreadAssignment(parent,))
    return true;
  if (!isBinaryExpression(parent,))
    return false;
  /**
   * Operator deciding which operands can be the expression's value.
   */
  const operator = parent.operatorToken
    .kind;
  /* Mirrors the operand policy in `effect-expression-provenance.ts`: `??` and `||`
   * can yield either operand, while `&&`, assignment and comma yield only the right. */
  if (EITHER_OPERAND_PASSES.has(operator,))
    return (parent.left === node) || (parent.right === node);
  return RIGHT_OPERAND_PASSES.has(operator,) && (parent.right === node);
}

/**
 * Ascends to the expression that actually consumes this value.
 *
 * The mirror of the descent in `effect-expression-provenance.ts`, and needed for the
 * same reason. `facts.get(key) ?? new Set()` makes the call's parent the `??`
 * expression rather than the declaration, so classifying the call's immediate parent
 * called every such lookup an escape and no discharge ever fired. Parentheses,
 * assertions and the value-selecting operators all hand the value onward, so the
 * position that decides escape is the first parent that does something else with it.
 *
 * @param node - Expression whose consuming position is wanted.
 *
 * @returns outermost expression carrying this same value.
 *
 * @example
 * ```ts
 * valueConsumer({ node: call, });
 * ```
 */
export function valueConsumer({ node, }: { readonly node: Node; },): Node {
  /**
   * Cursor ascending while each parent passes the value through unchanged.
   */
  const cursor: { current: Node; } = { current: node, };
  while (passesValueOutward({ node: cursor.current, },))
    cursor.current = cursor.current
      .parent;
  return cursor.current;
}

/**
 * Tests whether a node sits inside a container node.
 *
 * @param node - Node whose containment is tested.
 *
 * @param container - Boundary the node may sit within.
 *
 * @returns whether container encloses node, or is it.
 *
 * @example
 * ```ts
 * nodeWithin({ node: declaration, container: body, });
 * ```
 */
function nodeWithin({
  node,
  container,
}: {
  readonly node: Node;
  readonly container: Node;
},): boolean {
  /**
   * Cursor ascending toward the container.
   */
  const cursor: { current: Node; } = { current: node, };
  while (cursor.current !== container) {
    if (cursor.current
      .parent
      === cursor.current)
      return false;
    cursor.current = cursor.current
      .parent;
  }
  return true;
}

/**
 * Tests whether an assignment target is a binding declared inside this callable.
 *
 * An identifier alone does not establish it, which is why the symbol is resolved rather
 * than the syntax trusted. A module-level `let escaped` assigned from inside a callable
 * is an identifier target and is nonetheless a store this analysis cannot follow, so
 * treating every identifier as local would launder exactly the case the check exists for.
 *
 * @param project - TypeScript project resolving the target symbol.
 *
 * @param target - Left-hand side of one assignment.
 *
 * @param body - Body of callable containing the assignment.
 *
 * @returns whether target names a binding local to this callable.
 *
 * @example
 * ```ts
 * targetIsCallableLocal({ project, target: assignment.left, body, });
 * ```
 */
export function targetIsCallableLocal({
  project,
  target,
  body,
}: {
  readonly project: Project;
  readonly target: Node;
  readonly body: Node;
},): boolean {
  if (!isIdentifier(target,))
    return false;
  /**
   * Symbol the target identifier resolves to.
   */
  const symbol = project.checker
    .getSymbolAtLocation(target,);
  if (symbol === undefined)
    return false;
  return symbol.declarations
    .some(function declaredInside(handle,): boolean {
      /**
       * Resolved declaration of the assigned binding.
       */
      const declaration = handle.resolve(project,);
      return (declaration !== undefined)
        && nodeWithin({
          node: declaration,
          container: body,
        },);
    },);
}

/**
 * Tests whether any assignment on a value's outward path stores it beyond tracking.
 *
 * This is the classification `useEscapes` was written to perform and could never reach.
 * Both of its call sites hand it `valueConsumer` of the node, `RIGHT_OPERAND_PASSES`
 * contains `EqualsToken`, and `passesValueOutward` ascends the right operand of an
 * assignment, so a node whose parent is an assignment it contributes to never arrives
 * there. `sink.value = selected` reached `useEscapes` as the assignment expression, whose
 * parent is an `ExpressionStatement`, and was discarded as consumed in place.
 *
 * Property and element targets are named among the sinks requiring coverage in
 * `doc/decision/prefer-readonly-result-provenance.md`, so this closes the gap between
 * that constraint and the code.
 *
 * A callable-local identifier target is a transfer rather than an escape: the value stays
 * inside the body, and following it there is the holder set's job rather than this walk's.
 *
 * @param project - TypeScript project resolving target symbols.
 *
 * @param node - Expression whose outward path is classified.
 *
 * @param body - Body of callable containing the expression.
 *
 * @returns whether some assignment stores this value where nothing follows it.
 *
 * @example
 * ```ts
 * assignmentStoreEscapes({ project, node: call, body, });
 * ```
 */
export function assignmentStoreEscapes({
  project,
  node,
  body,
}: {
  readonly project: Project;
  readonly node: Node;
  readonly body: Node;
},): boolean {
  /**
   * Cursor ascending the same path `valueConsumer` takes.
   */
  const cursor: { current: Node; } = { current: node, };
  while (passesValueOutward({ node: cursor.current, },)) {
    /**
     * Expression forwarding the value one step outward.
     */
    const { parent, } = cursor.current;
    if (isBinaryExpression(parent,)
      && (parent.operatorToken
        .kind
        === SyntaxKind.EqualsToken)
      && (parent.right === cursor.current)
      && (!targetIsCallableLocal({
        project,
        target: parent.left,
        body,
      },)))
      return true;
    cursor.current = parent;
  }
  return false;
}
