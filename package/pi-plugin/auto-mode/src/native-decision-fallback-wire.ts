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

import {
  assertClauseRelationDefinition,
  assertDecisionWire,
  assertMutableDecisionResponse,
  type DecisionWireQuestion,
} from './native-decision-fallback-wire-data.ts';

//region The fixture wire sender keeps the original failure and rewrite modes.

/**
 Clock offset the deadline mode applies after its authored answer arrives.
 */
const DECISION_DEADLINE_EXTENSION_MS = 16_000;

/**
 Recorded incident scores separate the leading action from its competitor and uncertainty.
 */
const recordedDecisionScores = Object.freeze({
  leading: 0.56,
  competing: 0.38,
  unknown: 0.06,
});

/**
 Existing high-uncertainty contrast requires scoped manual confirmation.
 */
const uncertainDecisionScores = Object.freeze({
  leading: 0.59,
  competing: 0,
  unknown: 0.41,
});

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
    transientHttpFailure: plan.mode
      .startsWith('unavailable')
      ? 'unavailable'
      : plan.transient ? 'request' : 'none'
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
    if (operation && ((plan.mode === 'low')
      || (plan.mode === 'low-unknown-approve')
      || (plan.mode === 'low-unknown-deny'))) {
      /**
       Authored distributions exercise both uncertain abstention and the recorded low-unknown action.
       */
      const response: unknown = JSON.parse(raw);
      assertMutableDecisionResponse(response);
      for (const answer of Object.values(response.answers)) {
        /**
         Named modes preserve the recorded action distribution and its denial counterpart.
         */
        const lowUnknown = plan.mode !== 'low';
        /**
         Selected action remains consistent with the uniquely leading authored score.
         */
        const choice = plan.mode === 'low-unknown-deny' ? 'deny' : 'approve';
        /**
         Named score profiles retain the incident and high-uncertainty contrast independently.
         */
        const scores = lowUnknown ? recordedDecisionScores : uncertainDecisionScores;
        answer.choice = choice;
        answer.probabilities = {
          approve: choice === 'approve' ? scores.leading : scores.competing,
          deny: choice === 'deny' ? scores.leading : scores.competing,
          unknown: scores.unknown
        };
      }
      return JSON.stringify(response);
    }
    return raw;
  }
  return fixtureWireTransport;
}

//endregion
