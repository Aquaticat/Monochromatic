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
  isTaggedTemplateExpression,
  isThrowStatement,
  isTemplateExpression,
  isYieldExpression,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  addOpaqueEffect,
  parameterIndexes,
} from './effect-call-resolution.ts';
import { effectOriginLocation, } from './effect-origin-location.ts';
import { handoffProvenance, } from './effect-retention-provenance.ts';
import { classifyReadonlyType, } from './readonly-classifier.ts';
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
      /* An argument nothing can be written through grants the construction nothing, however the
       * constructor keeps it. `expressionCanCarryMutableState` answers yes for a
       * `readonly string[]`, because an array is an object, and that cost the one offer this
       * channel moved across the workspace: `new Set(supportedKeys,)` withheld a parameter whose
       * only handed value was a deeply readonly array of strings.
       *
       * The classifier answers the question exactly. `honest-readonly` means every reachable
       * position is readonly, so no write can travel through the value, which is a stronger and
       * more precise statement than the leaf test makes. Asked only here, because widening the
       * leaf test itself would move every path at once. */
      /**
       * Type of the handed value, absent when the checker cannot answer for it.
       */
      const handedType = project.checker
        .getTypeAtLocation(argument,);
      /* Absent type falls through to recording, not to skipping. Reversing that would make an
       * argument the checker cannot answer for the safest kind to hand a constructor, which is
       * the wrong direction for a channel whose whole purpose is to withhold on what it cannot
       * prove. */
      /**
       * What the handed type promises about writes reaching through it, absent when unknown.
       */
      const handedClassification = handedType === undefined
        ? undefined
        : classifyReadonlyType({
          checker: project.checker,
          project,
          type: handedType,
        },);
      if (handedClassification?.kind === 'honest-readonly')
        return;
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

/**
 * Records opacity for caller state interpolated into a tagged template.
 *
 * A tag is a call, and the analysis never saw it as one: a `TaggedTemplateExpression` is not a
 * `CallExpression`, so the call branch skipped it entirely and every interpolated value reached
 * the tag unrecorded. Falsified, with a tag pushing its first interpolated row into a collection
 * and the caller's row changing afterwards.
 *
 * Recorded as a handoff rather than routed through the call machinery. A tag receives a strings
 * array and the interpolated values as arguments, so the honest minimum is that whatever the
 * values carry reached something this analysis did not inspect, and that is what a handoff says.
 * Routing it as a proper call edge would be more precise and needs the formal mapping a tag's
 * signature implies, which is a larger change than the falsification requires.
 *
 * @param project - TypeScript project resolving interpolated origins.
 *
 * @param bindingOriginBySymbolId - Parameter and alias origins of the callable being summarised.
 *
 * @param summary - Summary receiving opacity.
 *
 * @param node - Candidate tagged template from the body scan.
 *
 * @mutates summary - Adds an opaque slot and handoff provenance per interpolated origin.
 *
 * @example
 * ```ts
 * recordTaggedTemplateHandoff({ project, bindingOriginBySymbolId, summary, node });
 * ```
 */
export function recordTaggedTemplateHandoff({
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
  if (!isTaggedTemplateExpression(node,))
    return;
  if (!isTemplateExpression(node.template,))
    return;
  /**
   * Handoff provenance naming the tag that received the values.
   */
  const provenance = handoffProvenance({
    handoff: `a tagged template call to ${node.tag
      .getText()}`,
    location: effectOriginLocation({ node, },),
  },);
  node.template
    .templateSpans
    .forEach(function recordSpan(span,): void {
      parameterIndexes({
        project,
        bindingOriginBySymbolId,
        node: span.expression,
      },)
        .forEach(function recordInterpolatedSlot(affectedSlot,): void {
          addOpaqueEffect({
            summary,
            affectedSlot,
            provenance,
          },);
        },);
    },);
}

/**
 * Records opacity for caller state thrown out of the callable.
 *
 * A throw hands the value to whoever catches it, and that handler outlives the throw by
 * construction, so it is a handoff in exactly the sense a yield is. Nothing modelled a throw
 * anywhere in this analysis, which task #64 recorded as the reason no body summary here can be
 * complete enough to grant an offer.
 *
 * Falsified: `throw config.row` left the parameter offered while a handler caught the row and
 * changed it.
 *
 * A return of caller state is permitted by the accepted decision on the condition that callers
 * track it through recorded returned origins. A throw has no such record and no channel to put one
 * in, so the condition cannot hold, which is the same reasoning that made a returned callable a
 * false offer.
 *
 * @param project - TypeScript project resolving thrown origins.
 *
 * @param bindingOriginBySymbolId - Parameter and alias origins of the callable being summarised.
 *
 * @param summary - Summary receiving opacity.
 *
 * @param node - Candidate throw statement from the body scan.
 *
 * @mutates summary - Adds an opaque slot and handoff provenance per thrown origin.
 *
 * @example
 * ```ts
 * recordThrowHandoff({ project, bindingOriginBySymbolId, summary, node });
 * ```
 */
export function recordThrowHandoff({
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
  if (!isThrowStatement(node,))
    return;
  /**
   * Handoff provenance naming the throw that handed the value out.
   */
  const provenance = handoffProvenance({
    handoff: 'a throw to whoever catches it',
    location: effectOriginLocation({ node, },),
  },);
  parameterIndexes({
    project,
    bindingOriginBySymbolId,
    node: node.expression,
  },)
    .forEach(function recordThrownSlot(affectedSlot,): void {
      addOpaqueEffect({
        summary,
        affectedSlot,
        provenance,
      },);
    },);
}

/**
 * Asks every handoff site about one body node.
 *
 * Collected here rather than spelled out at the call site, because the body scan has a line budget
 * and each of these is the same question asked of a different syntax: what left the callable
 * without going through a call edge, a store or a return.
 *
 * @param project - TypeScript project resolving origins.
 *
 * @param bindingOriginBySymbolId - Parameter and alias origins of the callable being summarised.
 *
 * @param summary - Summary receiving opacity.
 *
 * @param node - Candidate node from the body scan.
 *
 * @mutates summary - Adds an opaque slot and handoff provenance per handed origin.
 *
 * @example
 * ```ts
 * recordOutwardHandoffs({ project, bindingOriginBySymbolId, summary, node });
 * ```
 */
export function recordOutwardHandoffs({
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
  recordConstructionHandoff({
    project,
    bindingOriginBySymbolId,
    summary,
    node,
  },);
  recordYieldHandoff({
    project,
    bindingOriginBySymbolId,
    summary,
    node,
  },);
  recordTaggedTemplateHandoff({
    project,
    bindingOriginBySymbolId,
    summary,
    node,
  },);
  recordThrowHandoff({
    project,
    bindingOriginBySymbolId,
    summary,
    node,
  },);
}
