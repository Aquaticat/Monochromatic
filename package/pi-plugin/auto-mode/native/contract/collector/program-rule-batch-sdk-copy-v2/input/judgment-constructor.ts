/** Original judgment construction composes independently owned native capabilities. @module */
import {tagged} from '@monochromatic-dev/module-logger/ts';
import type {JudgmentConstructorSources,JudgmentConstructorInput,JudgmentConstructionInput} from './judgment-constructor-types.ts';
import type {JudgmentPublicAPI} from './judgment-api-types.ts';
import type {ProgramMemberRecord,ProgramGroup} from './program-state-types.ts';
import type {InstructionMember} from './instruction-types.ts';
import {createJudgmentAPI} from './judgment-api.ts';
import {createJudgmentInstructions} from './instruction-owner.ts';
import {createJudgmentDependencyChecks} from './judgment-dependencies.ts';

import {createJudgmentBudget} from "../../../lifecycle/judgment-budget-error-occurrences/controls-private/candidate.ts";
import {createDependencyFacade} from "../../../lifecycle/native-text-read-contract/dependencies.mjs";
import {readMainAgentRequest} from "../../request-producer-group-consumer/request.ts";

import {createJudgmentPrograms} from './program-owner.ts';
import {createJudgmentExecutions} from './execution-owner.ts';
import {createJudgmentLifecycle} from './judgment-lifecycle.ts';
import {captureJudgmentMembership} from './judgment-membership.ts';
import {createJudgmentPreparation} from './judgment-preparation.ts';
import {createJudgmentInspection} from './judgment-inspection.ts';
import {createJudgmentSources} from './judgment-sources.ts';

/** Construction logs never serialize native inputs or original source collections. */
const l=tagged({tag:'auto-mode-judgment-constructor'});

//region Fixed session-bound creator; all inputs come from the owned native JSON/prepared-member profile.
/** Bind one native consumer to source/root/file observers, fixed catalog and owned transport dependencies. */
export function createJudgmentConstructor<const Source extends JudgmentConstructorSources, const Root extends object>(options: JudgmentConstructorInput<Source, Root>): (input: JudgmentConstructionInput) => JudgmentPublicAPI<Source> {
  /** Fixed bootstrap capabilities are captured once for original judgment construction. */
  const {now,producerOwner,observer,collector,rootAdapter,rootDirectory,files,catalogText,catalogSHA256,send,isRetryableTransportFailure,trace,parsePolicy} = options;
  /** Constructor diagnostics omit source values and native occurrence identities. */
  const rl = tagged({tag:createJudgmentConstructor.name,l});
  rl.debug('binding original judgment constructor');
  return function construct({startedAt,signal,response,stream}: JudgmentConstructionInput): JudgmentPublicAPI<Source> {
    /** Selection remains lazy until original preparation publishes it. */
    function knownSelection() { return preparation.knownSelection(); }
    /** Construction starts without reading source or response contents for diagnostics. */
    const cl = tagged({tag:construct.name,l:rl});
    cl.debug('constructing original judgment');
    /** First budget observation retains original decision start time. */
    const clockState={firstClockRead:true};
    const budget=createJudgmentBudget({now:function readJudgmentClock() {if(clockState.firstClockRead){clockState.firstClockRead=false;return startedAt;}return now();},signal,isRetryableTransportFailure});
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
    /** Root and child owners share exact original record identities. */
    const bindings=new WeakMap<object,ProgramMemberRecord & InstructionMember>();
    /** Declared member identifiers retain original publication order. */
    const byMember=new Map<string,object>();
    /** Retained reached groups share original program ownership. */
    const childGroups:ProgramGroup[]=[];
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
