/**
 * Assignments that hand parameter-reachable state to a binding the callable does not own.
 *
 * Split from `direct-effect-summary.ts` rather than added to its body scan, because the
 * question is not the one `inspectDirectWrite` answers. That asks which parameter a write
 * lands on, and returns early for an identifier target on purpose: `held = row` changes
 * no object the caller can see. This asks the opposite question about the same syntax,
 * which is what the assignment hands outward, and an identifier target is exactly where
 * that matters.
 *
 * @module
 */

import {
  type Node,
  SyntaxKind,
} from 'typescript/unstable/ast';
import {
  isBinaryExpression,
  isForOfStatement,
  isVariableDeclarationList,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  addOpaqueEffect,
  parameterIndexes,
} from './effect-call-resolution.ts';
import { effectOriginLocation, } from './effect-origin-location.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import { retentionProvenance, } from './effect-retention-provenance.ts';
import type {
  MutableEffectSummary,
  SlotOrigins,
} from './effect-summary-model.ts';
import { targetIsCallableLocal, } from './effect-value-consumer.ts';

/**
 * Assignment operators that store the right operand's own reference.
 *
 * The logical forms belong here and the arithmetic forms do not. `held ||= config.row`
 * stores the row itself whenever the target is absent, so the caller's object outlives
 * the call exactly as plain assignment leaves it. `total += config.rows.length` coerces
 * its operand to a primitive and retains nothing, so treating the compound operators as
 * one class would report a callable that kept only a number.
 */
const RETAINING_ASSIGNMENT_OPERATORS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.EqualsToken,
  SyntaxKind.BarBarEqualsToken,
  SyntaxKind.AmpersandAmpersandEqualsToken,
  SyntaxKind.QuestionQuestionEqualsToken,
],);

/**
 * Records opacity for every parameter an escaping assignment can hand outward.
 *
 * Opacity rather than a dimension of its own. An escaped reference is precisely a value
 * this analysis cannot prove stays unwritten, which is what an opaque slot already
 * asserts, and it already propagates through owned calls and withholds the offer. A
 * separate escape bit would answer the same question until something exists to read it
 * more finely.
 *
 * `parameterIndexes` decides what the assignment hands over, and choosing it over
 * `expressionOrigins` is the whole precision of this. The origin resolver descends an
 * object literal and answers with the parameter reached through a property read that
 * filled it, so `held = { label: config.row.label, }` would attribute a store of a string
 * to `config`. `parameterIndexes` gates every leaf on whether that leaf can carry mutable
 * state, so the same literal contributes nothing.
 *
 * @param project - TypeScript project resolving origins and targets.
 *
 * @param bindingOriginBySymbolId - Local binding origins by symbol identity.
 *
 * @param summary - Summary receiving opacity.
 *
 * @param node - Candidate assignment from the body scan.
 *
 * @param body - Body of callable being summarised.
 *
 * @mutates summary - Adds an opaque slot and store provenance per escaping origin.
 *
 * @example
 * ```ts
 * recordAssignmentStore({ project, bindingOriginBySymbolId, summary, node, body, });
 * ```
 */
export function recordAssignmentStore({
  project,
  bindingOriginBySymbolId,
  summary,
  node,
  body,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly summary: MutableEffectSummary;
  readonly node: Node;
  readonly body: Node;
},): void {
  if (!isBinaryExpression(node,))
    return;
  if (!RETAINING_ASSIGNMENT_OPERATORS.has(node.operatorToken
    .kind,))
    return;
  /* The target policy follows `assignmentStoreEscapes` rather than restating it, so a
   * property, an element and a destructuring pattern all count. Narrowing this to a plain
   * identifier would miss `sink.value = config.row` entirely, and a target the callable
   * does own is exactly what `targetIsCallableLocal` answers about. */
  if (targetIsCallableLocal({
    project,
    target: node.left,
    body,
  },))
    return;
  /**
   * Authored target text, naming what the value was handed to.
   */
  const targetText = node.left
    .getText();
  /**
   * Where the store sits, so the report can point at it.
   */
  const location = effectOriginLocation({ node, },);
  parameterIndexes({
    project,
    bindingOriginBySymbolId,
    node: node.right,
  },)
    .forEach(function recordEscapingSlot(affectedSlot,): void {
      addOpaqueEffect({
        summary,
        affectedSlot,
        provenance: retentionProvenance({
          target: targetText,
          location,
        },),
      },);
    },);
}

/**
 * Records opacity for a parameter an iteration statement hands to a binding it does not own.
 *
 * `for (held of config.rows)` retains a caller-owned row past the call exactly as
 * `held = config.rows[0]` does, and no assignment expression appears anywhere in it, so the
 * classification that reads assignments cannot see it. Measured before this existed:
 * `opaque=[]` and the parameter offered, beside `held = config.rows.at(0,)` recording
 * `opaque=[0]` for the same retention.
 *
 * A declaration initializer is not a store. `for (const row of config.rows)` binds a fresh
 * local per iteration, which dies with the iteration, and reporting it would take every
 * ordinary read loop with it.
 *
 * @param project - TypeScript project resolving origins and targets.
 *
 * @param bindingOriginBySymbolId - Local binding origins by symbol identity.
 *
 * @param summary - Summary receiving opacity.
 *
 * @param node - Candidate iteration statement from the body scan.
 *
 * @param body - Body of callable being summarised.
 *
 * @mutates summary - Adds an opaque slot and store provenance per retained origin.
 *
 * @example
 * ```ts
 * recordIterationStore({ project, bindingOriginBySymbolId, summary, node, body, });
 * ```
 */
export function recordIterationStore({
  project,
  bindingOriginBySymbolId,
  summary,
  node,
  body,
}: {
  readonly project: Project;
  readonly bindingOriginBySymbolId: ReadonlyMap<number, SlotOrigins>;
  readonly summary: MutableEffectSummary;
  readonly node: Node;
  readonly body: Node;
},): void {
  if (!isForOfStatement(node,))
    return;
  /**
   * What each element is assigned to, either a fresh declaration or an existing binding.
   */
  const { initializer, } = node;
  if (isVariableDeclarationList(initializer,))
    return;
  if (targetIsCallableLocal({
    project,
    target: initializer,
    body,
  },))
    return;
  /* The element decides, not the iterable. `parameterIndexes` gates the leaves of the
   * iterable expression, and an array of strings is itself an object, so asking only that
   * question would report a loop that retains nothing but a `string`. The target's type is
   * the element type here, which is what the binding actually holds after the loop. */
  if (!expressionCanCarryMutableState({
    checker: project.checker,
    node: initializer,
  },))
    return;
  /**
   * Authored target text, naming what each element was handed to.
   */
  const targetText = initializer.getText();
  /**
   * Where the iteration sits, so the report can point at it.
   */
  const location = effectOriginLocation({ node, },);
  parameterIndexes({
    project,
    bindingOriginBySymbolId,
    node: node.expression,
  },)
    .forEach(function recordEscapingSlot(affectedSlot,): void {
      addOpaqueEffect({
        summary,
        affectedSlot,
        provenance: retentionProvenance({
          target: targetText,
          location,
        },),
      },);
    },);
}
