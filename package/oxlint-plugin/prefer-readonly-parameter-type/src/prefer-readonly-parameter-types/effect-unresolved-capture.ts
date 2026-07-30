/**
 * Caller opacity for a capture handed to a call this analysis cannot inspect.
 *
 * Captures were recorded on owned call edges only, and a call with no owned edge builds no edge to
 * record anything on. That was scoped deliberately, on the grounds that folding captures into
 * ordinary origins would withhold on `rows.map((row) => config.row.label,)` against every callee
 * this analysis cannot resolve. The scoping was right about the cost and wrong about the risk.
 *
 * Falsified twice. A continuation:
 *
 * ```ts
 * async function handInlineToContinuation(inlineThen: Config,): Promise<Row> {
 *   return await Promise.resolve()
 *     .then((): Row => inlineThen.row,);
 * }
 * ```
 *
 * and an ordinary instance method:
 *
 * ```ts
 * class Registry {
 *   register(callback: () => Row,): void {
 *     callbackHolder.produce = callback;
 *   }
 * }
 *
 * function handToRegistry(registered: Config, registry: Registry,): void {
 *   registry.register((): Row => registered.row,);
 * }
 * ```
 *
 * The second is why this matters far beyond library calls. A possibly-overridden method is treated
 * as unresolved on purpose, because an override can write what the base only reads, so **every**
 * instance method that keeps a callback was losing the capture. Measured directly: the same
 * retainer written as an instance method records nothing for the captured parameter, written as a
 * static records `opaque=[0]`, written as a plain function records `opaque=[0]`.
 *
 * ## What decides whether to withhold
 *
 * Only what invoking the packaged callable hands back. Two facts make that the whole question.
 *
 * Writes the callable performs are already charged. A callable handed as an argument is activated
 * by `activateEscapedCallables`, so the body scan reaches it, and that is measured rather than
 * assumed: a writing closure handed to `setTimeout` and the same closure handed to an overridable
 * method both record `mutated=[0]`. This channel therefore needs to answer for nothing the callable
 * does to the origin, only for what it exposes.
 *
 * And what it exposes is bounded by its result. A callee that cannot be inspected may keep the
 * callable, invoke it now, invoke it later, store or write through what it produced. Every one of
 * those reaches the origin only through a value the callable handed back, so a callable whose every
 * completion is a leaf exposes nothing whatever the callee does. That is what keeps
 * `rows.map((row) => config.row.label,)` offered.
 *
 * The **actual** callable is inspected rather than the formal's declared callback type, because
 * TypeScript accepts a value-returning function where `() => void` is expected, so the formal can
 * conceal a row result entirely.
 *
 * A result this analysis cannot read counts as carrying state, which is what
 * `expressionCanCarryMutableState` already does with an absent type, and a callable whose body
 * cannot be read at all counts the same way.
 *
 * ## What it does not recover
 *
 * A known callee that discards what it was handed. `setTimeout` throws its callback's result away,
 * so withholding there is a precision loss this gate accepts rather than a soundness need. Proving
 * it needs a per-callee effect contract, since no local property of the call expression can
 * establish what an uninspectable implementation does with a value.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import {
  isBlock,
  isFunctionLikeDeclaration,
  isReturnStatement,
  isYieldExpression,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  addOpaqueEffect,
  callableDeclaration,
} from './effect-call-resolution.ts';
import { packagedActualCallables, } from './effect-captured-argument-origins.ts';
import { transitiveCallableOrigins, } from './effect-callable-capture-closure.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import { returnBelongsToCallable, } from './effect-return-effects.ts';
import {
  collectAstNodes,
  type MutableEffectSummary,
  OWNED_CALLABLE_UNAVAILABLE,
  type SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Records opacity for every capture handed to a call with no owned edge.
 *
 * @param project - TypeScript project resolving callables and binding symbols.
 *
 * @param bindingOriginBySymbolId - Parameter and alias origins of the callable being summarised.
 *
 * @param summary - Caller summary receiving opacity.
 *
 * @param actuals - Argument expressions of the unresolved call.
 *
 * @param provenance - Cause naming the unresolved call, shared with its ordinary origins.
 *
 * @mutates summary - Adds an opaque slot per exposed capture, with the call named as its cause.
 *
 * @example
 * ```ts
 * recordUnresolvedCaptureOpacity({
 *   project,
 *   bindingOriginBySymbolId,
 *   summary,
 *   actuals,
 *   provenance,
 * });
 * ```
 */
export function recordUnresolvedCaptureOpacity({
  project,
  bindingOriginBySymbolId,
  summary,
  actuals,
  provenance,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly summary: MutableEffectSummary;
  readonly actuals: readonly Node[];
  readonly provenance: string;
},): void {
  actuals.forEach(function inspectActual(actual,): void {
    exposingCallables({
      project,
      actual,
    },)
      .forEach(function recordCapture(packaged,): void {
        transitiveCallableOrigins({
          project,
          bindingOriginBySymbolId,
          packaged,
        },)
          .forEach(function markCaptured(origin,): void {
            addOpaqueEffect({
              summary,
              affectedSlot: origin,
              provenance,
            },);
          },);
      },);
  },);
}

/**
 * Names the callables one actual can hold whose results can carry mutable state.
 *
 * Asks the resolver and the possible-value walk, exactly as the owned edge does, so an alias and a
 * parameter default answer here too.
 *
 * @param project - TypeScript project resolving what the actual holds.
 *
 * @param actual - Argument expression being inspected.
 *
 * @returns callables the actual can hold that expose something writable.
 *
 * @example
 * ```ts
 * exposingCallables({ project, actual });
 * ```
 */
function exposingCallables({
  project,
  actual,
}: {
  readonly project: Project;
  readonly actual: Node;
},): readonly Node[] {
  /**
   * Callable the resolver names for this actual, absent when nothing owned answers.
   */
  const resolved = callableDeclaration({
    project,
    node: actual,
  },);
  return [
    ...(resolved === OWNED_CALLABLE_UNAVAILABLE) ? [] : [resolved,],
    ...packagedActualCallables({
      project,
      actual,
    },),
  ]
    .filter(function exposesState(packaged,): boolean {
      return callableResultCanCarryState({
        project,
        packaged,
      },);
    },);
}

/**
 * Tests whether invoking one callable can hand back something writable.
 *
 * @param project - TypeScript project whose checker types the completions.
 *
 * @param packaged - Callable whose completions are inspected.
 *
 * @returns whether any completion can carry mutable state.
 *
 * @example
 * ```ts
 * callableResultCanCarryState({ project, packaged });
 * ```
 */
function callableResultCanCarryState({
  project,
  packaged,
}: {
  readonly project: Project;
  readonly packaged: Node;
},): boolean {
  /* A signature, a type node or a class expression has no readable body, and a body this walk
   * cannot read is a body whose completions it cannot enumerate. Both answer that the result can
   * carry state, which withholds. */
  if (!isFunctionLikeDeclaration(packaged,))
    return true;
  /**
   * Body of the callable, absent for an overload signature or an ambient declaration.
   */
  const { body, } = packaged;
  if (body === undefined)
    return true;
  if (!isBlock(body,))
    return expressionCanCarryMutableState({
      checker: project.checker,
      node: body,
    },);
  return completionExpressions({ body, },)
    .some(function carriesState(expression,): boolean {
      return expressionCanCarryMutableState({
        checker: project.checker,
        node: expression,
      },);
    },);
}

/**
 * Names every expression one callable body can complete with.
 *
 * Yields count beside returns, because driving an iterator receives what it yields exactly as a
 * caller receives what a call returns, and a generator handed to an uninspectable callee is driven
 * by that callee.
 *
 * A body with no completion expression answers with none, which is the whole precision of this
 * gate: a callable that hands nothing back exposes nothing.
 *
 * @param body - Block body of the callable.
 *
 * @returns expressions the body completes with.
 *
 * @example
 * ```ts
 * completionExpressions({ body });
 * ```
 */
function completionExpressions({ body, }: { readonly body: Node; },): readonly Node[] {
  return collectAstNodes(body,)
    .flatMap(function ownCompletion(node,): readonly Node[] {
      if (!(isReturnStatement(node,) || isYieldExpression(node,)))
        return [];
      if (!returnBelongsToCallable({
        node,
        body,
      },))
        return [];
      /* A bare `return;` and a bare `yield;` hand back `undefined`, which carries nothing. Reading
       * an absent expression as unknown would make every early return look like an exposure. */
      return node.expression === undefined ? [] : [node.expression,];
    },);
}
