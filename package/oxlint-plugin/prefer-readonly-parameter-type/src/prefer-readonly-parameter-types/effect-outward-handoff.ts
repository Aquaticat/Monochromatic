/**
 * Two syntax sites that hand caller state outward and were answered by nothing.
 *
 * Found by walking escape channels rather than by working a queue, and both falsified: the
 * annotation applied, type-checked clean beside a control whose direct write was rejected, and
 * the driver observed the caller's row change.
 *
 * ```ts
 * bag.produce = new RowKeeper(constructed.row,).read;
 *
 * function* rows(): Generator<Row> {
 *   yield yielded.row;
 * }
 * ```
 *
 * A construction and a yield are both handoffs, and neither is a call edge, a store, or a
 * return, which is why nothing recorded them. `NewExpression` appeared nowhere in this analysis
 * at all, and `YieldExpression` only where a result's escape is classified, never where a
 * return's origins are recorded.
 *
 * Both take opacity through the handoff vocabulary, so both withhold silently. There is no call
 * for a reader to inspect in either case, exactly as with a store.
 *
 * @module
 */

import type { Node, } from 'typescript/unstable/ast';
import {
  isNewExpression,
  isYieldExpression,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  addOpaqueEffect,
  parameterIndexes,
} from './effect-call-resolution.ts';
import { effectOriginLocation, } from './effect-origin-location.ts';
import { handoffProvenance, } from './effect-retention-provenance.ts';
import type {
  MutableEffectSummary,
  SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Records opacity for caller state handed to a constructor.
 *
 * Every construction counts, without asking what the constructor does with what it received.
 * Keeping a constructor argument is what constructors are for, the leaf test already excludes a
 * primitive so `new Error(config.row.label,)` records nothing, and a constructor proven not to
 * retain can discharge this later if precision ever demands it.
 *
 * @param project - TypeScript project resolving argument origins.
 *
 * @param bindingOriginBySymbolId - Parameter and alias origins of the callable being summarised.
 *
 * @param summary - Summary receiving opacity.
 *
 * @param node - Candidate construction from the body scan.
 *
 * @mutates summary - Adds an opaque slot and handoff provenance per handed origin.
 *
 * @example
 * ```ts
 * recordConstructionHandoff({ project, bindingOriginBySymbolId, summary, node });
 * ```
 */
export function recordConstructionHandoff({
  project,
  bindingOriginBySymbolId,
  summary,
  node,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly summary: MutableEffectSummary;
  readonly node: Node;
},): void {
  if (!isNewExpression(node,))
    return;
  if (node.arguments === undefined)
    return;
  /**
   * What the construction was written as, so the fact points at it.
   */
  const targetText = node.expression
    .getText();
  /**
   * Handoff provenance naming the construction that received the value.
   */
  const provenance = handoffProvenance({
    handoff: `a construction of ${targetText}`,
    location: effectOriginLocation({ node, },),
  },);
  node.arguments
    .forEach(function recordArgument(argument,): void {
      parameterIndexes({
        project,
        bindingOriginBySymbolId,
        node: argument,
      },)
        .forEach(function recordHandedSlot(affectedSlot,): void {
          addOpaqueEffect({
            summary,
            affectedSlot,
            provenance,
          },);
        },);
    },);
}

/**
 * Records opacity for caller state handed out of a generator.
 *
 * A yield gives the value to whoever drives the iterator, and that driver outlives the yield by
 * construction. Unlike a return, nothing about the yielded value reaches the enclosing
 * callable's returned set, so the tracking that makes a return benign is not available here.
 *
 * @param project - TypeScript project resolving yielded origins.
 *
 * @param bindingOriginBySymbolId - Parameter and alias origins of the callable being summarised.
 *
 * @param summary - Summary receiving opacity.
 *
 * @param node - Candidate yield from the body scan.
 *
 * @mutates summary - Adds an opaque slot and handoff provenance per yielded origin.
 *
 * @example
 * ```ts
 * recordYieldHandoff({ project, bindingOriginBySymbolId, summary, node });
 * ```
 */
export function recordYieldHandoff({
  project,
  bindingOriginBySymbolId,
  summary,
  node,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly summary: MutableEffectSummary;
  readonly node: Node;
},): void {
  if (!isYieldExpression(node,))
    return;
  if (node.expression === undefined)
    return;
  /**
   * Handoff provenance naming the yield that handed the value out.
   */
  const provenance = handoffProvenance({
    handoff: 'a yield to whoever drives this iterator',
    location: effectOriginLocation({ node, },),
  },);
  parameterIndexes({
    project,
    bindingOriginBySymbolId,
    node: node.expression,
  },)
    .forEach(function recordYieldedSlot(affectedSlot,): void {
      addOpaqueEffect({
        summary,
        affectedSlot,
        provenance,
      },);
    },);
}
