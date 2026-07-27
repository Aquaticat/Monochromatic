/**
 * Whether a tracked call result can leave the callable that produced it.
 *
 * This is the condition that licenses discharging a verified member call's receiver
 * opacity. The opacity report exists because nothing tracked the result as an alias;
 * once provenance tracks it, the report is redundant exactly while every use of the
 * result is one the analysis attributes. A use that leaves the callable is not, so the
 * report has to stay for those.
 *
 * Returning parameter-reachable state is benign by accepted policy, since the caller
 * already holds the parameter. That policy is about the callee not being blamed, not
 * about the value becoming untracked: until a caller substitutes through
 * `directReturned`, a returned result is still a use this analysis cannot follow, so it
 * counts as an escape here.
 *
 * @module
 */

import {
  type CallExpression,
  type Node,
  SyntaxKind,
} from 'typescript/unstable/ast';
import {
  isArrayLiteralExpression,
  isAssertionExpression,
  isBinaryExpression,
  isCallExpression,
  isConditionalExpression,
  isElementAccessExpression,
  isExpressionStatement,
  isIdentifier,
  isNonNullExpression,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPrefixUnaryExpression,
  isPropertyAccessExpression,
  isReturnStatement,
  isSatisfiesExpression,
  isTypeOfExpression,
  isVariableDeclaration,
  isVoidExpression,
  isYieldExpression,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  collectAstNodes,
  isEffectCallableDeclaration,
} from './effect-summary-model.ts';

/**
 * Binary operators that only test a value and keep no reference to it.
 */
const TESTING_OPERATORS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.EqualsEqualsEqualsToken,
  SyntaxKind.ExclamationEqualsEqualsToken,
  SyntaxKind.EqualsEqualsToken,
  SyntaxKind.ExclamationEqualsToken,
  SyntaxKind.InKeyword,
  SyntaxKind.InstanceOfKeyword,
  SyntaxKind.LessThanToken,
  SyntaxKind.GreaterThanToken,
  SyntaxKind.LessThanEqualsToken,
  SyntaxKind.GreaterThanEqualsToken,
],);

/**
 * Prefix operators that only test a value and keep no reference to it.
 */
const TESTING_PREFIX_OPERATORS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.ExclamationToken,
],);

/**
 * Operators whose value may be either operand's.
 */
const EITHER_OPERAND_PASSES: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.QuestionQuestionToken,
  SyntaxKind.BarBarToken,
],);

/**
 * Operators whose value is always the right operand's.
 */
const RIGHT_OPERAND_PASSES: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.EqualsToken,
  SyntaxKind.CommaToken,
],);

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
 * valueConsumer({ node: call });
 * ```
 */
function valueConsumer({ node, }: { readonly node: Node; },): Node {
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
 * Tests whether a node's parent yields this node's own value.
 *
 * @param node - Candidate contributing operand.
 *
 * @returns whether the parent's value can be this node's value.
 *
 * @example
 * ```ts
 * passesValueOutward({ node });
 * ```
 */
function passesValueOutward({ node, }: { readonly node: Node; },): boolean {
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
 * Tests whether a node sits in a position this analysis cannot follow.
 *
 * Attributed positions are deliberately enumerated rather than inferred from what is
 * left over, so an unfamiliar construct counts as an escape by default.
 *
 * @param node - Expression whose enclosing use is classified.
 *
 * @returns whether the value at this position leaves attributed tracking.
 *
 * @example
 * ```ts
 * useEscapes({ node: identifier });
 * ```
 */
function useEscapes({ node, }: { readonly node: Node; },): boolean {
  /**
   * Syntactic context consuming this value.
   */
  const { parent, } = node;
  if (isReturnStatement(parent,) || isYieldExpression(parent,))
    return true;
  /* Stored into a container or another object, which needs heap containment to
   * follow. */
  if (isObjectLiteralExpression(parent,) || isArrayLiteralExpression(parent,))
    return true;
  if (isBinaryExpression(parent,)
    && (parent.operatorToken
      .kind
      === SyntaxKind.EqualsToken)
    && (parent.right === node))
    /* Assigned somewhere. Only an assignment into a plain local keeps the value
     * inside attributed tracking, and that local is followed through the binding
     * origins instead, so anything else is a store this cannot follow. */
    return !isIdentifier(parent.left,);
  /* Reached as the object of a property or element access: attributed through
   * provenance, which follows the access down to this value's own origins. */
  if (isPropertyAccessExpression(parent,) || isElementAccessExpression(parent,))
    return false;
  if (isVariableDeclaration(parent,))
    return false;
  /* Only tested, never retained. An equality or relational comparison, `in`,
   * `instanceof`, `typeof`, `void` and logical negation all produce a fresh primitive
   * and keep no reference, so the value cannot leave through them. Without this,
   * the ubiquitous `if (stored === undefined) return;` guard counted as an escape and
   * nothing behind a null check could ever discharge. */
  if (isBinaryExpression(parent,)
    && TESTING_OPERATORS.has(parent.operatorToken
      .kind,))
    return false;
  if (isPrefixUnaryExpression(parent,)
    && TESTING_PREFIX_OPERATORS.has(parent.operator,))
    return false;
  if (isTypeOfExpression(parent,) || isVoidExpression(parent,))
    return false;
  /* Discarded outright. A value used as an expression statement is not stored, tested
   * or passed anywhere, so it cannot leave: `facts.get(key)?.add('x')` evaluates for
   * the mutation alone and drops the result. Without this, every chained mutation on a
   * looked-up value counted as an escape. */
  if (isExpressionStatement(parent,))
    return false;
  /* Passed as a call argument. The argument analysis already resolves each argument's
   * origins and records opacity against them when the callee is unresolved, so the
   * obligation has moved to that sink rather than disappearing. This is the one case
   * where "not escaping" means "reported elsewhere" instead of "fully attributed". */
  if (isCallExpression(parent,)) {
    /**
     * Whether this value is one of the call's arguments.
     */
    const isArgument = parent.arguments
      .some(function isThisArgument(argument,): boolean {
        return argument === node;
      },);
    if (isArgument)
      return false;
  }
  return true;
}

/**
 * Collects the local bindings that receive a call's result, directly or by alias.
 *
 * @param project - TypeScript project resolving binding symbols.
 *
 * @param call - Call whose result holders are wanted.
 *
 * @returns symbol ids holding the result, empty when it is never bound.
 *
 * @example
 * ```ts
 * resultHolderSymbolIds({ project, call });
 * ```
 */
function resultHolderSymbolIds({
  project,
  call,
}: {
  readonly project: Project;
  readonly call: CallExpression;
},): ReadonlySet<number> {
  /**
   * Symbol ids of bindings initialized from this call.
   */
  const holders = new Set<number>();
  /**
   * Declaration receiving the call result, when the call initializes one.
   */
  const { parent: declaration, } = valueConsumer({ node: call, },);
  if (!isVariableDeclaration(declaration,))
    return holders;
  if (!isIdentifier(declaration.name,))
    /* A destructuring pattern spreads the result across several bindings. Those
     * bindings already receive the initializer's origins, because
     * `registerBindingOrigin` recurses into binding patterns, so each extracted part
     * is attributed and no holder needs following here. */
    return holders;
  /**
   * Symbol declared by the receiving binding.
   */
  const symbol = project.checker
    .getSymbolAtLocation(declaration.name,);
  if (symbol !== undefined)
    holders.add(symbol.id,);
  return holders;
}

/**
 * Tests whether a verified call's result can leave the callable body.
 *
 * @param project - TypeScript project resolving symbols.
 *
 * @param body - Body of the callable containing the call.
 *
 * @param call - Verified member call whose result is tracked.
 *
 * @returns whether any use of the result is one this analysis cannot follow.
 *
 * @example
 * ```ts
 * resultEscapesCallable({ project, body, call });
 * ```
 */
export function resultEscapesCallable({
  project,
  body,
  call,
}: {
  readonly project: Project;
  readonly body: Node;
  readonly call: CallExpression;
},): boolean {
  /* The call's own position first. A call whose result is returned outright, or
   * placed straight into a container, escapes without ever being bound. */
  if (useEscapes({ node: valueConsumer({ node: call, },), },))
    return true;
  /**
   * Bindings that hold this call's result.
   */
  const holders = resultHolderSymbolIds({
    project,
    call,
  },);
  if (holders.size === 0)
    /* Not bound and not escaping by position: the result is consumed in place, which
     * the enumerated attributed positions already cover. */
    return false;
  return collectAstNodes(body,)
    .some(function referenceEscapes(node,): boolean {
      if (!isIdentifier(node,))
        return false;
      /**
       * Symbol this identifier resolves to.
       */
      const symbol = project.checker
        .getSymbolAtLocation(node,);
      if ((symbol === undefined) || (!holders.has(symbol.id,)))
        return false;
      /* A reference inside a nested callable outlives this scan's reasoning about
       * order, so treat any captured use as escaping. */
      return enclosedByNestedCallable({
        node,
        body,
      },) || useEscapes({ node: valueConsumer({ node, },), },);
    },);
}

/**
 * Tests whether a node sits inside a callable nested under the given body.
 *
 * @param node - Reference being classified.
 *
 * @param body - Outer callable body boundary.
 *
 * @returns whether a nested callable encloses the reference.
 *
 * @example
 * ```ts
 * enclosedByNestedCallable({ node, body });
 * ```
 */
function enclosedByNestedCallable({
  node,
  body,
}: {
  readonly node: Node;
  readonly body: Node;
},): boolean {
  /**
   * Cursor ascending toward the outer body.
   */
  const cursor: { current: Node; } = { current: node.parent, };
  while (cursor.current !== body) {
    if (isEffectCallableDeclaration(cursor.current,))
      return true;
    if (cursor.current
      .parent
      === cursor.current)
      return false;
    cursor.current = cursor.current
      .parent;
  }
  return false;
}
