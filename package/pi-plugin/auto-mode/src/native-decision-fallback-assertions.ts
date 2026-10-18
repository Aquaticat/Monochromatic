/**
 Strict outcome assertions for the native decision fallback catalog.

 Every named mode keeps its exact branch checks, counts, and messages against
 the captured evidence and live fixture observations. @module
 */
import assert from 'node:assert/strict';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type {
  AgentSession,
  sessionEntryToContextMessages
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { DecisionFallbackEvidenceCapture } from './native-decision-fallback-evidence.ts';
import {
  assertAssessmentRequestState,
  assertClauseAdmissionDetails,
  assertQuestionEvidenceDetails,
  assertReviewCompleteDetails,
  isAssessmentRequestRecord,
  isQuestionEvidenceRecord
} from './native-decision-fallback-evidence-types.ts';
import type {
  AssessmentEvidenceRecord,
  AssessmentRequestRecord,
  DecisionEvidenceRecord
} from './native-decision-fallback-evidence-types.ts';
import { TRANSIENT_ASSESSMENT_ATTEMPTS } from './native-decision-fallback-modes.ts';
import type {
  DecisionFallbackObservations,
  DecisionFallbackPlan
} from './native-decision-fallback-types.ts';

/**
 Message union produced by Pi's session-entry projection.
 */
type FixtureSessionMessage = ReturnType<typeof sessionEntryToContextMessages>[number];

/**
 Tool result variant carrying the retained stop outcome text.
 */
type FixtureToolResultMessage = Extract<FixtureSessionMessage, { readonly role: 'toolResult' }>;

/**
 Stop outcome text every withheld member retains after native abort.
 */
const STOP_OUTCOME_TEXT = 'The user stopped execution. Wait for their next instructions.';

/**
 Expected probability of the admitted clause answer distribution.
 */
const EXPECTED_CLAUSE_PROBABILITY = 0.6;

//region Evidence selectors narrow captured records before their asserted reads.

/**
 Select the clause admission record bound to the maintained source rule.

 @param entry - captured decision evidence record

 @returns whether the record admits the source clause binding
 */
function selectedClauseRecord(entry: DecisionEvidenceRecord): boolean {
  if (entry.event !== 'clause-admission')
    return false;
  const details: unknown = entry.details;
  assertClauseAdmissionDetails(details);
  return details.binding.code === 'RUL';
}

/**
 Select tool result messages retaining their original stop outcome.

 @param message - session message projected by the original SDK

 @returns whether the message is a tool result
 */
function isToolResultMessage(message: ForeignBorrowed<FixtureSessionMessage>): message is FixtureToolResultMessage {
  return message.role === 'toolResult';
}

//endregion

//region Startup failure keeps ordinary chat free of blocking confirmation.

/**
 Assert failed startup classification never blocks ordinary chat.

 @param observations - counters recorded by fixture callbacks
 */
export function assertFailedStartupChat({ observations }: Readonly<{
  observations: DecisionFallbackObservations;
}>): void {
  assert.equal(observations.executions, 0);
  assert.equal(
    observations.selections,
    0,
    'Failed startup classification must not block ordinary chat'
  );
}

//endregion

//region Outcome assertions preserve every named branch exactly.

/**
 Assert the complete catalog outcome for one named mode.

 @param plan - mode plan carrying the exact expected counts

 @param observations - counters recorded by fixture callbacks

 @param capture - captured decision and assessment evidence records

 @param session - original session retaining withheld tool results

 @param commands - proposed commands asserted against retained inputs
 */
export function assertDecisionFallbackOutcome({ plan, observations, capture, session, commands }: Readonly<{
  plan: DecisionFallbackPlan;
  observations: DecisionFallbackObservations;
  capture: DecisionFallbackEvidenceCapture;
  session: AgentSession;
  commands: readonly string[];
}>): void {
  if ((plan.mode === 'stop') || (plan.mode === 'cancel')) {
    const withheld = session.messages.filter(isToolResultMessage);
    assert.equal(withheld.length, commands.length);
    for (const message of withheld)
      assert.equal(
        message.content.map(function readResultText(part: Readonly<{ text?: string }>): string {
          return part.text ?? '';
        })
          .join('\n'),
        STOP_OUTCOME_TEXT,
        'An original Stop outcome must survive native abort'
      );
  }
  assert.equal(observations.executions, plan.allowed ? 2 : 0);
  assert.equal(
    observations.updates,
    plan.allowed ? 2 : 0,
    'Both admitted parallel members must reach original extension progress callbacks'
  );
  assert.equal(observations.attempts, plan.expectedAttempts);
  if (plan.transient)
    assert.equal(observations.httpCalls, TRANSIENT_ASSESSMENT_ATTEMPTS);
  assert.equal(observations.selections, plan.manualReview ? 1 : 0);
  if (!plan.startupFailure) {
    assert.ok(
      capture.decisionRecords.length > 0,
      'The actual tagged logger must receive decision evidence'
    );
    assert.equal(new Set(capture.decisionRecords.map(function correlation(entry: DecisionEvidenceRecord): string {
      return entry.reviewId;
    })).size, 1);
    if (plan.mode !== 'initial-failure') {
      const clause = capture.decisionRecords.find(selectedClauseRecord);
      assert.ok(
        clause,
        'Logs must identify the exact source clause'
      );
      const clauseDetails: unknown = clause.details;
      assertClauseAdmissionDetails(clauseDetails);
      assert.equal(clauseDetails.answer.value.choice, plan.relation);
      assert.equal(clauseDetails.admitted, true);
      assert.equal(typeof clauseDetails.binding.sourceSHA256, 'string');
      assert.equal(clauseDetails.answer.value.probabilities[plan.relation], EXPECTED_CLAUSE_PROBABILITY);
    }
    const inputRecords = capture.assessmentRecords.filter(isAssessmentRequestRecord);
    assert.equal(inputRecords.length, observations.attempts);
    assert.equal(new Set(inputRecords.map(function operationId(entry: AssessmentRequestRecord): string {
      return entry.operationId;
    })).size, 1);
    for (const record of inputRecords) {
      const requestState: unknown = record.state;
      assertAssessmentRequestState(requestState);
      assert.equal(Object.hasOwn(requestState, 'fullPolicy'), false);
      assert.ok(requestState.selectedPolicyMaterial[0]
        .fragments
        .some(function policyRule(span: Readonly<{ text: string }>): boolean {
          return span.text.startsWith('RUL:');
        }));
      assert.equal(Object.hasOwn(requestState, 'originalRequestBody'), false);
      for (const command of commands)
        assert.equal(requestState.parentProgram.includes(command), false);
      assert.ok(requestState.parentProgram.includes('syntax'));
    }
    for (const record of capture.decisionRecords.filter(isQuestionEvidenceRecord)) {
      assertQuestionEvidenceDetails(record.details);
      assert.equal(
        record.details.operationId,
        nonNullishOrThrow(inputRecords[0]).operationId
      );
    }
    if (plan.mode === 'malformed')
      assert.ok(capture.assessmentRecords.some(function malformedReply(entry: AssessmentEvidenceRecord): boolean {
        return (entry.event === 'assessment-response-invalid') && (entry.raw === '{malformed');
      }));
    if (plan.mode === 'deadline')
      assert.equal(observations.selections, 0);
    if (plan.mode === 'initial-failure')
      assert.ok(JSON.stringify(capture.decisionRecords)
        .includes('Fixture initial clause transport failed'));
    if ((plan.mode === 'approve') || (plan.mode === 'deny')) {
      const terminal = nonNullishOrThrow(capture.decisionRecords.find(function finalOutcome(entry: DecisionEvidenceRecord): boolean {
        return entry.event === 'review-complete';
      }));
      const terminalDetails: unknown = terminal.details;
      assertReviewCompleteDetails(terminalDetails);
      assert.equal(terminalDetails.outcome.verdict, plan.mode);
      assert.equal(terminalDetails.confirmation, false);
    }
  }
}

//endregion
