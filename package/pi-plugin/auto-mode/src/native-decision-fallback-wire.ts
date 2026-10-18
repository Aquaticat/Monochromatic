/**
 Request and decision wire assertions for the native decision fallback catalog.

 The fixture wire sender asserts the authored request shape before forwarding to
 the maintained transport, and mode failures stay exact and named. @module
 */
import assert from 'node:assert/strict';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import {
  assessmentFixtureHarness
} from './native-decision-fallback-harness.ts';
import { replaceFixturePolicyWithProhibition } from './native-decision-fallback-state.ts';
import type { AssessmentFixtureSettings } from './native-decision-fallback-harness.ts';
import type {
  AssessmentSendInput,
  AssessmentTransport,
  DecisionFallbackObservations,
  DecisionFallbackPlan,
  DecisionFallbackState,
  HarnessEnvironment
} from './native-decision-fallback-types.ts';

//region Wire projections describe exactly the fields the fixture asserts.

/**
 Decision wire question projection consumed by the request assertions.
 */
export type DecisionWireQuestion = Readonly<{
  instructions: Readonly<{
    selectedRule?: Readonly<Record<string, unknown>> | null;
    predicate: string;
  }>;
  criteria: Readonly<Record<string, unknown>>;
}>;

/**
 Decision wire projection carrying its questions and clause relation definition.
 */
export type DecisionWire = Readonly<{
  model: string;
  questions: Readonly<Record<string, DecisionWireQuestion>>;
  state: Readonly<{
    clauseRelationDefinition: Readonly<{ instructions: string }>;
  }>;
}>;

/**
 Mutable authored answer the low-confidence mode rewrites in place.
 */
export type MutableDecisionAnswer = {
  choice: string;
  probabilities: Record<string, number>;
};

/**
 Mutable authored response whose answers the low-confidence mode rewrites.
 */
export type MutableDecisionResponse = {
  answers: Record<string, MutableDecisionAnswer>;
};

//endregion

//region Wire shape errors name the member that failed its projection.

/**
 Wire shape failures name the request member whose projection did not hold.
 */
export class DecisionFallbackWireShapeError extends Error {
  /**
   Diagnostic identity stays distinct from evidence and transport failures.
   */
  override readonly name = 'DecisionFallbackWireShapeError';
}

/**
 Narrow a parsed wire member before its projected field reads.

 @param value - wire member arriving from parsed JSON

 @returns record view for further field checks

 @throws DecisionFallbackWireShapeError when the member is not an object
 */
function wireMemberRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (((typeof value) !== 'object') || (value === null))
    throw new DecisionFallbackWireShapeError('Decision wire member must be an object before its field reads');
  return value;
}

//endregion

//region Request assertions validate the authored decision wire in place.

/**
 Validate the decision wire before the request assertions read its questions.

 @param value - parsed decision wire request

 @throws DecisionFallbackWireShapeError when asserted wire fields are missing
 */
export function assertDecisionWire(value: unknown): asserts value is DecisionWire {
  const wire = wireMemberRecord(value);
  if ((typeof wire.model) !== 'string')
    throw new DecisionFallbackWireShapeError('Decision wire must name its model');
  const questions = wireMemberRecord(wire.questions);
  for (const question of Object.values(questions)) {
    const questionRecord = wireMemberRecord(question);
    const instructions = wireMemberRecord(questionRecord.instructions);
    const selectedRule = instructions.selectedRule;
    if ((selectedRule !== undefined) && (selectedRule !== null))
      wireMemberRecord(selectedRule);
    if ((typeof instructions.predicate) !== 'string')
      throw new DecisionFallbackWireShapeError('Question instructions must carry their local predicate');
    wireMemberRecord(questionRecord.criteria);
  }
  const state = wireMemberRecord(wire.state);
  const relationDefinition = wireMemberRecord(state.clauseRelationDefinition);
  if ((typeof relationDefinition.instructions) !== 'string')
    throw new DecisionFallbackWireShapeError('Clause relation definition must keep its interpretation instructions');
}

/**
 Validate the mutable authored response before its answers are rewritten.

 @param value - parsed authored decision response

 @throws DecisionFallbackWireShapeError when asserted answer fields are missing
 */
export function assertMutableDecisionResponse(value: unknown): asserts value is MutableDecisionResponse {
  const response = wireMemberRecord(value);
  const answers = wireMemberRecord(response.answers);
  for (const answer of Object.values(answers)) {
    const answerRecord = wireMemberRecord(answer);
    if ((typeof answerRecord.choice) !== 'string')
      throw new DecisionFallbackWireShapeError('Authored answer must carry its selected choice');
    const probabilities = wireMemberRecord(answerRecord.probabilities);
    for (const probability of Object.values(probabilities))
      if ((typeof probability) !== 'number')
        throw new DecisionFallbackWireShapeError('Authored answer probabilities must remain numeric');
  }
}

//endregion

//region The fixture wire sender keeps the original failure and rewrite modes.

/**
 Clock offset the deadline mode applies after its authored answer arrives.
 */
const DECISION_DEADLINE_EXTENSION_MS = 16_000;

/**
 Build the fixture wire transport asserting each authored decision request.

 @param plan - mode plan selecting failure, stale, abort, and rewrite behavior

 @param state - live fixture state owning abort and clock control

 @param session - original session aborted by the abort mode

 @param environment - built environment owning the fixture workspace

 @param observations - counters incremented per send round

 @returns fixture wire transport for the policy runtime
 */
export function createDecisionFallbackWireSender({ plan, state, session, environment, observations }: Readonly<{
  plan: DecisionFallbackPlan;
  state: DecisionFallbackState;
  session: AgentSession;
  environment: HarnessEnvironment;
  observations: DecisionFallbackObservations;
}>): AssessmentTransport {
  const settings: AssessmentFixtureSettings = {
    relation: 'permission',
    unresolvedClause: plan.relation,
    operationDecision: plan.operationDecision,
    operatingPolicy: true,
    httpTransport: true,
    transientHttpFailure: plan.transient
  };
  const sendAssessment = assessmentFixtureHarness.createDomainFixtureAssessment({
    settings,
    observations
  });
  return async function fixtureWireTransport(input: AssessmentSendInput): Promise<string> {
    observations.attempts++;
    for (const argument of ['FALLBACK_A', 'FALLBACK_B'])
      assert.ok(input.body.includes(argument));
    const wire: unknown = JSON.parse(input.body);
    assertDecisionWire(wire);
    for (const question of Object.values(wire.questions)) {
      if (!question.instructions.selectedRule)
        continue;
      assert.ok(Object.values(question.criteria)
        .every(function localRubric(criterion: unknown): boolean {
          return ((typeof criterion) === 'string') && (criterion.length > 0);
        }), 'Every clause choice needs its local interpretation rubric');
      assert.equal(
        question.instructions.predicate,
        wire.state.clauseRelationDefinition.instructions,
        'Each clause needs complete local interpretation instructions'
      );
    }
    const operation = Object.values(wire.questions)
      .some(function operationQuestion(question: DecisionWireQuestion): boolean {
        return Object.hasOwn(question.criteria, 'approve');
      });
    assert.equal(operation, observations.attempts >= 2);
    if ((plan.mode === 'initial-failure') && (!operation))
      throw new Error('Fixture initial clause transport failed');
    if (operation && (plan.mode === 'transport'))
      throw new Error('Fixture final decision transport failed');
    if (operation && (plan.mode === 'malformed'))
      return '{malformed';
    if (operation && (plan.mode === 'stale'))
      await replaceFixturePolicyWithProhibition({ cwd: environment.options.cwd });
    if (operation && (plan.mode === 'abort'))
      state.abortTask = session.abort();
    const raw = await sendAssessment(input);
    if (operation && (plan.mode === 'deadline'))
      state.clockOffset = DECISION_DEADLINE_EXTENSION_MS;
    if (operation && (plan.mode === 'low')) {
      const response: unknown = JSON.parse(raw);
      assertMutableDecisionResponse(response);
      for (const answer of Object.values(response.answers)) {
        answer.choice = 'approve';
        answer.probabilities = {
          approve: 0.59,
          deny: 0,
          unknown: 0.41
        };
      }
      return JSON.stringify(response);
    }
    return raw;
  };
}

//endregion
