import {createGoverningRuleBindings} from "../../../lifecycle/governing-rule-candidates/bindings.mjs";
import {declareResultProgram} from "./program-profile-reviewed.mjs";
import {materializePattern} from "./result-pattern.mjs";
import {createNativeReturnConsumer} from "./native-return-consumer.mjs";
import {NativeScriptValueGuardError,scriptValueGuard} from "./script-value-guard.ts";
import {createJudgmentBudget} from "../../../lifecycle/judgment-budget-error-occurrences/controls-private/candidate.mjs";
import {createQuestionSelection} from "../../../lifecycle/claim-evidence-batch-selection/selection.mjs";
import {createDependencyFacade} from "../../../lifecycle/native-text-read-contract/dependencies.mjs";
import {readMainAgentRequest} from "../../request-producer-group-consumer/request.mjs";

export class JudgmentConstructionError extends Error {constructor(message,options){super(message,options);this.name=this.constructor.name;}}
/** Reject admitted JSON-like values whose meaning ordinary JSON would silently change. */
function requireJSONInput(input){JSON.stringify(input,(_key,value)=>{if(value===undefined||(typeof value==='number'&&(!Number.isFinite(value)||Object.is(value,-0))))throw new JudgmentConstructionError('Native tool input contains a value not preserved by the declared JSON profile');return value;});}

//region Fixed session-bound creator; all inputs come from the owned native JSON/prepared-member profile.
/** Bind one native consumer to source/root/file observers, fixed catalog and owned transport dependencies. */
export function createJudgmentConstructor({now,producerOwner,observer,collector,rootAdapter,rootDirectory,files,catalogText,catalogSHA256,send,isRetryableTransportFailure,trace,parsePolicy}) {
  return function construct({startedAt,signal,response,stream}) {
    let firstClockRead=true;
    const budget=createJudgmentBudget({now:()=>{if(firstClockRead){firstClockRead=false;return startedAt;}return now();},signal,isRetryableTransportFailure});
    budget.checkpoint();
    const input={producerOwner,observer,stream,response},receipt=readMainAgentRequest(input);
    // SDK-produced content is an owned plain JSON tree in this finite profile, not arbitrary JavaScript objects.
    for(const part of response.content)if(part.type==='toolCall')requireJSONInput(part.arguments);
    const parentJSON=JSON.stringify(response.content);
    if(typeof parentJSON!=='string'||Buffer.byteLength(parentJSON)>1048576)throw new JudgmentConstructionError('Native enclosing response exceeds the declared JSON profile');
    const content=JSON.parse(parentJSON);
    if(!Array.isArray(content))throw new JudgmentConstructionError('Native enclosing response has no content array');
    const declared=content.filter(value=>value&&value.type==='toolCall');
    if(declared.length===0||declared.length>64||declared.some(value=>typeof value.id!=='string'||!value.id||typeof value.name!=='string'||!value.name)||new Set(declared.map(value=>value.id)).size!==declared.length)throw new JudgmentConstructionError('Enclosing judgment requires complete unique native tool membership');
    const declaredNames=Object.freeze(declared.map(value=>Object.freeze({id:value.id,name:value.name})));
    const facade=createDependencyFacade({collector,rootAdapter,deadlineAt:budget.diagnostics().deadlineAt,rootDirectory,files,trace,now});
    const instructionBindings=new WeakMap(),instructionPairs=new WeakMap(),instructionMeaningPairs=new WeakMap(),programInstructionPairs=new WeakMap();let ruleBindings,evidenceEligibilityFailure,bindingSegmentActive=false;
    const bindings=new WeakMap(),byMember=new Map(),executions=new WeakMap(),programs=new WeakMap(),groups=new WeakMap(),slots=new WeakMap(),childGroups=[],issuedBatches=new Set(),attemptedBatches=new WeakSet();let operating=false,assessing=false,prepared=false,preparing=false,preparationFailed=false,preparationFailure,handle,selection,finished=false,closeFailed=false,finalRecord;
    function operation(run){if(operating)throw new JudgmentConstructionError('Judgment operations cannot reenter through callbacks');operating=true;try{return run();}finally{operating=false;}}
    function dependencyCheck(read){
      try{return read();}
      catch(error){evidenceEligibilityFailure??=Object.freeze({cause:error});throw error;}
    }
    function active(){if(evidenceEligibilityFailure)throw new JudgmentConstructionError('Original relation evidence lost dependency eligibility',{cause:evidenceEligibilityFailure.cause});if(closeFailed)throw new JudgmentConstructionError('Judgment finalization failed permanently',{cause:finalRecord.failure});if(preparationFailed)throw new JudgmentConstructionError('Judgment preparation failed permanently',{cause:preparationFailure});if(finished)throw new JudgmentConstructionError('Judgment evidence collection is finished');dependencyCheck(()=>{budget.checkpoint();if(!bindingSegmentActive&&readMainAgentRequest(input)!==receipt)throw new JudgmentConstructionError('Enclosing request observation changed');});}
    function ready(){active();if(!prepared)throw new JudgmentConstructionError('Complete final prepared membership is unavailable');dependencyCheck(()=>{if(!bindingSegmentActive)facade.finalize(handle);budget.checkpoint();});}
    function bindingSegment(run){
      if(bindingSegmentActive)throw new JudgmentConstructionError('Original binding segments cannot nest');
      // All external identity/phase authentication precedes this internal boundary.
      ready();
      let value,failure;bindingSegmentActive=true;
      try{value=run();}
      catch(error){failure=Object.freeze({cause:error});}
      finally{bindingSegmentActive=false;}
      // No cached freshness remains while observers and diagnostic callbacks run.
      try{trace('binding-segment.postcheck');ready();}
      catch(error){
        evidenceEligibilityFailure??=Object.freeze({cause:error});
        if(failure)throw new AggregateError([failure.cause,error],'Original binding operation and postcheck failed');
        throw error;
      }
      if(failure)throw failure.cause;
      return value;
    }
    function resolveBinding(bindingHandle){
      ready();const instruction=instructionBindings.get(bindingHandle);
      if(instruction){
        if((instruction.member!==undefined&&!bindings.has(instruction.member))||ruleBindings.read(instruction.rule)!==instruction.projection)throw new JudgmentConstructionError('Instruction claim lost its original member or source clause');
        return instruction.binding;
      }
      const value=bindings.get(bindingHandle);if(!value)throw new JudgmentConstructionError('Prepared member binding is not owned by this judgment');return value.binding;
    }
    function knownSelection(){if(!selection)throw new JudgmentConstructionError('Judgment question selection was not prepared');return selection;}
    function prepare(members){
      active();if(prepared||preparing)throw new JudgmentConstructionError('Prepared judgment membership cannot be replaced or reentered');preparing=true;
      try {
        if(!Array.isArray(members)||!Object.isFrozen(members)||members.length!==declaredNames.length)throw new JudgmentConstructionError('Prepared group differs from complete declared membership');
        for(let index=0;index<members.length;index+=1){const member=members[index],expected=declaredNames[index];if(!member||!Object.isFrozen(member)||member.id!==expected.id||member.name!==expected.name||!Object.hasOwn(member,'input')||!Object.isFrozen(member.input))throw new JudgmentConstructionError('Prepared member identity or sealed input differs from the native group');}
        for(const member of members)requireJSONInput(member.input);
        const preparedJSON=JSON.stringify(members);
        if(typeof preparedJSON!=='string'||Buffer.byteLength(preparedJSON)>1048576)throw new JudgmentConstructionError('Prepared member data exceeds the declared JSON profile');
        const dependencyHandle=facade.prepare({signal});
        active();facade.finalize(dependencyHandle);budget.checkpoint();
        const mandatoryPolicy=receipt.sources.mandatoryPolicy;
        if(!mandatoryPolicy||!Object.isFrozen(mandatoryPolicy)||typeof mandatoryPolicy.content!=='string')throw new JudgmentConstructionError('Original request lacks complete owned mandatory policy');
        const envelope=Object.freeze({parentJSON,preparedJSON,requestBody:receipt.request.body,mandatoryPolicy,instructionAuthority:'not-established'});
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
      finally{preparing=false;}
    }
    function claim({definitionId,memberId}){ready();if(definitionId==='operation_violates_rule')throw new JudgmentConstructionError('Whole-program rule relation requires claimProgramRuleCandidate');if(definitionId==='states_approval_prerequisite')throw new JudgmentConstructionError('Instruction meaning requires claimInstruction and its original clause');const bindingHandle=byMember.get(memberId);if(!bindingHandle)throw new JudgmentConstructionError('Requested member was not in the prepared native group');return selection.declare({definitionId,bindingHandle});}
    function ensureRuleBindings(){
      ready();
      if(!ruleBindings){
        if(typeof parsePolicy!=='function'||!receipt.sources.hostGoverningPolicy)throw new JudgmentConstructionError('Original host-selected policy and qualified parser are required for instruction claims');
        ruleBindings=createGoverningRuleBindings({parse:parsePolicy,readSource:()=>{ready();return receipt.sources.hostGoverningPolicy;}});
      }
      return ruleBindings;
    }
    /** Enumeration is source-owned selection only, not authority, full-source coverage or permission. */
    function indexedRuleCandidates(){return ensureRuleBindings().indexedCandidates();}
    function readRuleCandidate(rule){return ensureRuleBindings().read(rule);}
    /** Canonical whole original program/rule identity cannot be resampled through another member. */
    function claimProgramRuleCandidate({definitionId,rule}){
      if(definitionId!=='operation_violates_rule')throw new JudgmentConstructionError('Unsupported whole-program rule relation definition');
      const projection=ensureRuleBindings().read(rule);
      let bindingHandle=programInstructionPairs.get(rule);
      if(!bindingHandle){
        bindingHandle=Object.freeze({});
        const binding=Object.freeze({identity:Object.freeze({}),projection:Object.freeze({claimScope:'program-instruction',governingRule:projection})});
        instructionBindings.set(bindingHandle,{member:undefined,rule,projection,binding});
        programInstructionPairs.set(rule,bindingHandle);
      }
      return knownSelection().declare({definitionId,bindingHandle});
    }
    /** Enumerate and issue all original indexed program/rule claims under one synchronous source boundary. */
    function issueProgramRuleBatch({definitionId}){
      if(definitionId!=='operation_violates_rule')throw new JudgmentConstructionError('Unsupported whole-program rule relation definition');
      const candidates=indexedRuleCandidates();
      return bindingSegment(()=>issue(candidates.map(rule=>claimProgramRuleCandidate({definitionId,rule}))));
    }
    /** Authenticate original batch and terminal phase before any eligibility failure can be retained. */
    function captureBatchEvidence(batch){
      if(!issuedBatches.has(batch))throw new JudgmentConstructionError('Question batch is not owned by this judgment');
      knownSelection().assertCapturableBatch(batch);
      return bindingSegment(()=>knownSelection().captureBatchEvidence(batch));
    }
    function assertBatchEvidence(evidence){
      knownSelection().assertCapturedBatchIdentity(evidence);
      assertDependenciesCurrent();
    }
    function claimRuleCandidate({definitionId,memberId,rule}){
      const projection=ensureRuleBindings().read(rule);
      return claimInstruction({definitionId,memberId,ruleCode:projection.code});
    }
    function claimInstruction({definitionId,memberId,ruleCode}){
      ready();if(definitionId==='operation_violates_rule')throw new JudgmentConstructionError('Whole-program rule relation cannot be selected through a member');const member=byMember.get(memberId);
      if(!member)throw new JudgmentConstructionError('Instruction claim member is outside the original prepared group');
      ensureRuleBindings();
      const rule=ruleBindings.select(ruleCode),projection=ruleBindings.read(rule);
      const instructionOnly=definitionId==='states_approval_prerequisite';
      let pairs;
      if(instructionOnly){pairs=instructionMeaningPairs;}
      else {pairs=instructionPairs.get(member);if(!pairs){pairs=new WeakMap();instructionPairs.set(member,pairs);}}
      let bindingHandle=pairs.get(rule);
      if(!bindingHandle){
        bindingHandle=Object.freeze({});
        const memberRecord=bindings.get(member),claimProjection=instructionOnly?{claimScope:'instruction',governingRule:projection}:{...memberRecord.binding.projection,governingRule:projection};
        const binding=Object.freeze({identity:Object.freeze({}),projection:Object.freeze(claimProjection)});
        instructionBindings.set(bindingHandle,{member:instructionOnly?undefined:member,rule,projection,binding});pairs.set(rule,bindingHandle);
      }
      return selection.declare({definitionId,bindingHandle});
    }
    function captureClaimEvidence(claim){ready();return knownSelection().captureEvidence(claim);}
    function assertClaimEvidence(input){
      knownSelection().assertCapturedIdentity(input);
      assertDependenciesCurrent();
    }
    function issue(claims){ready();const batch=selection.issue(claims);issuedBatches.add(batch);return batch;}
    async function assess(batch){
      if(operating)throw new JudgmentConstructionError('Judgment operations cannot overlap or reenter');operating=true;
      try {
      if(!issuedBatches.has(batch))throw new JudgmentConstructionError('Question batch is not owned by this judgment');
      if(attemptedBatches.has(batch))throw new JudgmentConstructionError('Question batch cannot be assessed concurrently or sampled again');
      attemptedBatches.add(batch);assessing=true;
      try {
        const request=bindingSegment(()=>selection.requestFor(batch));
        const answerText=await budget.dispatch(attempt=>send(Object.freeze({request,...attempt})));
        return bindingSegment(()=>selection.settle({batch,answerText}));
      } catch(error) {
        try {if(!selection.inspectBatch(batch).settled)selection.discard({batch,error});}
        catch(retentionError){throw new AggregateError([error,retentionError],'Assessment failure and terminal retention failure');}
        throw error;
      } finally {assessing=false;}
      } finally {operating=false;}
    }
    function finalize(){
      if(finished||closeFailed)throw new JudgmentConstructionError('Judgment already has a finalization outcome');
      try {
        for(const batch of issuedBatches)if(!selection.inspectBatch(batch).settled)selection.discard({batch,error:new JudgmentConstructionError('Judgment closed before this question batch was dispatched')});
        ready();
        const batches=bindingSegment(()=>Object.freeze([...issuedBatches].map(batch=>selection.resultFor(batch))));
        const dependencies=facade.finalize(handle);active();
        const accounting=budget.finish();finished=true;
        finalRecord=Object.freeze({evidenceOnly:true,status:'evidence-closed',policyVerdict:'not-established',instructionAuthority:'not-established',humanPermission:false,dependencies,accounting,parentJSON,batches});return finalRecord;
      } catch(error) {
        closeFailed=true;
        finalRecord=Object.freeze({retainedOnly:true,status:'close-failed',failure:error,accounting:budget.diagnostics(),batches:Object.freeze([...issuedBatches].map(batch=>selection.inspectBatch(batch)))});
        throw error;
      }
    }
    /** Native release checks keep freshness separate from decision-model time and never authorize an effect. */
    function assertDependenciesCurrent(){if(evidenceEligibilityFailure)throw new JudgmentConstructionError('Original relation evidence lost dependency eligibility',{cause:evidenceEligibilityFailure.cause});if(closeFailed)throw new JudgmentConstructionError('Failed finalization cannot release dependencies');if(!prepared||preparationFailed)throw new JudgmentConstructionError('Judgment has no prepared dependency handle');return dependencyCheck(()=>{if(readMainAgentRequest(input)!==receipt)throw new JudgmentConstructionError('Enclosing request observation changed');if(!finished){active();return facade.finalize(handle);}return facade.checkRetained(handle);});}
    /** Selector returns the already-owned member handle, not proof derived from the identifier. */
    function memberFor(memberId){assertDependenciesCurrent();const member=byMember.get(memberId);if(!member)throw new JudgmentConstructionError('Execution member was not in the prepared native group');return member;}
    function knownMember(member){const record=bindings.get(member);if(!record)throw new JudgmentConstructionError('Execution member handle is not owned by this judgment');return record;}
    function knownExecution(token){const record=executions.get(token);if(!record||record.execution.token!==token)throw new JudgmentConstructionError('Execution occurrence is not owned by this judgment');return record;}
    /** Original parent is an entry dependency, not an ancestor-liveness condition on an already-active child. */
    function parentCurrent(record){
      if(record.parent!==undefined&&knownExecution(record.parent).execution.state!=='active')throw new JudgmentConstructionError('Immediate parent execution has returned before child entry');
      record.effectiveSignal?.throwIfAborted();
    }
    function knownProgram(program){const record=programs.get(program);if(!record||record.program.handle!==program)throw new JudgmentConstructionError('Program handle is not owned by this judgment');return record;}
    function currentProgram(program){
      const record=knownProgram(program),scope=record.program;
      if(scope.guardFailure)throw scope.guardFailure;
      if(scope.status==='failed')throw new JudgmentConstructionError('Program declaration failed permanently',{cause:scope.failure});
      if(record.execution?.state!=='active')throw new JudgmentConstructionError('Program parent execution has returned');
      assertDependenciesCurrent();record.execution.origin.signal.throwIfAborted();return record;
    }
    function openProgram({parentToken,toolNames}){
      const record=knownExecution(parentToken);
      if(record.execution.state!=='active')throw new JudgmentConstructionError('Program parent execution has returned');
      assertDependenciesCurrent();record.execution.origin.signal.throwIfAborted();
      if(record.program)throw new JudgmentConstructionError('Parent execution already reserved its program declaration');
      const program=Object.freeze({}),scope={handle:program,status:'opening',declaration:undefined,view:undefined,groups:[],valueReceipt:undefined,guardFailure:undefined,guardFailures:[],seenGuards:new WeakSet()};
      record.program=scope;programs.set(program,record);
      try{
        const declaration=declareResultProgram({source:record.prepared.input.code,toolNames});
        currentProgram(program);
        scope.groups=declaration.groups.map(definition=>{
          const group={handle:Object.freeze({}),program,definition,state:'unreached',view:undefined,slots:[],members:undefined,consumer:undefined};groups.set(group.handle,group);return group;
        });
        scope.declaration=declaration;scope.view=Object.freeze({declaration,parent:parentToken,judgment,response,stream,permission:'not-established'});scope.status='open';return program;
      }catch(error){scope.status='failed';scope.failure=error;throw error;}
    }
    function programFor(program){return currentProgram(program).program.view;}
    function knownGroup(handle){const group=groups.get(handle);if(!group)throw new JudgmentConstructionError('Reached group handle is not owned by this judgment');return group;}
    function currentGroup(handle){const group=knownGroup(handle);currentProgram(group.program);if(group.state==='failed')throw new JudgmentConstructionError('Reached group failed permanently',{cause:group.failure});return group;}
    function knownSlot({group,slot}){const record=slots.get(slot);if(!record||record.group!==group)throw new JudgmentConstructionError('Native slot is not owned by this reached group');return record;}
    function reachProgramGroup({program,ordinal}){
      const parent=currentProgram(program),scope=parent.program,group=scope.groups[ordinal];
      if(!Number.isSafeInteger(ordinal)||!group)throw new JudgmentConstructionError('Program group ordinal is outside original source');
      if(group.state==='failed')throw new JudgmentConstructionError('Reached group failed permanently',{cause:group.failure});
      if(group.state!=='unreached')return group.view;
      const result=ordinal===0?undefined:scope.valueReceipt?.value;
      if(ordinal>0&&!scope.valueReceipt)throw new JudgmentConstructionError('Successor group requires the owned producer script value');
      const members=Object.freeze(group.definition.members.map(site=>{
        const args=materializePattern({pattern:site.pattern,result});requireJSONInput(args);
        return Object.freeze({...site,args,argsJSON:JSON.stringify(args)});
      }));
      if(Buffer.byteLength(JSON.stringify(members.map(member=>member.args)))>1048576)throw new JudgmentConstructionError('Reached group argument data exceeds one MiB');
      currentProgram(program);group.view=Object.freeze({handle:group.handle,ordinal,declaration:scope.declaration,members});group.state='reached';return group.view;
    }
    function reachedGroupFor(group){return currentGroup(group).view;}
    function bindProgramCalls({group:handle,calls,tools,runNative}){
      const group=currentGroup(handle);
      if(group.state!=='reached')throw new JudgmentConstructionError('Reached group native calls cannot be rebound');
      group.state='binding';
      try{
        const expected=group.view.members;
        if(!Array.isArray(calls)||calls.length!==expected.length||!Array.isArray(tools)||tools.length!==expected.length||typeof runNative!=='function')throw new JudgmentConstructionError('Native calls differ from complete reached group');
        const ids=new Set(),pending=[];
        for(const [index,call] of calls.entries()){
          const site=expected[index],tool=tools[index];
          if(!call||call.type!=='toolCall'||typeof call.id!=='string'||!call.id||ids.has(call.id)||call.name!==site.name||tool?.name!==site.name||JSON.stringify(call.arguments)!==site.argsJSON)throw new JudgmentConstructionError('Native call binding differs from original reached member');
          ids.add(call.id);
          pending.push({handle:Object.freeze({}),group,ordinal:index,call:Object.freeze({id:call.id,name:call.name}),tool:Object.freeze({name:tool.name,outputSchema:tool.outputSchema?true:undefined}),member:undefined,native:undefined});
        }
        currentGroup(handle);for(const slot of pending)slots.set(slot.handle,slot);group.slots=pending;
        group.consumer=createNativeReturnConsumer({runNative,getSlot:slot=>knownSlot({group,slot}),assertCurrent:()=>operation(()=>{currentGroup(handle);}),assertReturnedMember:member=>{
          const record=knownMember(member);if(record.group!==group||record.execution?.state!=='returned')throw new JudgmentConstructionError('Script binding producer is not the returned prepared member');
        }});
        group.state='bound';return Object.freeze(pending.map(slot=>slot.handle));
      }catch(error){group.state='failed';group.failure=error;throw error;}
    }
    function prepareReachedMembers({group:handle,members,nativeSignals}){
      const group=currentGroup(handle),parent=knownProgram(group.program),scope=parent.program;
      if(group.state!=='bound')throw new JudgmentConstructionError('Reached group cannot be prepared again');
      group.state='preparing';
      try{
        const declared=group.view.members;
        if(!Array.isArray(members)||!Object.isFrozen(members)||members.length!==declared.length||!Array.isArray(nativeSignals)||nativeSignals.length!==declared.length)throw new JudgmentConstructionError('Final child group differs from complete reached declaration');
        const pending=[];
        for(const [index,member] of members.entries()){
          const expected=declared[index],slot=group.slots[index],nativeSignal=nativeSignals[index];
          if(!member||!Object.isFrozen(member)||member.id!==slot.call.id||member.name!==expected.name||!Object.isFrozen(member.input))throw new JudgmentConstructionError('Final child identity differs from bound native call');
          requireJSONInput(member.input);
          if(JSON.stringify(member.input)!==expected.argsJSON)throw new JudgmentConstructionError('Final prepared child input is outside its original result binding');
          if(!(nativeSignal instanceof AbortSignal))throw new JudgmentConstructionError('Child native cancellation is unavailable');
          const effectiveSignal=AbortSignal.any([signal,parent.execution.origin.signal,nativeSignal]);effectiveSignal.throwIfAborted();
          pending.push({prepared:member,parent:scope.view.parent,effectiveSignal,execution:undefined,program:undefined,group});
        }
        if(Buffer.byteLength(JSON.stringify(members))>1048576)throw new JudgmentConstructionError('Final reached group exceeds one MiB');
        currentGroup(handle);
        const handles=Object.freeze(pending.map((record,index)=>{const member=Object.freeze({});bindings.set(member,record);group.slots[index].member=member;return member;}));
        group.members=handles;group.state='prepared';childGroups.push(group);return handles;
      }catch(error){group.state='failed';group.failure=error;throw error;}
    }
    // Native callbacks may prepare the group while this async invocation is in flight.
    async function invokeProgramNative({group:handle,slot,call,options}){
      const group=knownGroup(handle);if(!group.consumer)throw new JudgmentConstructionError('Reached group has no fixed native consumer');
      return await group.consumer.invoke({slot,call,options});
    }
    function markProgramGuard({program,error}){
      const scope=knownProgram(program).program,guard=scriptValueGuard({error});
      if(!scope.seenGuards.has(guard)){scope.seenGuards.add(guard);scope.guardFailures.push(guard);}
      scope.guardFailure??=guard;return guard;
    }
    function scriptValueFor({group:handle,slot:slotHandle,outcome}){
      let group;
      try{group=knownGroup(handle);if(!group.consumer)throw new JudgmentConstructionError('Reached group has no fixed native consumer');}
      catch(error){throw scriptValueGuard({error});}
      let value;
      try{value=group.consumer.valueFor({slot:slotHandle,outcome});}
      catch(error){if(error instanceof NativeScriptValueGuardError)throw operation(()=>markProgramGuard({program:group.program,error}));throw error;}
      try{return operation(()=>{
        currentGroup(handle);const slot=knownSlot({group,slot:slotHandle}),scope=knownProgram(group.program).program;
        if(group.definition.ordinal===0){
          if(scope.valueReceipt&&(scope.valueReceipt.slot!==slotHandle||scope.valueReceipt.native!==slot.native.identity))throw new JudgmentConstructionError('Producer script-value receipt cannot be replaced');
          scope.valueReceipt??=Object.freeze({slot:slotHandle,member:slot.member,native:slot.native.identity,value});
        }
        return value;
      });}catch(error){throw operation(()=>markProgramGuard({program:group.program,error}));}
    }
    function inspectReachedGroup(handle){const group=knownGroup(handle);return Object.freeze({retainedOnly:true,ordinal:group.definition.ordinal,state:group.state,failure:group.failure,members:Object.freeze((group.members??[]).map(member=>{const record=bindings.get(member);return Object.freeze({id:record.prepared.id,state:record.execution?.state??'unentered'});})),nativeReturns:Object.freeze(group.slots.map(slot=>group.consumer.inspect(slot.handle)))});}
    function inspectProgram(program){const scope=knownProgram(program).program;return Object.freeze({retainedOnly:true,status:scope.status,failure:scope.failure,producerValueReady:scope.valueReceipt!==undefined,guardFailures:Object.freeze([...scope.guardFailures]),groups:Object.freeze(scope.groups.map(group=>inspectReachedGroup(group.handle)))});}
    function preparedMemberFor(member){const record=knownMember(member);assertDependenciesCurrent();parentCurrent(record);return Object.freeze({prepared:record.prepared,signal:record.effectiveSignal});}
    function originalFileFor(member){
      ready();const record=knownMember(member);parentCurrent(record);
      return facade.originalFile({handle,absolutePath:record.prepared.input.path});
    }
    function assertExecutionEntry(token){const record=knownExecution(token);if(record.execution.state!=='active')throw new JudgmentConstructionError('Execution occurrence has returned before native entry');assertDependenciesCurrent();parentCurrent(record);}
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
    function memberExecutionStates(){return Object.freeze([...byMember.entries()].map(([id,handle])=>Object.freeze({id,state:bindings.get(handle).execution?.state??'unentered'})));}
    function inspect(){return Object.freeze({prepared,preparationFailed,preparationFailure,finished,closeFailed,accounting:budget.diagnostics(),finalRecord,memberExecutions:memberExecutionStates(),rootPrograms:Object.freeze([...byMember.values()].flatMap(member=>{const record=bindings.get(member);return record.program?[inspectProgram(record.program.handle)]:[];})),childGroups:Object.freeze(childGroups.map(group=>inspectReachedGroup(group.handle)))});}
    budget.checkpoint();const judgment=Object.freeze({openProgram:input=>operation(()=>openProgram(input)),programFor:program=>operation(()=>programFor(program)),reachProgramGroup:input=>operation(()=>reachProgramGroup(input)),reachedGroupFor:group=>operation(()=>reachedGroupFor(group)),bindProgramCalls:input=>operation(()=>bindProgramCalls(input)),prepareReachedMembers:input=>operation(()=>prepareReachedMembers(input)),invokeProgramNative,scriptValueFor,markProgramGuard:input=>operation(()=>markProgramGuard(input)),inspectReachedGroup,originalFileFor:member=>operation(()=>originalFileFor(member)),preparedMemberFor:member=>operation(()=>preparedMemberFor(member)),assertExecutionEntry:token=>operation(()=>assertExecutionEntry(token)),inspectProgram,memberFor:memberId=>operation(()=>memberFor(memberId)),beginExecution:member=>operation(()=>beginExecution(member)),executionFor:token=>operation(()=>executionFor(token)),finishExecution:token=>operation(()=>finishExecution(token)),inspectExecution,checkpoint:()=>operation(active),prepare:members=>operation(()=>prepare(members)),claim:input=>operation(()=>claim(input)),claimInstruction:input=>operation(()=>claimInstruction(input)),captureClaimEvidence:claim=>operation(()=>captureClaimEvidence(claim)),assertClaimEvidence:input=>operation(()=>assertClaimEvidence(input)),indexedRuleCandidates:()=>operation(indexedRuleCandidates),readRuleCandidate:rule=>operation(()=>readRuleCandidate(rule)),claimRuleCandidate:input=>operation(()=>claimRuleCandidate(input)),claimProgramRuleCandidate:input=>operation(()=>claimProgramRuleCandidate(input)),issueProgramRuleBatch:input=>operation(()=>issueProgramRuleBatch(input)),captureBatchEvidence:batch=>operation(()=>captureBatchEvidence(batch)),assertBatchEvidence:evidence=>operation(()=>assertBatchEvidence(evidence)),issue:claims=>operation(()=>issue(claims)),assess,finalize:()=>operation(finalize),assertDependenciesCurrent:()=>operation(assertDependenciesCurrent),inspect,inspectBatch:batch=>knownSelection().inspectBatch(batch),inspectClaim:claim=>knownSelection().inspectClaim(claim)});return judgment;
  };
}
//endregion
