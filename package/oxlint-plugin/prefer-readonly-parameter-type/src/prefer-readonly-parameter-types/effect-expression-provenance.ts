/**
 * Which callable parameters one expression's value can be reached from.
 *
 * The single resolver every origin extractor delegates to. Before it existed,
 * `expressionOrigins` and `rootParameterOrigins` each stripped property and element
 * access down to an identifier and stopped, so they agreed only by coincidence and
 * both stopped at a call. Having one definition is what lets a verified member
 * result be followed to its receiver everywhere rather than in one extractor.
 *
 * @module
 */

import {
  type Node,
  SyntaxKind,
} from 'typescript/unstable/ast';
import {
  isBinaryExpression,
  isCallExpression,
  isConditionalExpression,
  isIdentifier,
  isNonNullExpression,
  isParenthesizedExpression,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  callResultReceiver,
  RESULT_NOT_RECEIVER_STATE,
} from './effect-member-result-relation.ts';
import {
  expressionRoot,
  NO_PARAMETER_ORIGIN,
  type ParameterOrigins,
} from './effect-summary-model.ts';

/**
 * Operators whose result is one of their two operands, unchanged.
 *
 * `??` is the one that matters, and a resolver handling only calls would miss this
 * package's own blocking shape: `target.get(key) ?? new Set()` is a
 * `BinaryExpression`, so following calls alone never reaches the lookup. Both
 * operands are possible values of the whole expression, so both contribute origins.
 *
 * `&&` and `||` are here for the same reason. Arithmetic and comparison operators are
 * not: their result is a fresh primitive, which carries no state to attribute.
 */
const VALUE_SELECTING_OPERATORS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.QuestionQuestionToken,
  SyntaxKind.BarBarToken,
  SyntaxKind.AmpersandAmpersandToken,
],);

/**
 * Sentinel when an expression wraps nothing whose value it passes through.
 *
 * A sentinel rather than `undefined`, since this repo models absence without nullish
 * unions.
 */
const NOTHING_WRAPPED: unique symbol = Symbol(
  'expression passes through no operand value',
);

/**
 * Expressions whose value is exactly their operand's.
 *
 * @param node - Expression to unwrap.
 *
 * @returns inner expression, or sentinel when nothing is wrapped.
 *
 * @example
 * ```ts
 * transparentOperand({ node });
 * ```
 */
function transparentOperand(
  { node, }: { readonly node: Node; },
): Node | typeof NOTHING_WRAPPED {
  return isParenthesizedExpression(node,) || isNonNullExpression(node,)
    ? node.expression
    : NOTHING_WRAPPED;
}

/**
 * Successor expressions whose origins the current expression inherits.
 *
 * Every returned node is a strict AST descendant of the input, which is what bounds
 * the walk: no step can revisit an ancestor, so the stack drains without needing a
 * visited set or a pass limit.
 *
 * @param project - TypeScript project proving default-library ownership.
 *
 * @param node - Expression whose value sources are wanted.
 *
 * @returns descendants contributing origins to this expression.
 *
 * @example
 * ```ts
 * provenanceSuccessors({ project, node });
 * ```
 */
function provenanceSuccessors({
  project,
  node,
}: {
  readonly project: Project;
  readonly node: Node;
},): readonly Node[] {
  /**
   * Operand of a wrapper that changes nothing about the value.
   */
  const unwrapped = transparentOperand({ node, },);
  if (unwrapped !== NOTHING_WRAPPED)
    return [unwrapped,];
  if (isConditionalExpression(node,))
    return [
      node.whenTrue,
      node.whenFalse,
    ];
  if (isBinaryExpression(node,)
    && VALUE_SELECTING_OPERATORS.has(node.operatorToken
      .kind,))
    return [
      node.left,
      node.right,
    ];
  if (!isCallExpression(node,))
    return [];
  /* A call contributes its receiver only when the result authority verifies that its
   * result is state the receiver held. Absent that, a call is where provenance stops:
   * the result is either fresh or unproven, and neither may be credited. */
  /**
   * Checker for the project resolving this call.
   */
  const { checker, } = project;
  /**
   * Receiver whose state this call's result is verified to be, when any.
   */
  const receiver = callResultReceiver({
    project,
    checker,
    call: node,
  },);
  return receiver === RESULT_NOT_RECEIVER_STATE
    ? []
    : [receiver,];
}

/**
 * Resolves every callable parameter one expression's value can be reached from.
 *
 * Walks the expression with an explicit stack rather than recursion, per `ITR`: the
 * shape being followed is a spine of receivers and operands, and branch operators
 * make it a small tree, so the stack both flattens it and unions the branches.
 *
 * @param project - TypeScript project resolving symbols and signatures.
 *
 * @param bindingOriginBySymbolId - Known parameter and alias origins.
 *
 * @param node - Expression whose value provenance is wanted.
 *
 * @returns every parameter origin the value can carry, empty when none.
 *
 * @example
 * ```ts
 * expressionValueOrigins({ project, bindingOriginBySymbolId, node });
 * ```
 */
export function expressionValueOrigins({
  project,
  bindingOriginBySymbolId,
  node,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, ParameterOrigins>;
  readonly node: Node;
},): ParameterOrigins {
  /**
   * Origins accumulated across every branch reached.
   */
  const origins = new Set<number>();
  /**
   * Expressions still to examine, each a descendant of one already seen.
   */
  const pending: Node[] = [node,];
  while (pending.length > 0) {
    /**
     * Next expression whose value sources are examined.
     */
    const current = pending.pop();
    if (current === undefined)
      continue;
    /**
     * Root after property and element access removal.
     */
    const root = expressionRoot(current,);
    if (isIdentifier(root,)) {
      /**
       * Symbol the root identifier resolves to.
       */
      const symbol = project.checker
        .getSymbolAtLocation(root,);
      /**
       * Origins already recorded for this binding.
       */
      const known = symbol === undefined
        ? NO_PARAMETER_ORIGIN
        : bindingOriginBySymbolId.get(symbol.id,) ?? NO_PARAMETER_ORIGIN;
      known.forEach(function collectKnown(origin,): void {
        origins.add(origin,);
      },);
      continue;
    }
    provenanceSuccessors({
      project,
      node: root,
    },)
      .forEach(function queueSuccessor(successor,): void {
        pending.push(successor,);
      },);
  }
  return origins.size === 0
    ? NO_PARAMETER_ORIGIN
    : origins;
}
