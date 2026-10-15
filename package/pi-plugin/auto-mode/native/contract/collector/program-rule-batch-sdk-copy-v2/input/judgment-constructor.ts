/**
 Original judgment construction composes independently owned native capabilities. @module
 */
import {tagged} from '@monochromatic-dev/module-logger/ts';
import type {
  JudgmentConstructorSources,
  JudgmentConstructorInput,
  JudgmentConstructionInput
} from './judgment-constructor-types.ts';
import type {JudgmentPublicAPI} from './judgment-api-types.ts';
import {createJudgmentFoundation} from './judgment-foundation.ts';
import type { QuestionSelection } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner.ts';
import {createJudgmentAPI} from './judgment-api.ts';
import {createJudgmentInstructions} from './instruction-owner.ts';
import {createJudgmentDependencyChecks} from './judgment-dependencies.ts';

import {readMainAgentRequest} from "../../request-producer-group-consumer/request.ts";

import {createJudgmentPrograms} from './program-owner.ts';
import {createJudgmentExecutions} from './execution-owner.ts';
import {createJudgmentLifecycle} from './judgment-lifecycle.ts';
import {createJudgmentPreparation} from './judgment-preparation.ts';
import {createJudgmentInspection} from './judgment-inspection.ts';

/**
 Construction logs never serialize native inputs or original source collections.
 */
const l=tagged({tag:'auto-mode-judgment-constructor'});

//region Fixed session-bound creator; all inputs come from the owned native JSON/prepared-member profile.
/**
 Bind one native consumer to source/root/file observers, fixed catalog and owned transport dependencies.

 @param options - fixed bootstrap capabilities retained across original occurrences

 @returns original occurrence constructor with independent ownership and lifetime

 @example createJudgmentConstructor(options);
 */
export function createJudgmentConstructor<const Source extends JudgmentConstructorSources, const Root extends object>(options: JudgmentConstructorInput<Source, Root>): (input: JudgmentConstructionInput) => JudgmentPublicAPI<Source> {
  /**
   Fixed bootstrap capabilities are captured once for original judgment construction.
   */
  const {
    now,
    producerOwner,
    observer,
    collector,
    rootAdapter,
    rootDirectory,
    files,
    catalogText,
    catalogSHA256,
    send,
    isRetryableTransportFailure,
    trace,
    parsePolicy
  } = options;
  /**
   Constructor diagnostics omit source values and native occurrence identities.
   */
  const rl = tagged({
    tag:createJudgmentConstructor.name,
    l
  });
  rl.debug('binding original judgment constructor');
  return function construct({
    startedAt,
    signal,
    response,
    stream
  }: JudgmentConstructionInput): JudgmentPublicAPI<Source> {
    /**
     Selection remains lazy until original preparation publishes it.

     @returns original prepared question selection
     */
    function knownSelection(): QuestionSelection { 
      return preparation.knownSelection(); 
    }
    /**
     Construction starts without reading source or response contents for diagnostics.
     */
    const cl = tagged({
      tag:construct.name,
      l:rl
    });
    cl.debug('constructing original judgment');
    /** Original foundation preserves budget, source, membership, and facade ordering. */
    /** Original owner capabilities retain captured method identities. */
    const {budget,requestInput,sourceOwner,receipt,readCurrentSourceBinding,parentJSON,declaredNames,facade,bindings,byMember,childGroups}=createJudgmentFoundation({now,producerOwner,observer,collector,rootAdapter,rootDirectory,files,isRetryableTransportFailure,trace,startedAt,signal,response,stream,assertDependenciesCurrent(){return assertDependenciesCurrent();}});
    /** Original owner capabilities retain captured method identities. */
    const {
      active,
      ready,
      dependencyCheck,
      bindingSegment,
      assertDependenciesCurrent,
      isBindingSegmentActive
    } = createJudgmentDependencyChecks({
      budget,
      readOriginalRequest(){
        return readMainAgentRequest(requestInput);
      },
      receipt,
      facade,
      byMember,
      bindings,
      trace,
      readPreparation() {
        /** Original owner capabilities retain captured method identities. */
    const {prepared,preparationFailed,preparationFailure,handle}=preparation.state;
        return { prepared, preparationFailed, preparationFailure, finished:lifecycle.state.finished, closeFailed:lifecycle.state.closeFailed, finalRecord:lifecycle.state.finalRecord, handle };
      }
    });
    /** Original lifecycle shares preparation and dependency boundaries. */
    const lifecycle=createJudgmentLifecycle({
      knownSelection,
      ready,
      active,
      bindingSegment,
      assertDependenciesCurrent,
      budget,
      finalizeDependencies(dependencyHandle){
        return facade.finalize(dependencyHandle);
      },
      readDependencyHandle(){
        return preparation.state.handle;
      },
      parentJSON,
      send
    });
    /** Original owner capabilities retain captured method identities. */
    const {
      operation,
      issue,
      assess,
      finalize,
      captureBatchEvidence,
      assertBatchEvidence,
      captureClaimEvidence,
      assertClaimEvidence
    }=lifecycle;
    /** Original owner capabilities retain captured method identities. */
    const {
      resolveBinding,
      indexedUnitAdoptionPairs,
      claimUnitAdoption,
      requestMaterialFor,
      claimRequestMaterial,
      claimHeadingContext,
      issueBoundPolicyBatch,
      claim,
      indexedRuleCandidates,
      readRuleCandidate,
      indexedInstructionCandidates,
      indexedHeadingContextCandidates,
      inspectRuleSources,
      readPolicySelection,
      claimProgramRuleCandidate,
      issueProgramRuleBatch,
      issueRuleAssessmentBatch,
      claimRuleCandidate,
      claimInstruction
    }=createJudgmentInstructions({
      ready,
      bindingSegment,
      isBindingSegmentActive,
      readJudgmentSources:sourceOwner.readSourceSnapshot,
      declaredNames,
      byMember,
      bindings,
      knownSelection,
      parsePolicy,
      receipt,
      issue
    });

    /** Original preparation remains lazy until native members are complete. */
    const preparation=createJudgmentPreparation({
      active,
      budget,
      declaredNames,
      observer,
      response,
      receipt,
      readJudgmentSources:sourceOwner.readSourceSnapshot,
      publishJudgmentSources:sourceOwner.publishJudgmentSources,
      facade,
      signal,
      parentJSON,
      catalogText,
      catalogSHA256,
      resolveBinding,
      bindings,
      byMember
    });
    /** Original owner capabilities retain captured method identities. */
    const {prepare}=preparation;

    /** Original owner capabilities retain captured method identities. */
    const {
      memberFor,
      knownMember,
      knownExecution,
      parentCurrent,
      assertExecutionEntry,
      executionEntryFor,
      beginExecution,
      executionFor,
      finishExecution,
      inspectExecution
    }=createJudgmentExecutions({
      bindings,
      byMember,
      readClosure(){
        return {finished:lifecycle.state.finished,closeFailed:lifecycle.state.closeFailed};
      },
      readJudgment(){
        return judgment;
      },
      response,
      stream,
      assertDependenciesCurrent
    });
    /** Original owner capabilities retain captured method identities. */
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
      inspectProgram
    }=createJudgmentPrograms({
      readJudgment() { 
        return judgment; 
      },
      response,
      stream,
      signal,
      knownMember,
      knownExecution,
      ready,
      dependencyCheck,
      assertDependenciesCurrent,
      parentCurrent,
      bindings,
      childGroups,
      operation
    });
    /** Original owner capabilities retain captured method identities. */
    const {
      preparedMemberFor,
      originalFileFor,
      inspect
    }=createJudgmentInspection({
      preparation:preparation.state,
      lifecycle:lifecycle.state,
      budget,
      byMember,
      bindings,
      childGroups,
      knownMember,
      assertDependenciesCurrent,
      parentCurrent,
      ready,
      originalFile(input){
        return facade.originalFile(input);
      },
      inspectProgram,
      inspectReachedGroup
    });
    budget.checkpoint();
    /** Public ownership is published after the final construction checkpoint. */
    const judgment=createJudgmentAPI({
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
      readSourceSnapshot:sourceOwner.readSourceSnapshot,
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
    });
    return judgment;
  };
}
//endregion
