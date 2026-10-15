/**
 Original public judgment assembly preserves operation and retained-inspection boundaries. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {
  guardWithInput,
  guardWithoutInput
} from './judgment-api-guards.ts';
import type {
  JudgmentAPIInput,
  JudgmentPublicAPI
} from './judgment-api-types.ts';
import type { JudgmentPreparationSources } from './judgment-preparation-types.ts';

/**
 Assembly diagnostics never read source collections or invoke original operations.
 */
const l = tagged({ tag: 'auto-mode-judgment-api' });

//region One frozen public surface keeps original owner functions and lazy selection reads.
/**
 Assemble original owners without observing preparation, selection, or currentness.

 @param input - original owner functions captured by judgment construction

 @returns frozen public judgment with unchanged guarded and direct call boundaries

 @example createJudgmentAPI(input);
 */
export function createJudgmentAPI<const Source extends JudgmentPreparationSources>(input: JudgmentAPIInput<Source>): JudgmentPublicAPI<Source> {
  /**
   Original functions are captured once before publication.
   */
  const {
    bindPreparedProgram,
    preparedProgramFor,
    openProgram,
    programFor,
    reachProgramGroup,
    reachedGroupFor,
    bindProgramCalls,
    prepareReachedMembers,
    invokeProgramNative,
    scriptValueFor,
    markProgramGuard,
    inspectReachedGroup,
    originalFileFor,
    preparedMemberFor,
    assertExecutionEntry,
    executionEntryFor,
    inspectProgram,
    memberFor,
    beginExecution,
    executionFor,
    finishExecution,
    inspectExecution,
    prepare,
    claim,
    claimInstruction,
    captureClaimEvidence,
    assertClaimEvidence,
    readSourceSnapshot,
    readCurrentSourceBinding,
    indexedUnitAdoptionPairs,
    claimUnitAdoption,
    requestMaterialFor,
    claimRequestMaterial,
    claimHeadingContext,
    issueBoundPolicyBatch,
    indexedRuleCandidates,
    indexedInstructionCandidates,
    indexedHeadingContextCandidates,
    inspectRuleSources,
    readPolicySelection,
    issueRuleAssessmentBatch,
    readRuleCandidate,
    claimRuleCandidate,
    claimProgramRuleCandidate,
    issueProgramRuleBatch,
    captureBatchEvidence,
    assertBatchEvidence,
    issue,
    assess,
    finalize,
    assertDependenciesCurrent,
    inspect,
    active,
    knownSelection,
    operation,
  } = input;
  /**
   Entry logging omits original source content and opaque owner handles.
   */
  const rl = tagged({
    tag: createJudgmentAPI.name,
    l
  });
  rl.debug('assembling original public judgment');
  return Object.freeze({
      bindPreparedProgram: guardWithInput({
        operation,
        run: bindPreparedProgram
      }),
      preparedProgramFor: guardWithInput({
        operation,
        run: preparedProgramFor
      }),
      openProgram: guardWithInput({
        operation,
        run: openProgram
      }),
      programFor: guardWithInput({
        operation,
        run: programFor
      }),
      reachProgramGroup: guardWithInput({
        operation,
        run: reachProgramGroup
      }),
      reachedGroupFor: guardWithInput({
        operation,
        run: reachedGroupFor
      }),
      bindProgramCalls: guardWithInput({
        operation,
        run: bindProgramCalls
      }),
      prepareReachedMembers: guardWithInput({
        operation,
        run: prepareReachedMembers
      }),
      invokeProgramNative,
      scriptValueFor,
      markProgramGuard: guardWithInput({
        operation,
        run: markProgramGuard
      }),
      inspectReachedGroup,
      originalFileFor: guardWithInput({
        operation,
        run: originalFileFor
      }),
      preparedMemberFor: guardWithInput({
        operation,
        run: preparedMemberFor
      }),
      assertExecutionEntry: guardWithInput({
        operation,
        run: assertExecutionEntry
      }),
      executionEntryFor: guardWithInput({
        operation,
        run: executionEntryFor
      }),
      inspectProgram,
      memberFor: guardWithInput({
        operation,
        run: memberFor
      }),
      beginExecution: guardWithInput({
        operation,
        run: beginExecution
      }),
      executionFor: guardWithInput({
        operation,
        run: executionFor
      }),
      finishExecution: guardWithInput({
        operation,
        run: finishExecution
      }),
      inspectExecution,
      checkpoint: guardWithoutInput({
        operation,
        run: active
      }),
      prepare: guardWithInput({
        operation,
        run: prepare
      }),
      claim: guardWithInput({
        operation,
        run: claim
      }),
      claimInstruction: guardWithInput({
        operation,
        run: claimInstruction
      }),
      captureClaimEvidence: guardWithInput({
        operation,
        run: captureClaimEvidence
      }),
      assertClaimEvidence: guardWithInput({
        operation,
        run: assertClaimEvidence
      }),
      readSourceSnapshot,
      readCurrentSourceBinding: guardWithoutInput({
        operation,
        run: readCurrentSourceBinding
      }),
      indexedUnitAdoptionPairs: guardWithoutInput({
        operation,
        run: indexedUnitAdoptionPairs
      }),
      claimUnitAdoption: guardWithInput({
        operation,
        run: claimUnitAdoption
      }),
      requestMaterialFor: guardWithoutInput({
        operation,
        run: requestMaterialFor
      }),
      claimRequestMaterial: guardWithoutInput({
        operation,
        run: claimRequestMaterial
      }),
      claimHeadingContext: guardWithInput({
        operation,
        run: claimHeadingContext
      }),
      issueBoundPolicyBatch: guardWithInput({
        operation,
        run: issueBoundPolicyBatch
      }),
      indexedRuleCandidates: guardWithoutInput({
        operation,
        run: indexedRuleCandidates
      }),
      indexedInstructionCandidates: guardWithoutInput({
        operation,
        run: indexedInstructionCandidates
      }),
      indexedHeadingContextCandidates: guardWithoutInput({
        operation,
        run: indexedHeadingContextCandidates
      }),
      inspectRuleSources: guardWithoutInput({
        operation,
        run: inspectRuleSources
      }),
      readPolicySelection: guardWithoutInput({
        operation,
        run: readPolicySelection
      }),
      issueRuleAssessmentBatch: guardWithoutInput({
        operation,
        run: issueRuleAssessmentBatch
      }),
      readRuleCandidate: guardWithInput({
        operation,
        run: readRuleCandidate
      }),
      claimRuleCandidate: guardWithInput({
        operation,
        run: claimRuleCandidate
      }),
      claimProgramRuleCandidate: guardWithInput({
        operation,
        run: claimProgramRuleCandidate
      }),
      issueProgramRuleBatch: guardWithInput({
        operation,
        run: issueProgramRuleBatch
      }),
      captureBatchEvidence: guardWithInput({
        operation,
        run: captureBatchEvidence
      }),
      assertBatchEvidence: guardWithInput({
        operation,
        run: assertBatchEvidence
      }),
      issue: guardWithInput({
        operation,
        run: issue
      }),
      assess,
      finalize: guardWithoutInput({
        operation,
        run: finalize
      }),
      assertDependenciesCurrent: guardWithoutInput({
        operation,
        run: assertDependenciesCurrent
      }),
      inspect,
      inspectBatch(batch) { return knownSelection()
        .inspectBatch(batch); },
      inspectClaim(selectedClaim) { return knownSelection()
        .inspectClaim(selectedClaim); }
    });
}
//endregion
