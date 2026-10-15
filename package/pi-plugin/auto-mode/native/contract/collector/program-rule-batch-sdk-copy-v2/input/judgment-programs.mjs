import {assertDeclaredProgram} from "./program-profile.mjs";
import {materializePattern} from "./result-pattern.mjs";
import {createNativeReturnConsumer} from "../../../integration/native-batch/generated/native-return-consumer.mjs";
import {NativeScriptValueGuardError,scriptValueGuard} from "./script-value-guard.ts";
import {JudgmentConstructionError, requireJSONInput} from './judgment-input.mjs';

//region Program declarations and reached groups retain one original judgment owner

/** Own program, group and native-result identities within the original judgment. */
export function createJudgmentPrograms({
  readJudgment,
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
}) {
  const programs=new WeakMap(),groups=new WeakMap(),slots=new WeakMap();
  function knownProgram(program){const record=programs.get(program);if(!record||record.program.handle!==program)throw new JudgmentConstructionError('Program handle is not owned by this judgment');return record;}
    function currentProgram(program){
      const record=knownProgram(program),scope=record.program;
      if(scope.guardFailure)throw scope.guardFailure;
      if(scope.status==='failed')throw new JudgmentConstructionError('Program declaration failed permanently',{cause:scope.failure});
      if(record.execution?.state!=='active')throw new JudgmentConstructionError('Program parent execution has returned');
      assertDependenciesCurrent();record.execution.origin.signal.throwIfAborted();return record;
    }
    function bindPreparedProgram({member,declaration,assertCurrent}){
      const record=knownMember(member);
      if(record.parent!==undefined||record.execution)throw new JudgmentConstructionError('Prepared program inspection requires an unentered original root member');
      if(record.preparedProgram)throw new JudgmentConstructionError('Original prepared program inspection is already bound');
      if(typeof assertCurrent!=='function')throw new JudgmentConstructionError('Prepared program requires its original tool-dependency reader');
      assertDeclaredProgram(declaration);
      if(declaration.source!==record.prepared.input.code)throw new JudgmentConstructionError('Inspected program differs from the original prepared source');
      ready();dependencyCheck(assertCurrent);ready();
      const view=Object.freeze({kind:'original-prepared-program-inspection',member,prepared:record.prepared,declaration,permission:false});
      record.preparedProgram={view,assertCurrent};return view;
    }
    function preparedProgramFor(member){
      const record=knownMember(member);assertDependenciesCurrent();parentCurrent(record);
      return record.preparedProgram?.view;
    }
    function openProgram({parentToken,toolNames}){
      const record=knownExecution(parentToken);
      if(record.execution.state!=='active')throw new JudgmentConstructionError('Program parent execution has returned');
      assertDependenciesCurrent();record.execution.origin.signal.throwIfAborted();
      if(record.program)throw new JudgmentConstructionError('Parent execution already reserved its program declaration');
      const program=Object.freeze({}),scope={handle:program,status:'opening',declaration:undefined,view:undefined,groups:[],valueReceipt:undefined,guardFailure:undefined,guardFailures:[],seenGuards:new WeakSet()};
      record.program=scope;programs.set(program,record);
      try{
        const declaration=record.preparedProgram?.view.declaration;
        if(!declaration)throw new JudgmentConstructionError('Native program requires its original declaration captured before policy review');
        if(!Array.isArray(toolNames)||declaration.sites.some(function isUnknownToolSite(site) { return (!toolNames.includes(site.name)); }))throw new JudgmentConstructionError('Runtime callables differ from the original prepared program');
        currentProgram(program);
        scope.groups=declaration.groups.map(function createUnreachedGroup(definition) {
          const group={handle:Object.freeze({}),program,definition,state:'unreached',view:undefined,slots:[],members:undefined,consumer:undefined};groups.set(group.handle,group);return group;
        });
        scope.declaration=declaration;scope.view=Object.freeze({declaration,parent:parentToken,judgment:readJudgment(),response,stream,permission:'not-established'});scope.status='open';return program;
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
      const members=Object.freeze(group.definition.members.map(function materializeGroupMember(site) {
        const args=materializePattern({pattern:site.pattern,result});requireJSONInput(args);
        return Object.freeze({...site,args,argsJSON:JSON.stringify(args)});
      }));
      if(Buffer.byteLength(JSON.stringify(members.map(function readMemberArguments(member) { return (member.args); })))>1048576)throw new JudgmentConstructionError('Reached group argument data exceeds one MiB');
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
        group.consumer=createNativeReturnConsumer({runNative,getSlot:function readOwnedSlot(slot) { return (knownSlot({group,slot})); },assertCurrent:function assertOriginalGroup() { return (operation(function checkCurrentGroup() {currentGroup(handle);})); },assertReturnedMember:function readReturnedMember(member) {
          const record=knownMember(member);if(record.group!==group||record.execution?.state!=='returned')throw new JudgmentConstructionError('Script binding producer is not the returned prepared member');
        }});
        group.state='bound';return Object.freeze(pending.map(function readSlotHandle(slot) { return (slot.handle); }));
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
        const handles=Object.freeze(pending.map(function publishReachedMember(record,index) {const member=Object.freeze({});bindings.set(member,record);group.slots[index].member=member;return member;}));
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
      catch(error){if(error instanceof NativeScriptValueGuardError)throw operation(function markInvocationFailure() { return (markProgramGuard({program:group.program,error})); });throw error;}
      try{return operation(function readGuardedScriptValue() {
        currentGroup(handle);const slot=knownSlot({group,slot:slotHandle}),scope=knownProgram(group.program).program;
        if(group.definition.ordinal===0){
          if(scope.valueReceipt&&(scope.valueReceipt.slot!==slotHandle||scope.valueReceipt.native!==slot.native.identity))throw new JudgmentConstructionError('Producer script-value receipt cannot be replaced');
          scope.valueReceipt??=Object.freeze({slot:slotHandle,member:slot.member,native:slot.native.identity,value});
        }
        return value;
      });}catch(error){throw operation(function markConversionFailure() { return (markProgramGuard({program:group.program,error})); });}
    }
    function inspectReachedGroup(handle){const group=knownGroup(handle);return Object.freeze({retainedOnly:true,ordinal:group.definition.ordinal,state:group.state,failure:group.failure,members:Object.freeze((group.members??[]).map(function inspectMemberExecution(member) {const record=bindings.get(member);return Object.freeze({id:record.prepared.id,state:record.execution?.state??'unentered'});})),nativeReturns:Object.freeze(group.slots.map(function inspectConsumedSlot(slot) { return (group.consumer.inspect(slot.handle)); }))});}
    function inspectProgram(program){const scope=knownProgram(program).program;return Object.freeze({retainedOnly:true,status:scope.status,failure:scope.failure,declaration:scope.declaration,producerValueReady:scope.valueReceipt!==undefined,guardFailures:Object.freeze([...scope.guardFailures]),groups:Object.freeze(scope.groups.map(function inspectOwnedGroup(group) { return (inspectReachedGroup(group.handle)); }))});}
  return Object.freeze({
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
  });
}

//endregion Program declarations and reached groups retain one original judgment owner
