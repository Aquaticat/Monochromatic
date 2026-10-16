/**
 Original constructor publication links completed owners to the frozen public surface. @module
 */
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {createJudgmentAPI} from './judgment-api.ts';
import type {
  JudgmentAPIInput,
  JudgmentPublicAPI
} from './judgment-api-types.ts';
import type {JudgmentPreparationSources} from './judgment-preparation-types.ts';
import type {JudgmentSources} from './judgment-source-types.ts';
import type {createJudgmentPrograms} from './program-owner.ts';
import type {createJudgmentExecutions} from './execution-owner.ts';
import type {createJudgmentInstructions} from './instruction-owner.ts';
import type {createJudgmentInspection} from './judgment-inspection.ts';
import type {JudgmentLifecycle} from './judgment-lifecycle-types.ts';
/**
 Publication diagnostics never inspect source values or invoke owner methods.
 */
const l=tagged({tag:'auto-mode-judgment-publication'});
/**
 Complete owned capabilities preserve original method identities at publication.
 */
type JudgmentPublicationInput<Source extends JudgmentPreparationSources> = Pick<JudgmentAPIInput<Source>,'prepare'|'knownSelection'|'active'|'assertDependenciesCurrent'|'readCurrentSourceBinding'> & Readonly<{
 programs:ReturnType<typeof createJudgmentPrograms>;
 executions:ReturnType<typeof createJudgmentExecutions>;
 instructions:ReturnType<typeof createJudgmentInstructions>;
 inspection:ReturnType<typeof createJudgmentInspection>;
 lifecycle:JudgmentLifecycle;
 sourceOwner:JudgmentSources<Source>;
}>;
//region Original public methods retain their owner function and fixed property order.
/**
 Publish completed owners without evaluating their lazy dependencies.

 @param input - original owner capabilities after the final construction checkpoint

 @returns frozen public API retaining original guards and direct calls

 @example publishJudgment(input);
 */
export function publishJudgment<const Source extends JudgmentPreparationSources>(input:JudgmentPublicationInput<Source>):JudgmentPublicAPI<Source>{
/**
 Retained capabilities remain fixed for this original judgment.
 */
const {
  programs,
  executions,
  lifecycle,
  instructions,
  inspection,
  sourceOwner,
  prepare,
  knownSelection,
  active,
  assertDependenciesCurrent,
  readCurrentSourceBinding
}=input;
/**
 Logging identifies publication without reading original inputs.
 */
const rl=tagged({
  tag:publishJudgment.name,
  l
});
rl.debug('publishing original judgment owners');
return createJudgmentAPI({
      bindPreparedProgram:programs.bindPreparedProgram,
      preparedProgramFor:programs.preparedProgramFor,
      openProgram:programs.openProgram,
      programFor:programs.programFor,
      reachProgramGroup:programs.reachProgramGroup,
      reachedGroupFor:programs.reachedGroupFor,
      bindProgramCalls:programs.bindProgramCalls,
      prepareReachedMembers:programs.prepareReachedMembers,
      invokeProgramNative:programs.invokeProgramNative,
      scriptValueFor:programs.scriptValueFor,
      markProgramGuard:programs.markProgramGuard,
      inspectReachedGroup:programs.inspectReachedGroup,
      originalFileFor:inspection.originalFileFor,
      preparedMemberFor:inspection.preparedMemberFor,
      assertExecutionEntry:executions.assertExecutionEntry,
      executionEntryFor:executions.executionEntryFor,
      inspectProgram:programs.inspectProgram,
      memberFor:executions.memberFor,
      beginExecution:executions.beginExecution,
      executionFor:executions.executionFor,
      finishExecution:executions.finishExecution,
      inspectExecution:executions.inspectExecution,
      prepare,
      claim:instructions.claim,
      claimInstruction:instructions.claimInstruction,
      captureClaimEvidence:lifecycle.captureClaimEvidence,
      assertClaimEvidence:lifecycle.assertClaimEvidence,
      readSourceSnapshot:sourceOwner.readSourceSnapshot,
      readCurrentSourceBinding,
      indexedUnitAdoptionPairs:instructions.indexedUnitAdoptionPairs,
      claimUnitAdoption:instructions.claimUnitAdoption,
      requestMaterialFor:instructions.requestMaterialFor,
      claimRequestMaterial:instructions.claimRequestMaterial,
      claimOperationDecision:instructions.claimOperationDecision,
      claimHeadingContext:instructions.claimHeadingContext,
      issueBoundPolicyBatch:instructions.issueBoundPolicyBatch,
      indexedRuleCandidates:instructions.indexedRuleCandidates,
      indexedInstructionCandidates:instructions.indexedInstructionCandidates,
      indexedHeadingContextCandidates:instructions.indexedHeadingContextCandidates,
      inspectRuleSources:instructions.inspectRuleSources,
      readPolicySelection:instructions.readPolicySelection,
      issueRuleAssessmentBatch:instructions.issueRuleAssessmentBatch,
      readRuleCandidate:instructions.readRuleCandidate,
      claimRuleCandidate:instructions.claimRuleCandidate,
      claimProgramRuleCandidate:instructions.claimProgramRuleCandidate,
      issueProgramRuleBatch:instructions.issueProgramRuleBatch,
      captureBatchEvidence:lifecycle.captureBatchEvidence,
      assertBatchEvidence:lifecycle.assertBatchEvidence,
      issue:lifecycle.issue,
      assess:lifecycle.assess,
      finalize:lifecycle.finalize,
      assertDependenciesCurrent,
      inspect:inspection.inspect,
      active,
      knownSelection,
      operation:lifecycle.operation,
    });
}
//endregion
