/**
 Request and decision wire assertions for the native decision fallback catalog.

 The fixture wire sender asserts the authored request shape before forwarding to
 the maintained transport, and mode failures stay exact and named. @module
 */
import assert from 'node:assert/strict';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import {
  type AssessmentFixtureSettings,
  assessmentFixtureHarness
} from './native-decision-fallback-harness.ts';
import { replaceFixturePolicyWithProhibition } from './native-decision-fallback-state.ts';
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
    selectedRule?: Readonly<Record<string, unknown>>;
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
 Recognize an object member before its projected field reads.

 @param value - wire member arriving from parsed JSON

 @returns whether ordinary property reads can inspect the member
 */
function isWireMemberRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 Narrow a parsed wire member before its projected field reads.

 @param value - wire member arriving from parsed JSON

 @returns record view for further field checks

 @throws DecisionFallbackWireShapeError when the member is not an object
 */
function wireMemberRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!isWireMemberRecord(value))
    throw new DecisionFallbackWireShapeError('Decision wire member must be an object before its field reads');
  return value;
}

/**
 Validate the clause relation containers the clause comparison dereferences.

 @param value - decision wire state member

 @returns narrowed state projection for the clause comparison

 @throws DecisionFallbackWireShapeError when a dereferenced container is missing
 */
function assertClauseRelationDefinition(value: unknown): asserts value is DecisionWire['state'] {
  /**
   State carries the clause relation definition the fixture compares.
   */
  const state = wireMemberRecord(value);
  /**
   Relation definition keeps its complete interpretation instructions.
   */
  wireMemberRecord(state.clauseRelationDefinition);
}

//endregion

//region Request assertions validate the authored decision wire in place.

/**
 Validate the decision wire containers the request assertions dereference.

 Leaf fields stay unvalidated because the fixture only compares them, exactly
 like the original assertions, so well-formed and tolerated shapes pass alike.

 @param value - parsed decision wire request

 @returns narrowed wire projection for the request assertions

 @example
 ```ts
 assertDecisionWire(JSON.parse(input.body));
 ```

 @throws DecisionFallbackWireShapeError when a dereferenced container is missing
 */
export function assertDecisionWire(value: unknown): asserts value is DecisionWire {
  /**
   Wire stays an object record before its question member is read.
   */
  const wire = wireMemberRecord(value);
  /**
   Questions arrive keyed by their authored selection slot.
   */
  const questions = wireMemberRecord(wire.questions);
  for (const question of Object.values(questions)) {
    /**
     Each question keeps its local interpretation instructions.
     */
    const questionRecord = wireMemberRecord(question);
    /**
     Instructions carry the optional selected rule and the predicate.
     */
    wireMemberRecord(questionRecord.instructions);
    /**
     Criteria stay keyed by authored choice label.
     */
    wireMemberRecord(questionRecord.criteria);
  }
}

/**
 Validate the mutable authored response containers the rewrite mutates.

 @param value - parsed authored decision response

 @returns narrowed response projection for the low-confidence rewrite

 @example
 ```ts
 assertMutableDecisionResponse(JSON.parse(raw));
 ```

 @throws DecisionFallbackWireShapeError when a mutation target is missing
 */
export function assertMutableDecisionResponse(value: unknown): asserts value is MutableDecisionResponse {
  /**
   Response stays an object record before its answer member is read.
   */
  const response = wireMemberRecord(value);
  /**
   Answers arrive keyed by question slot and stay mutable rewrite targets.
   */
  const answers = wireMemberRecord(response.answers);
  for (const answer of Object.values(answers))
    wireMemberRecord(answer);
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

 @example
 ```ts
 const sendWire = createDecisionFallbackWireSender({
   plan,
   state,
   session,
   environment,
   observations
 });
 ```
 */
export function createDecisionFallbackWireSender({
  plan,
  state,
  session,
  environment,
  observations
}: Readonly<{
  plan: DecisionFallbackPlan;
  state: DecisionFallbackState;
  session: AgentSession;
  environment: HarnessEnvironment;
  observations: DecisionFallbackObservations;
}>): AssessmentTransport {
  /**
   Workspace cwd drives the stale-mode policy replacement.
   */
  const { cwd } = environment.options;
  /**
   Assessment settings reproduce the original authored relation answers.
   */
  const settings: AssessmentFixtureSettings = {
    relation: 'permission',
    unresolvedClause: plan.relation,
    operationDecision: plan.operationDecision,
    operatingPolicy: true,
    httpTransport: true,
    transientHttpFailure: plan.transient
  };
  /**
   Maintained assessment path author answers over the real HTTP transport.
   */
  const sendAssessment = assessmentFixtureHarness.createDomainFixtureAssessment({
    settings,
    observations
  });
  /**
   Fixture wire transport asserts each authored decision request in place.

   @param input - authored decision request from the policy runtime

   @returns raw authored answer text for the policy runtime

   @throws Error when this mode's fixture transport failure triggers
   */
  async function fixtureWireTransport(input: AssessmentSendInput): Promise<string> {
    observations.attempts++;
    for (const argument of [
      'FALLBACK_A',
      'FALLBACK_B'
    ])
      assert.ok(input.body
        .includes(argument));
    /**
     Parsed wire carries the authored questions and clause relation state.
     */
    const wire: unknown = JSON.parse(input.body);
    assertDecisionWire(wire);
    for (const question of Object.values(wire.questions)) {
      /**
       Clause questions carry their selected rule; operation questions do not.
       */
      const { instructions } = question;
      /**
       Selected rule absence skips the clause-only request assertions.
       */
      const { selectedRule } = instructions;
      if (!selectedRule)
        continue;
      assert.ok(
        Object.values(question.criteria)
          .every(function localRubric(criterion: unknown): boolean {
            return ((typeof criterion) === 'string') && (criterion.length > 0);
          }),
        'Every clause choice needs its local interpretation rubric'
      );
      /**
       Clause relation state is dereferenced only by the clause comparison.
       */
      assertClauseRelationDefinition(wire.state);
      assert.equal(
        question.instructions
          .predicate,
        wire.state
          .clauseRelationDefinition
          .instructions,
        'Each clause needs complete local interpretation instructions'
      );
    }
    /**
     Operation detection marks the whole-operation decision question.
     */
    const operation = Object.values(wire.questions)
      .some(function operationQuestion(question: DecisionWireQuestion): boolean {
        return Object.hasOwn(
          question.criteria,
          'approve'
        );
      });
    assert.equal(
      operation,
      observations.attempts >= 2
    );
    if ((plan.mode === 'initial-failure') && (!operation))
      throw new Error('Fixture initial clause transport failed');
    if (operation && (plan.mode === 'transport'))
      throw new Error('Fixture final decision transport failed');
    if (operation && (plan.mode === 'malformed'))
      return '{malformed';
    if (operation && (plan.mode === 'stale'))
      await replaceFixturePolicyWithProhibition({ cwd });
    if (operation && (plan.mode === 'abort'))
      state.abortTask = session.abort();
    /**
     Authored raw answer text keeps the original request bytes.
     */
    const raw = await sendAssessment(input);
    if (operation && (plan.mode === 'deadline'))
      state.clockOffset = DECISION_DEADLINE_EXTENSION_MS;
    if (operation && (plan.mode === 'low')) {
      /**
       Authored response is rewritten in place to the low-confidence approval.
       */
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
  }
  return fixtureWireTransport;
}

//endregion
