import {createJudgmentInstructions} from './judgment-instructions.mjs';
import {createJudgmentDependencyChecks} from './judgment-dependencies.mjs';






import {createJudgmentBudget} from "../../../lifecycle/judgment-budget-error-occurrences/controls-private/candidate.mjs";
import {createQuestionSelection,readAssessmentResponse} from "../../../lifecycle/claim-evidence-batch-selection/selection.mjs";
import {createDependencyFacade} from "../../../lifecycle/native-text-read-contract/dependencies.mjs";
import {readMainAgentRequest} from "../../request-producer-group-consumer/request.mjs";

import {JudgmentConstructionError, requireJSONInput} from './judgment-input.mjs';
export {JudgmentConstructionError} from './judgment-input.mjs';
import {createJudgmentPrograms} from './judgment-programs.mjs';

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
    // SDK-produced content is an owned plain JSON tree in this finite profile, not arbitrary JavaScript objects.
    for(const part of response.content)if(part.type==='toolCall')requireJSONInput(part.arguments);
    const parentJSON=JSON.stringify(response.content);
    if(typeof parentJSON!=='string'||Buffer.byteLength(parentJSON)>1048576)throw new JudgmentConstructionError('Native enclosing response exceeds the declared JSON profile');
    const content=JSON.parse(parentJSON);
    if(!Array.isArray(content))throw new JudgmentConstructionError('Native enclosing response has no content array');
    const declared=content.filter(function isToolCall(value) { return (value&&value.type==='toolCall'); });
    if(declared.length===0||declared.length>64||declared.some(function hasInvalidToolIdentity(value) { return (typeof value.id!=='string'||!value.id||typeof value.name!=='string'||!value.name); })||new Set(declared.map(function readDeclaredCallId(value) { return (value.id); })).size!==declared.length)throw new JudgmentConstructionError('Enclosing judgment requires complete unique native tool membership');
    const declaredNames=Object.freeze(declared.map(function copyDeclaredToolIdentity(value) { return (Object.freeze({id:value.id,name:value.name})); }));
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
    const bindings=new WeakMap(),byMember=new Map(),executions=new WeakMap(),childGroups=[],issuedBatches=new Set(),attemptedBatches=new WeakSet();let operating=false,assessing=false,prepared=false,preparing=false,preparationFailed=false,preparationFailure,handle,selection,finished=false,closeFailed=false,finalRecord;
    function operation(run){
      if(operating)throw new JudgmentConstructionError('Judgment operations cannot reenter through callbacks');
      operating=true;
      using activity={ [Symbol.dispose](){operating=false;} };
      return run();
    }
    const {
      active, ready, dependencyCheck, bindingSegment, assertDependenciesCurrent, isBindingSegmentActive
    } = createJudgmentDependencyChecks({
      budget, input, receipt, facade, byMember, bindings, trace,
      readPreparation() {
        return { prepared, preparationFailed, preparationFailure, finished, closeFailed, finalRecord, handle };
      }
    });
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
    
    
    
    
    
    
    
    
    function knownSelection(){if(!selection)throw new JudgmentConstructionError('Judgment question selection was not prepared');return selection;}
    function prepare(members){
      active();if(prepared||preparing)throw new JudgmentConstructionError('Prepared judgment membership cannot be replaced or reentered');preparing=true;
      using preparation={ [Symbol.dispose](){preparing=false;} };
      try {
        if(!Array.isArray(members)||!Object.isFrozen(members)||members.length!==declaredNames.length)throw new JudgmentConstructionError('Prepared group differs from complete declared membership');
        for(let index=0;index<members.length;index+=1){const member=members[index],expected=declaredNames[index];if(!member||!Object.isFrozen(member)||member.id!==expected.id||member.name!==expected.name||!Object.hasOwn(member,'input')||!Object.isFrozen(member.input))throw new JudgmentConstructionError('Prepared member identity or sealed input differs from the native group');}
        for(const member of members)requireJSONInput(member.input);
        const preparedJSON=JSON.stringify(members);
        if(typeof preparedJSON!=='string'||Buffer.byteLength(preparedJSON)>1048576)throw new JudgmentConstructionError('Prepared member data exceeds the declared JSON profile');
        if(observer.beginJudgmentSources){const binding=observer.sealJudgmentSources(response);if(binding.request!==receipt)throw new JudgmentConstructionError("Prepared sources lost their original request receipt");judgmentSources=binding.sources;}
        const dependencyHandle=facade.prepare({signal});
        active();facade.finalize(dependencyHandle);budget.checkpoint();
        const mandatoryPolicy=judgmentSources.mandatoryPolicy;
        if(!mandatoryPolicy||!Object.isFrozen(mandatoryPolicy)||typeof mandatoryPolicy.content!=='string')throw new JudgmentConstructionError('Original request lacks complete owned mandatory policy');
        const envelope=Object.freeze({parentJSON,preparedJSON,requestBody:receipt.request.body,mandatoryPolicy,governingSources:judgmentSources.governingSources,instructionAuthority:'not-established'});
        selection=createQuestionSelection({catalogText,catalogSHA256,budget,resolveBinding,envelope});
        active();budget.checkpoint();
        // Publish immutable occurrence records only after complete input and dependency checks.
        for(const [ordinal,member] of members.entries()){
          const bindingHandle=Object.freeze({}),identity=Object.freeze({});
          const projection=Object.freeze({memberOrdinal:ordinal});
          bindings.set(bindingHandle,{binding:Object.freeze({identity,projection}),prepared:member,execution:undefined,parent:undefined,program:undefined,effectiveSignal:signal});byMember.set(member.id,bindingHandle);
        }
        handle=dependencyHandle;prepared=true;
      } catch(error){preparationFailed=true;preparationFailure=error;throw error;}
    }
    
    
    
    
    
    
    
    
    
    
    /** Authenticate original batch and terminal phase before any eligibility failure can be retained. */
    function captureBatchEvidence(batch){
      if(!issuedBatches.has(batch))throw new JudgmentConstructionError('Question batch is not owned by this judgment');
      knownSelection().assertCapturableBatch(batch);
      return bindingSegment(function readBatchEvidence() { return (knownSelection().captureBatchEvidence(batch)); });
    }
    function assertBatchEvidence(evidence){
      knownSelection().assertCapturedBatchIdentity(evidence);
      assertDependenciesCurrent();
    }
    
    
    
    function captureClaimEvidence(claim){ready();return knownSelection().captureEvidence(claim);}
    function assertClaimEvidence(input){
      knownSelection().assertCapturedIdentity(input);
      assertDependenciesCurrent();
    }
    function issue(claims){ready();const batch=selection.issue(claims);issuedBatches.add(batch);return batch;}
    async function assess(batch){
      if(operating)throw new JudgmentConstructionError('Judgment operations cannot overlap or reenter');operating=true;
      using activity={ [Symbol.dispose](){operating=false;} };
      if(!issuedBatches.has(batch))throw new JudgmentConstructionError('Question batch is not owned by this judgment');
      if(attemptedBatches.has(batch))throw new JudgmentConstructionError('Question batch cannot be assessed concurrently or sampled again');
      attemptedBatches.add(batch);assessing=true;
      using assessment={ [Symbol.dispose](){assessing=false;} };
      try {
        const request=bindingSegment(function readBatchRequest() { return (selection.requestFor(batch)); });
        const answer=await budget.dispatch(function sendAssessmentAttempt(attempt) { return (send(Object.freeze({request,...attempt}))); });
        return bindingSegment(function settleAssessmentAnswer() { return (selection.settle({batch,...readAssessmentResponse(answer)})); });
      } catch(error) {
        try {if(!selection.inspectBatch(batch).settled)selection.discard({batch,error});}
        catch(retentionError){throw new AggregateError([error,retentionError],'Assessment failure and terminal retention failure');}
        throw error;
      }
    }
    function finalize(){
      if(finished||closeFailed)throw new JudgmentConstructionError('Judgment already has a finalization outcome');
      try {
        for(const batch of issuedBatches)if(!selection.inspectBatch(batch).settled)selection.discard({batch,error:new JudgmentConstructionError('Judgment closed before this question batch was dispatched')});
        ready();
        const batches=bindingSegment(function readIssuedBatchResults() { return (Object.freeze([...issuedBatches].map(function readBatchResult(batch) { return (selection.resultFor(batch)); }))); });
        const dependencies=facade.finalize(handle);active();
        const accounting=budget.finish();finished=true;
        finalRecord=Object.freeze({evidenceOnly:true,status:'evidence-closed',policyVerdict:'not-established',instructionAuthority:'not-established',humanPermission:false,dependencies,accounting,parentJSON,batches});return finalRecord;
      } catch(error) {
        closeFailed=true;
        finalRecord=Object.freeze({retainedOnly:true,status:'close-failed',failure:error,accounting:budget.diagnostics(),batches:Object.freeze([...issuedBatches].map(function inspectIssuedBatch(batch) { return (selection.inspectBatch(batch)); }))});
        throw error;
      }
    }
    /** Return original identities only after the complete current dependency check succeeds. */
    function readCurrentSourceBinding(){
      assertDependenciesCurrent();
      return Object.freeze({request:receipt,sources:judgmentSources});
    }
    /** Selector returns the already-owned member handle, not proof derived from the identifier. */
    function memberFor(memberId){assertDependenciesCurrent();const member=byMember.get(memberId);if(!member)throw new JudgmentConstructionError('Execution member was not in the prepared native group');return member;}
    function knownMember(member){const record=bindings.get(member);if(!record)throw new JudgmentConstructionError('Execution member handle is not owned by this judgment');return record;}
    function knownExecution(token){const record=executions.get(token);if(!record||record.execution.token!==token)throw new JudgmentConstructionError('Execution occurrence is not owned by this judgment');return record;}
    /** Original parent is an entry dependency, not an ancestor-liveness condition on an already-active child. */
    function parentCurrent(record){
      if(record.parent!==undefined&&knownExecution(record.parent).execution.state!=='active')throw new JudgmentConstructionError('Immediate parent execution has returned before child entry');
      record.effectiveSignal?.throwIfAborted();
    }
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
      return facade.originalFile({handle,absolutePath:record.prepared.input.path});
    }
    function assertExecutionEntry(token){const record=knownExecution(token);if(record.execution.state!=='active')throw new JudgmentConstructionError('Execution occurrence has returned before native entry');assertDependenciesCurrent();parentCurrent(record);}
    /** Read the original execution origin after authenticating this exact native entry. */
    function executionEntryFor(token){
      assertExecutionEntry(token);
      return knownExecution(token).execution.origin;
    }
    /** Reserve once only after evidence closes; scope identity is not an execution permission. */
    function beginExecution(member){
      const record=knownMember(member);
      if(!finished||closeFailed)throw new JudgmentConstructionError('Execution occurrence requires successfully closed evidence');
      if(record.execution)throw new JudgmentConstructionError('Prepared member already reserved its execution occurrence');
      assertDependenciesCurrent();parentCurrent(record);
      const token=Object.freeze({}),origin=Object.freeze({judgment,response,stream,signal:record.effectiveSignal,member,prepared:record.prepared,permission:'not-established'});
      record.execution={token,state:'active',origin};executions.set(token,record);return token;
    }
    function executionFor(token){const record=knownExecution(token);if(record.execution.state!=='active')throw new JudgmentConstructionError('Parent execution occurrence has returned');assertDependenciesCurrent();record.execution.origin.signal.throwIfAborted();return record.execution.origin;}
    /** Terminal marking never invokes the source reader and is safe after cancellation or stale dependencies. */
    function finishExecution(token){const record=knownExecution(token);record.execution.state='returned';}
    function inspectExecution(token){const record=knownExecution(token);return Object.freeze({retainedOnly:true,state:record.execution.state});}
    function memberExecutionStates(){return Object.freeze([...byMember.entries()].map(function readExecutionState([id,handle]) { return (Object.freeze({id,state:bindings.get(handle).execution?.state??'unentered'})); }));}
    function inspect(){return Object.freeze({prepared,preparationFailed,preparationFailure,finished,closeFailed,accounting:budget.diagnostics(),finalRecord,memberExecutions:memberExecutionStates(),preparedPrograms:Object.freeze([...byMember.values()].flatMap(function readPreparedProgramView(member) {const inspection=bindings.get(member).preparedProgram;return inspection?[inspection.view]:[];})),rootPrograms:Object.freeze([...byMember.values()].flatMap(function readRootProgramView(member) {const record=bindings.get(member);return record.program?[inspectProgram(record.program.handle)]:[];})),childGroups:Object.freeze(childGroups.map(function inspectChildGroup(group) { return (inspectReachedGroup(group.handle)); }))});}
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
