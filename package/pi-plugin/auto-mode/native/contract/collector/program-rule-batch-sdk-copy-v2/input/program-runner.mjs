import {createReachedProgramRun} from "./program-runtime.mjs";
import {NativeExecutionGuardError} from "../../../lifecycle/execution-context-carrier/execute.mjs";

/** Reuse native scope, queue and recorder objects across reached groups of one program. */
export function createReachedRunnerClass({NestedToolCallRunner,NestedCallRecorder,dispatchPreparedBatch}){
  return class ReachedProgramNestedRunner extends NestedToolCallRunner{
    createDeclaredProgram({origin,carrier,code,assertParentCurrent}){
      assertParentCurrent();if(code!==origin.prepared.input.code)throw new Error('Declared program differs from original prepared input');
      const judgment=origin.judgment,toolNames=this.host.getTools().map(tool=>tool.name),program=judgment.openProgram({parentToken:carrier.token,toolNames}),nativeGroups=new Map(),works=[],failures=[];
      const run=createReachedProgramRun({judgment,program,signal:origin.signal,assertParentCurrent,
        dispatchGroup:group=>{
          const bound=this.#bindGroup({origin,carrier,group,assertParentCurrent});nativeGroups.set(group.handle,bound);
          async function settle(owner){
            try{await owner.#executeGroup({origin,program,group,bound,assertParentCurrent});}
            catch(error){failures.push(error);for(const ticket of bound.tickets)ticket.reject(error);}
          }
          works.push(settle(this));return bound.tickets.map(ticket=>ticket.promise);
        },
        scriptValueFor:({group,ordinal,outcome})=>{
          const bound=nativeGroups.get(group);if(!bound)throw new Error('Native group has no owned result slots');
          return judgment.scriptValueFor({group,slot:bound.slots[ordinal],outcome});
        }});
      return Object.freeze({...run,async drain(){
        const drained=await Promise.allSettled([run.drain(),...works]);
        const errors=[...failures,...drained.filter(value=>value.status==='rejected').map(value=>value.reason)];
        if(errors.length)throw new NativeExecutionGuardError({errors,phase:'validation',toolCallId:origin.prepared.id,toolName:origin.prepared.name});
      }});
    }
    #bindGroup({origin,carrier,group,assertParentCurrent}){
      assertParentCurrent();const parentId=origin.prepared.id;
      let scope=this.scopes.get(carrier.token);
      if(!scope){if(this.scopes.has(parentId))throw new Error('Native root recorder label already belongs to another scope');scope={recorder:new NestedCallRecorder(),nextId:1,holdsQueue:false,owner:carrier.token};this.scopes.set(carrier.token,scope);this.scopes.set(parentId,scope);}
      const calls=group.members.map(member=>({type:'toolCall',id:parentId+'/'+scope.nextId++,name:member.declaration.name,arguments:member.declaration.args})),ordinals=new Map(calls.map((call,index)=>[call.id,index])),tools=this.host.getTools(),nativeRun=this.host.runOwnedToolCall;
      const slots=origin.judgment.bindProgramCalls({group:group.handle,calls,tools:calls.map(call=>tools.find(tool=>tool.name===call.name)),runNative:(call,options)=>nativeRun(call,{...options,signal:group.members[ordinals.get(call.id)].signal})});
      return {scope,calls,ordinals,tools,slots,tickets:calls.map(()=>Promise.withResolvers())};
    }
    async #executeGroup({origin,group,bound,assertParentCurrent}){
      const {scope,calls,ordinals,tools,slots,tickets}=bound,parentId=origin.prepared.id,judgment=origin.judgment,records=new Map();
      const exclusive=!scope.holdsQueue&&(this.host.isSequential()||calls.some(call=>tools.find(tool=>tool.name===call.name)?.executionMode==='sequential'));
      let release,handles;if(exclusive){const previous=this.queueTail,turn=Promise.withResolvers();this.queueTail=turn.promise;release=turn.resolve;await previous;}
      try{
        assertParentCurrent();origin.signal.throwIfAborted();
        await dispatchPreparedBatch({
          calls,tools,assistantMessage:origin.response,context:this.host.getContext(),signal:origin.signal,executionJudgment:judgment,executionMode:exclusive?'sequential':'parallel',
          memberForExecution:id=>{const member=handles?.[ordinals.get(id)];if(!member)throw new Error('Prepared child has no owned execution handle');return member;},
          runToolCall:(call,options)=>judgment.invokeProgramNative({group:group.handle,slot:slots[ordinals.get(call.id)],call,options}),
          prepare:hook=>this.host.prepareOwnedToolCall(hook,parentId),after:hook=>this.host.finishOwnedToolCall(hook,parentId),
          assertFresh(){assertParentCurrent();judgment.reachedGroupFor(group.handle);},
          assess:({members})=>{handles=judgment.prepareReachedMembers({group:group.handle,members,nativeSignals:group.members.map(member=>member.signal)});return {block:false};},
          onStart:async call=>{records.set(call.id,scope.recorder.start(call));await this.host.emit({type:'tool_execution_start',toolCallId:call.id,toolName:call.name,args:call.arguments,parentToolCallId:parentId});},
          onUpdate:async(partialResult,call)=>{await this.host.emit({type:'tool_execution_update',toolCallId:call.id,toolName:call.name,args:call.arguments,partialResult,parentToolCallId:parentId});},
          onFinish:async outcome=>{
            const call=outcome.toolCall,text=(outcome.result.content??[]).filter(part=>part.type==='text').map(part=>part.text).join('\n');scope.recorder.finish(records.get(call.id),outcome.isError,text);if(outcome.result.usage)scope.recorder.addUsage(outcome.result.usage);
            await this.host.emit({type:'tool_execution_end',toolCallId:call.id,toolName:call.name,result:outcome.result,isError:outcome.isError,parentToolCallId:parentId});tickets[ordinals.get(call.id)].resolve(outcome);
          }
        });
      }finally{release?.();}
    }
    takeRecord(toolCallId){const scope=this.scopes.get(toolCallId),result=super.takeRecord(toolCallId);if(scope?.owner)this.scopes.delete(scope.owner);return result;}
  };
}
