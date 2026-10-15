/** Built constructor publication connects every independent owner to its original public operation. @module */
import assert from 'node:assert/strict';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createAPIFixture } from './native-api-fixture.ts';
import { publicKeys, selectionKeys } from './native-api-keys-fixture.ts';
import type { FixturePublicAPI } from './native-api-module-fixture.ts';

/** Owner membership is recorded independently from the constructor's publication mapping. */
const ownerKeys = {
  programs: ['bindPreparedProgram', 'preparedProgramFor', 'openProgram', 'programFor', 'reachProgramGroup',
    'reachedGroupFor', 'bindProgramCalls', 'prepareReachedMembers', 'invokeProgramNative', 'scriptValueFor',
    'markProgramGuard', 'inspectReachedGroup', 'inspectProgram'],
  executions: ['assertExecutionEntry', 'executionEntryFor', 'memberFor', 'beginExecution', 'executionFor',
    'finishExecution', 'inspectExecution'],
  lifecycle: ['captureClaimEvidence', 'assertClaimEvidence', 'captureBatchEvidence', 'assertBatchEvidence',
    'issue', 'assess', 'finalize', 'operation'],
  instructions: ['claim', 'claimInstruction', 'indexedUnitAdoptionPairs', 'claimUnitAdoption', 'requestMaterialFor',
    'claimRequestMaterial', 'claimHeadingContext', 'issueBoundPolicyBatch', 'indexedRuleCandidates',
    'indexedInstructionCandidates', 'indexedHeadingContextCandidates', 'inspectRuleSources', 'readPolicySelection',
    'issueRuleAssessmentBatch', 'readRuleCandidate', 'claimRuleCandidate', 'claimProgramRuleCandidate', 'issueProgramRuleBatch'],
  inspection: ['originalFileFor', 'preparedMemberFor', 'inspect'],
  sourceOwner: ['readSourceSnapshot'],
} as const;

/** Publication consumes completed owners without needing any original native state. */
type PublicationModule = Readonly<{
  publishJudgment: (input: Readonly<Record<string, unknown>>) => FixturePublicAPI;
}>;

/**
 Require the copied publication boundary before testing its original owner wiring.

 @param value - built publication namespace

 @returns assertion exposing independent publication contract

 @throws Error when original publication entry is missing
 */
function assertPublicationModule(value: unknown): asserts value is PublicationModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('publishJudgment' in value))
    || ((typeof value.publishJudgment) !== 'function')) throw new Error('Built original judgment publication is unavailable');
}

/** Consumer imports the same copied module as original constructor composition. */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/judgment-publication.ts',
  import.meta.url,
).href);
assertPublicationModule(loaded);
/** Explicit consumer contract remains stable inside concurrent test callbacks. */
const publicationModule: PublicationModule = loaded;

//region Independently grouped owners expose missing, swapped, eager, or duplicated public wiring.
await describe({ name: '', children: publicKeys.map(function publicationCase(name) {
  return it({ name: `publishes original ${name} owner`, fn: async function publishedOwner() {
    /** Every method has a distinct original result and observable invocation identity. */
    const fixture = createAPIFixture();
    /** Bootstrap capabilities remain independent of grouped owner objects. */
    const input: Record<string, unknown> = {
      prepare: fixture.input.prepare,
      knownSelection: fixture.input.knownSelection,
      active: fixture.input.active,
      assertDependenciesCurrent: fixture.input.assertDependenciesCurrent,
      readCurrentSourceBinding: fixture.input.readCurrentSourceBinding,
    };
    for (const [owner, keys] of Object.entries(ownerKeys)) {
      /** Each owner contains only its independently recorded methods. */
      const group: Record<string, unknown> = {};
      for (const key of keys) group[key] = fixture.input[key];
      input[owner] = group;
    }
    /** Publication must stay inert until the caller invokes an original method. */
    const api = publicationModule.publishJudgment(input);
    assert.deepEqual(fixture.events, []);
    assert.equal(Object.isFrozen(api), true);
    assert.deepEqual(Reflect.ownKeys(api), publicKeys);
    /** Exact public method result proves the original owner was selected. */
    const result = fixture.method({ name, api })({ input: name });
    /** Public checkpoint names the original active callback. */
    const originalName = name === 'checkpoint' ? 'active' : name;
    assert.equal(result, fixture.results.get(originalName));
    assert.equal(fixture.calls.length, 1);
    assert.equal(fixture.calls[0]?.name, originalName);
    if (selectionKeys.some(function selection(key) { 
      return key === name; 
    })) {
      assert.equal(fixture.events[0], 'selection');
    }
  } });
}) });
//endregion
