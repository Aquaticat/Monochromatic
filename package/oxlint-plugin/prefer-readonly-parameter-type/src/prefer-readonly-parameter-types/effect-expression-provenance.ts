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
  isArrayLiteralExpression,
  isAssertionExpression,
  isBinaryExpression,
  isCallExpression,
  isConditionalExpression,
  isIdentifier,
  isNonNullExpression,
  isObjectLiteralExpression,
  isParenthesizedExpression,
  isPropertyAssignment,
  isSatisfiesExpression,
  isShorthandPropertyAssignment,
  isSpreadAssignment,
  isSpreadElement,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  NOT_A_VERIFIED_READER,
  READER_RESULT_CARRIES_OPERAND,
  verifiedReaderCall,
} from './effect-default-library-reader-authority.ts';
import {
  callResultReceiver,
  RESULT_NOT_RECEIVER_STATE,
} from './effect-member-result-relation.ts';
import type { EffectSlot, } from './effect-slot-identity.ts';
import { receiverElementsArePrimitive, } from './effect-primitive-origin.ts';
import {
  expressionRoot,
  NO_SLOT_ORIGIN,
  type SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Operators whose value may come from either operand.
 *
 * `??` is the one that matters most, and a resolver handling only calls would miss
 * this package's own blocking shape: `target.get(key) ?? new Set()` is a
 * `BinaryExpression`, so following calls alone never reaches the lookup. Measured
 * more widely than that: `expressionRoot` strips property access but not a binary
 * operator, so before this every alias established through `??` carried no origin at
 * all, including `config.eviction ?? []` in `package/module/kv-store`.
 *
 * `||` belongs here too, since it yields its left operand whenever that is truthy,
 * and a mutable object is truthy.
 *
 * `&&` deliberately does not, and that asymmetry is the point. It yields its left
 * operand only when that operand is falsy, and no falsy value is a mutable object, so
 * any object the expression produces came from the right operand. Following the left
 * one could only over-attribute: `input && new Set()` would credit `input` for a
 * `Set` that is always freshly built, and a false mutation record withholds a
 * read-only offer the parameter deserves. `&&` is handled as right-operand-only in
 * `provenanceSuccessors`.
 *
 * Arithmetic and comparison operators are absent because their result is a fresh
 * primitive, which carries no state to attribute.
 */
const EITHER_OPERAND_OPERATORS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.QuestionQuestionToken,
  SyntaxKind.BarBarToken,
],);

/**
 * Operators whose value is always their right operand's.
 *
 * `&&` for the truthiness reason recorded on `EITHER_OPERAND_OPERATORS`. Simple
 * assignment because `holder = facts.get(key)` evaluates to what was assigned, so a
 * mutation through the assignment expression's value reaches the right side. The comma
 * operator discards its left operand outright.
 */
const RIGHT_OPERAND_OPERATORS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.EqualsToken,
  SyntaxKind.CommaToken,
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
 * Every form here erases at runtime or passes its operand through unchanged, so the
 * value that arrives is the operand's own. `as`, an angle-bracket assertion and `satisfies`
 * matter as much as parentheses: `facts.get(key) as Set<string>` is the ordinary way
 * to narrow a lookup, and treating it as opaque loses attribution for the whole
 * expression.
 *
 * `await` is deliberately absent. Thenable assimilation means an awaited value need
 * not be the operand's, so admitting it would assert an identity nothing here proves.
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
  /**
   * Whether this node's value is exactly its operand's.
   */
  const passesThrough = isParenthesizedExpression(node,)
    || isNonNullExpression(node,)
    || isAssertionExpression(node,)
    || isSatisfiesExpression(node,);
  return passesThrough
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
  if (isBinaryExpression(node,)) {
    if (EITHER_OPERAND_OPERATORS.has(node.operatorToken
      .kind,))
      return [
        node.left,
        node.right,
      ];
    /* Right operand only, for the reason recorded on `EITHER_OPERAND_OPERATORS`: a
     * mutable object produced by `&&` or by an assignment can only be the right
     * operand's value. */
    if (RIGHT_OPERAND_OPERATORS.has(node.operatorToken
      .kind,))
      return [node.right,];
    return [];
  }
  if (isObjectLiteralExpression(node,))
    /* An aggregate holds whatever was written into it, so a callee writing through one of its
     * properties writes into the value that property holds. The literal's own identity is fresh
     * and is not what is being credited here: this resolver answers which caller parameters an
     * expression's value can reach, and everything a literal packages is reachable through it.
     *
     * Without this a local written once, `const packaged = { named: first, }`, carried no origin
     * at all, so `callee(packaged,)` attributed the callee's write to nothing and offered the row
     * it mutates as read-only. `localLiteralProvenance` in the slot-narrowing fixture measures
     * it. The same values reached through a literal written directly at the call site were always
     * collected, by `parameterIndexes`, so the two paths disagreed about identical state.
     *
     * Property assignments, shorthand and spreads all contribute. A method or accessor does not:
     * what it can reach is a body rather than a value, which `packagedCallableOrigins` answers
     * for the argument walk and which this resolver has no node to hand back for. */
    return node.properties
      .flatMap(function packagedValue(property,): readonly Node[] {
        if (isPropertyAssignment(property,))
          return [property.initializer,];
        if (isShorthandPropertyAssignment(property,))
          return [property.name,];
        if (isSpreadAssignment(property,))
          return [property.expression,];
        return [];
      },);
  if (isArrayLiteralExpression(node,))
    /* Elements for the same reason, with a spread contributing what it spreads.
     *
     * A spread of a container whose elements are all primitive contributes nothing, which is the
     * same rule `parameterIndexes` applies to a spread argument and is applied here so the two
     * walks cannot disagree about identical state. `[...values,]` over a `readonly string[]`
     * builds a fresh array of primitives that shares no object with `values`, so crediting
     * `values` reports a parameter nothing can reach. Measured on `copiedPrimitiveArray` in
     * `readonly-catalog-free-invalid.ts`, whose doc comment states exactly that intent. */
    return node.elements
      .flatMap(function packagedElement(element,): readonly Node[] {
        if (!isSpreadElement(element,))
          return [element,];
        /**
         * Type of the container being spread, when the checker resolves one.
         */
        const spreadType = project.checker
          .getTypeAtLocation(element.expression,);
        return ((spreadType !== undefined)
            && receiverElementsArePrimitive({
              checker: project.checker,
              type: spreadType,
            },))
          ? []
          : [element.expression,];
      },);
  if (!isCallExpression(node,))
    return [];
  /* Calling a callable the caller supplied. Whatever comes back was chosen by the
   * caller's function, so it may be caller-owned state, and the callee identifier is the
   * only handle on it this analysis has: a caller maps that parameter to whatever it
   * packaged there. Restricted to an identifier callee on purpose. A member callee would
   * make every `values.map(fn)` credit `values` for a container the member freshly
   * allocated, which is the distinction `FRESH_CONTAINER_MEMBER_NAMES` exists to keep.
   * An identifier that holds no parameter origin contributes nothing, so a call of a
   * local or imported function is unaffected. Measured on `callThroughMethodResult` in
   * the result-provenance fixture, which writes `get().label`. */
  if (isIdentifier(node.expression,))
    return [node.expression,];
  /* A call contributes its receiver only when the result authority verifies that its
   * result is state the receiver held. Absent that, a call is where provenance stops:
   * the result is either fresh or unproven, and neither may be credited. */
  /**
   * Checker for the project resolving this call.
   */
  const { checker, } = project;
  /* A verified reader's result holds the values it read, so provenance runs to the value
   * it was given rather than to its receiver, which is a global. */
  /**
   * Declaration this call resolves to, when one does.
   */
  const readerDeclaration = checker.getResolvedSignature(node,)
    ?.declaration
    ?.resolve(project,);
  if (readerDeclaration !== undefined) {
    /**
     * Verified reader and the value it reads, when this call is one.
     */
    const reader = verifiedReaderCall({
      project,
      checker,
      call: node,
      declaration: readerDeclaration,
    },);
    if ((reader !== NOT_A_VERIFIED_READER)
      && (reader.resultRelation === READER_RESULT_CARRIES_OPERAND))
      return [reader.operand,];
  }
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
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly node: Node;
},): SlotOrigins {
  /**
   * Origins accumulated across every branch reached.
   */
  const origins = new Set<EffectSlot>();
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
        ? NO_SLOT_ORIGIN
        : bindingOriginBySymbolId.get(symbol.id,) ?? NO_SLOT_ORIGIN;
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
    ? NO_SLOT_ORIGIN
    : origins;
}
