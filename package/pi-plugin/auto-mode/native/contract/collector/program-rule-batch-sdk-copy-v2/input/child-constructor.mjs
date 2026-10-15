import {createJudgmentInstructions} from './judgment-instructions.mjs';
import {createJudgmentDependencyChecks} from './judgment-dependencies.mjs';






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

//region Fixed session-bound creator; all inputs come from the owned native JSON/prepared-member profile.
/** Bind one native consumer to source/root/file observers, fixed catalog and owned transport dependencies. */
export function createJudgmentConstructor({now,producerOwner,observer,collector,rootAdapter,rootDirectory,files,catalogText,catalogSHA256,send,isRetryableTransportFailure,trace,parsePolicy}) {
  return function construct({startedAt,signal,response,stream}) {
    let firstClockRead=true;
    const budget=createJudgmentBudget({now:function readJudgmentClock() {if(firstClockRead){firstClockRead=false;return startedAt;}return now();},signal,isRetryableTransportFailure});
    budget.checkpoint();
    const input={producerOwner,observer,stream,response};
    const sourceBinding=observer.beginJudgmentSources?observer.beginJudgmentSources(response):observer.bindJudgmentSources?.(response);
    const receipt=readMainAgentRequest(input);
    let judgmentSources=sourceBinding?.sources??receipt.sources;
    if(sourceBinding&&sourceBinding.request!==receipt)throw new JudgmentConstructionError("Judgment sources do not belong to the original request receipt");
    const {parentJSON,declaredNames}=captureJudgmentMembership(response);
    const judgmentCollector=Object.freeze({
      capture(options){
        if(options.signal!==signal)throw new JudgmentConstructionError('Dependency sources require original judgment cancellation');
        collector.assertObservedFresh(judgmentSources);
        return judgmentSources;
      },
      assertObservedFresh(snapshot){
        if(snapshot!==judgmentSources)throw new JudgmentConstructionError('Dependencies require the original assessed source collection');
        collector.assertObservedFresh(snapshot);
      }
    });
    const facade=createDependencyFacade({collector:judgmentCollector,rootAdapter,deadlineAt:budget.diagnostics().deadlineAt,rootDirectory,files,trace,now});
    const bindings=new WeakMap(),byMember=new Map(),childGroups=[];
    const {
      active, ready, dependencyCheck, bindingSegment, assertDependenciesCurrent, isBindingSegmentActive
    } = createJudgmentDependencyChecks({
      budget, input, receipt, facade, byMember, bindings, trace,
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
      readJudgmentSources() { return judgmentSources; },
      declaredNames,byMember,bindings,knownSelection,parsePolicy,receipt,issue
    });
    
    
    
    
    
    
    
    
    function knownSelection(){return preparation.knownSelection();}
    const preparation=createJudgmentPreparation({
      active,budget,declaredNames,observer,response,receipt,
      readJudgmentSources(){return judgmentSources;},
      publishJudgmentSources(sources){judgmentSources=sources;},
      facade,signal,parentJSON,catalogText,catalogSHA256,resolveBinding,bindings,byMember
    });
    const {prepare}=preparation;

    /** Return original identities only after the complete current dependency check succeeds. */
    function readCurrentSourceBinding(){
      assertDependenciesCurrent();
      return Object.freeze({request:receipt,sources:judgmentSources});
    }
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
    function preparedMemberFor(member){
      const record=knownMember(member);
      assertDependenciesCurrent();
      parentCurrent(record);
      return Object.freeze({
        prepared:record.prepared,
        signal:record.effectiveSignal,
        programInspection:record.preparedProgram?.view
      });
    }
    function originalFileFor(member){
      ready();const record=knownMember(member);parentCurrent(record);
      return facade.originalFile({handle:preparation.state.handle,absolutePath:record.prepared.input.path});
    }
    function memberExecutionStates(){return Object.freeze([...byMember.entries()].map(function readExecutionState([id,handle]) { return (Object.freeze({id,state:bindings.get(handle).execution?.state??'unentered'})); }));}
    function inspect(){return Object.freeze({prepared:preparation.state.prepared,preparationFailed:preparation.state.preparationFailed,preparationFailure:preparation.state.preparationFailure,finished:lifecycle.state.finished,closeFailed:lifecycle.state.closeFailed,accounting:budget.diagnostics(),finalRecord:lifecycle.state.finalRecord,memberExecutions:memberExecutionStates(),preparedPrograms:Object.freeze([...byMember.values()].flatMap(function readPreparedProgramView(member) {const inspection=bindings.get(member).preparedProgram;return inspection?[inspection.view]:[];})),rootPrograms:Object.freeze([...byMember.values()].flatMap(function readRootProgramView(member) {const record=bindings.get(member);return record.program?[inspectProgram(record.program.handle)]:[];})),childGroups:Object.freeze(childGroups.map(function inspectChildGroup(group) { return (inspectReachedGroup(group.handle)); }))});}
    /** Retain the original synchronous operation guard for one-input public methods. */
    function guardWithInput(run) {
      return function invokeJudgmentOperation(input) {
        return operation(function runBoundJudgmentOperation() { return run(input); });
      };
    }
    /** Retain no-input operation calls without changing their argument list. */
    function guardWithoutInput(run) {
      return function invokeJudgmentOperation() { return operation(run); };
    }
    budget.checkpoint();const judgment=Object.freeze({
      bindPreparedProgram: guardWithInput(bindPreparedProgram),
      preparedProgramFor: guardWithInput(preparedProgramFor),
      openProgram: guardWithInput(openProgram),
      programFor: guardWithInput(programFor),
      reachProgramGroup: guardWithInput(reachProgramGroup),
      reachedGroupFor: guardWithInput(reachedGroupFor),
      bindProgramCalls: guardWithInput(bindProgramCalls),
      prepareReachedMembers: guardWithInput(prepareReachedMembers),
      invokeProgramNative,
      scriptValueFor,
      markProgramGuard: guardWithInput(markProgramGuard),
      inspectReachedGroup,
      originalFileFor: guardWithInput(originalFileFor),
      preparedMemberFor: guardWithInput(preparedMemberFor),
      assertExecutionEntry: guardWithInput(assertExecutionEntry),
      executionEntryFor: guardWithInput(executionEntryFor),
      inspectProgram,
      memberFor: guardWithInput(memberFor),
      beginExecution: guardWithInput(beginExecution),
      executionFor: guardWithInput(executionFor),
      finishExecution: guardWithInput(finishExecution),
      inspectExecution,
      checkpoint: guardWithoutInput(active),
      prepare: guardWithInput(prepare),
      claim: guardWithInput(claim),
      claimInstruction: guardWithInput(claimInstruction),
      captureClaimEvidence: guardWithInput(captureClaimEvidence),
      assertClaimEvidence: guardWithInput(assertClaimEvidence),
      readSourceSnapshot() { return judgmentSources; },
      readCurrentSourceBinding: guardWithoutInput(readCurrentSourceBinding),
      indexedUnitAdoptionPairs: guardWithoutInput(indexedUnitAdoptionPairs),
      claimUnitAdoption: guardWithInput(claimUnitAdoption),
      requestMaterialFor: guardWithoutInput(requestMaterialFor),
      claimRequestMaterial: guardWithoutInput(claimRequestMaterial),
      claimHeadingContext: guardWithInput(claimHeadingContext),
      issueBoundPolicyBatch: guardWithInput(issueBoundPolicyBatch),
      indexedRuleCandidates: guardWithoutInput(indexedRuleCandidates),
      indexedInstructionCandidates: guardWithoutInput(indexedInstructionCandidates),
      indexedHeadingContextCandidates: guardWithoutInput(indexedHeadingContextCandidates),
      inspectRuleSources: guardWithoutInput(inspectRuleSources),
      readPolicySelection: guardWithoutInput(readPolicySelection),
      issueRuleAssessmentBatch: guardWithoutInput(issueRuleAssessmentBatch),
      readRuleCandidate: guardWithInput(readRuleCandidate),
      claimRuleCandidate: guardWithInput(claimRuleCandidate),
      claimProgramRuleCandidate: guardWithInput(claimProgramRuleCandidate),
      issueProgramRuleBatch: guardWithInput(issueProgramRuleBatch),
      captureBatchEvidence: guardWithInput(captureBatchEvidence),
      assertBatchEvidence: guardWithInput(assertBatchEvidence),
      issue: guardWithInput(issue),
      assess,
      finalize: guardWithoutInput(finalize),
      assertDependenciesCurrent: guardWithoutInput(assertDependenciesCurrent),
      inspect,
      inspectBatch(batch) { return knownSelection().inspectBatch(batch); },
      inspectClaim(claim) { return knownSelection().inspectClaim(claim); }
    });return judgment;
  };
}
//endregion
