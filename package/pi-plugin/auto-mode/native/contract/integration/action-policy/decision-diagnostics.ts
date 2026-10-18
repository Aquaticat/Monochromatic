/** Correlated local records explain estimates, routing, and final operation outcomes. @module */
import { randomUUID } from 'node:crypto';
import { inspect } from 'node:util';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { operationDiagnosticId } from './assessment-diagnostics.mjs';
import type { QuestionEvidence } from '../../lifecycle/claim-evidence-batch-selection/selection-owner-types.ts';

/** Weak ownership preserves correlation without retaining completed judgments. */
const reviewIds = new WeakMap<object, string>();
/** Each event remains one JSON object inside the existing tagged log message. */
const l = tagged({ tag: 'auto-mode-decision-evidence' });

//region Original judgment identity correlates all decision paths without granting authority.

/**
 Publish reconstructable evidence through the existing local logger.

 @param judgment - original operation owner used only for correlation
 @param event - lifecycle or decision boundary
 @param details - original evidence and explicit routing reasons
 */
export function recordDecision({ judgment, event, details }: {
  readonly judgment: object;
  readonly event: string;
  readonly details: unknown;
}): void {
  /** Repeated records for the same owner retain the original correlation identifier. */
  const reviewId = reviewIds.get(judgment) ?? randomUUID();
  reviewIds.set(judgment, reviewId);
  /** JSON supplies positional fields to its callback; nested Error properties need explicit inspection. */
  const serialized = JSON.stringify({ reviewId, event, details }, function describeDiagnosticValue(key: string, value: unknown): unknown {
    if (value instanceof Error) return { field: key, error: inspect(value, { depth: 8 }) };
    return value;
  });
  tagged({ tag: recordDecision.name, l }).debug(serialized);
}

/**
 Retain every answer's source span, complete distribution, model attribution, and original operation context.

 @param judgment - original operation owner
 @param evidence - authenticated records from its selected batch
 */
export function recordDecisionEvidence({ judgment, evidence }: {
  readonly judgment: object;
  readonly evidence: readonly QuestionEvidence[];
}): void {
  for (const [index, record] of evidence.entries()) {
    recordDecision({ judgment, event: 'question-evidence', details: {
      index, definitionId: record.definitionId, binding: record.binding,
      answer: record.answer, model: record.model, operationId: operationDiagnosticId(record.envelope),
    } });
  }
}

//endregion Correlated local evidence
