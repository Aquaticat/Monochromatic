import {createJudgmentAPI} from './judgment-api.ts';
import {createJudgmentInstructions} from './judgment-instructions.mjs';
import {createJudgmentDependencyChecks} from './judgment-dependencies.ts';






import {createJudgmentBudget} from "../../../lifecycle/judgment-budget-error-occurrences/controls-private/candidate.ts";
import {createDependencyFacade} from "../../../lifecycle/native-text-read-contract/dependencies.mjs";
import {readMainAgentRequest} from "../../request-producer-group-consumer/request.mjs";

import {JudgmentConstructionError} from './judgment-input.mjs';
export {JudgmentConstructionError} from './judgment-input.mjs';
import {createJudgmentPrograms} from './judgment-programs.mjs';
import {createJudgmentExecutions} from './execution-owner.ts';
import {createJudgmentLifecycle} from './judgment-lifecycle.ts';
import {captureJudgmentMembership} from './judgment-membership.ts';
import {createJudgmentPreparation} from './judgment-preparation.ts';
import {createJudgmentInspection} from './judgment-inspection.ts';
import {createJudgmentSources} from './judgment-sources.ts';

//region Fixed session-bound creator; all inputs come from the owned native JSON/prepared-member profile.
/** Bind one native consumer to source/root/file observers, fixed catalog and owned transport dependencies. */
export function createJudgmentConstructor({now,producerOwner,observer,collector,rootAdapter,rootDirectory,files,catalogText,catalogSHA256,send,isRetryableTransportFailure,trace,parsePolicy}) {
  return function construct({startedAt,signal,response,stream}) {
    let firstClockRead=true;
    const budget=createJudgmentBudget({now:function readJudgmentClock() {if(firstClockRead){firstClockRead=false;return startedAt;}return now();},signal,isRetryableTransportFailure});
    budget.checkpoint();
    const input={producerOwner,observer,stream,response};
    const sourceOwner=createJudgmentSources({
      observer,response,signal,collector,
      readOriginalRequest(){return readMainAgentRequest(input);},
      assertDependenciesCurrent(){return assertDependenciesCurrent();}
    });
    const {receipt,readCurrentSourceBinding}=sourceOwner;
    const {parentJSON,declaredNames}=captureJudgmentMembership(response);
    const facade=createDependencyFacade({collector:sourceOwner.collector,rootAdapter,deadlineAt:budget.diagnostics().deadlineAt,rootDirectory,files,trace,now});
    const bindings=new WeakMap(),byMember=new Map(),childGroups=[];
    const {
      active, ready, dependencyCheck, bindingSegment, assertDependenciesCurrent, isBindingSegmentActive
    } = createJudgmentDependencyChecks({
      budget, readOriginalRequest(){return readMainAgentRequest(input);}, receipt, facade, byMember, bindings, trace,
      readPreparation() {
        const {prepared,preparationFailed,preparationFailure,handle}=preparation.state;
        return { prepared, preparationFailed, preparationFailure, finished:lifecycle.state.finished, closeFailed:lifecycle.state.closeFailed, finalRecord:lifecycle.state.finalRecord, handle };
      }
    });
    const lifecycle=createJudgmentLifecycle({
      knownSelection,ready,active,bindingSegment,assertDependenciesCurrent,budget,
      finalizeDependencies(dependencyHandle){return facade.finalize(dependencyHandle);},
      readDependencyHandle(){return preparation.state.handle;},
      parentJSON,send
    });
    const {operation,issue,assess,finalize,captureBatchEvidence,assertBatchEvidence,captureClaimEvidence,assertClaimEvidence}=lifecycle;
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
      ready,bindingSegment,
      isBindingSegmentActive,
      readJudgmentSources:sourceOwner.readSourceSnapshot,
      declaredNames,byMember,bindings,knownSelection,parsePolicy,receipt,issue
    });
    
    
    
    
    
    
    
    
    function knownSelection(){return preparation.knownSelection();}
    const preparation=createJudgmentPreparation({
      active,budget,declaredNames,observer,response,receipt,
      readJudgmentSources:sourceOwner.readSourceSnapshot,
      publishJudgmentSources:sourceOwner.publishJudgmentSources,
      facade,signal,parentJSON,catalogText,catalogSHA256,resolveBinding,bindings,byMember
    });
    const {prepare}=preparation;

    const {
      memberFor, knownMember, knownExecution, parentCurrent,
      assertExecutionEntry, executionEntryFor, beginExecution, executionFor,
      finishExecution, inspectExecution
    }=createJudgmentExecutions({
      bindings, byMember,
      readClosure(){return {finished:lifecycle.state.finished,closeFailed:lifecycle.state.closeFailed};},
      readJudgment(){return judgment;},
      response, stream, assertDependenciesCurrent
    });
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
      readJudgment() { return judgment; },
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
    const {preparedMemberFor,originalFileFor,inspect}=createJudgmentInspection({
      preparation:preparation.state,lifecycle:lifecycle.state,budget,byMember,bindings,childGroups,
      knownMember,assertDependenciesCurrent,parentCurrent,ready,
      originalFile(input){return facade.originalFile(input);},
      inspectProgram,inspectReachedGroup
    });
    budget.checkpoint();const judgment=createJudgmentAPI({
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
    });return judgment;
  };
}
//endregion
