/** Review complete groups between original native preparation and execution phases. @module */
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {sealPreparedInput} from './prepared-input-seal.ts';
import {schedulePreparedCalls} from './prepared-schedule.ts';
import {completePreparedBatch} from './prepared-completion.ts';
import {executeWithOwnedContext,NativeExecutionGuardError} from '../../../lifecycle/execution-context-carrier/execute.mjs';

//region Native phase results and retained failures share complete-group completion.
/** Preparation contracts fail before releasing any executable. */
export class PreparedBatchContractError extends Error {}
/** Native cleanup and callback failures retain every issued member outcome. */
export class PreparedBatchExecutionError extends Error {
  constructor(message,{failures,outcomes,assessmentDecision}){
    super(message,{cause:new AggregateError(failures)});
    this.diagnosticRecord={outcomes,assessmentDecision};
  }
}

/** Prepare members once, review actual arguments, and run those same native preparations. */
export async function dispatchPreparedBatch({
  calls,tools,nativePhases,prepare,after,onUpdate,onStart,onFinish,assess,assertFresh,signal,
  executionJudgment,executionMode='parallel'
}){
  /** Diagnostics never inspect native argument or result payloads. */
  const l=tagged({tag:dispatchPreparedBatch.name,l:tagged({tag:'auto-mode-native-phases'})});
  l.debug('preparing complete native group');
  if(typeof nativePhases?.prepare!=='function'||typeof nativePhases.run!=='function'){
    throw new PreparedBatchContractError('Original native preparation and execution phases are unavailable');
  }
  /** Membership and scheduling admission precedes native callbacks. */
  const {scheduled,serial}=schedulePreparedCalls({calls,tools,executionJudgment,executionMode,PreparedBatchContractError});
  /** Records retain actual preparations rather than tools suspended inside before hooks. */
  const records=[];
  /** Lifecycle failures remain independent of native error-valued outcomes. */
  const failures=[];
  /** Only complete successful preparation produces an assessment snapshot. */
  const snapshots=[];
  /** The first blocking result remains terminal. */
  const state={decision:undefined,executionGuardFailed:false};

  /** Cancellation and original operation freshness are checked at effect boundaries. */
  function active(stage){signal.throwIfAborted();assertFresh({stage});}
  /** Unexecuted preparation does not invoke the native after hook. */
  function withheld(call){return {toolCall:call,result:{content:[{type:'text',text:state.decision.reason}],details:{}},isError:true};}
  /** Record outcomes before foreign completion callbacks can throw. */
  async function publish({record,outcome}){
    record.outcome=outcome;
    await onFinish?.(outcome);
    return outcome;
  }
  /** Prepared peers cannot execute after an immediate native failure. */
  async function finishWithheld(){
    for(const record of records){
      if(record.outcome!==undefined||record.failure!==undefined)continue;
      try{await publish({record,outcome:withheld(record.call)});}
      catch(error){record.failure={error};failures.push(error);}
    }
  }
  /** Seal actual arguments and an independent review presentation. */
  function manifest({call,prepared}){
    sealPreparedInput({input:prepared.args,PreparedBatchContractError});
    return Object.freeze({groupExecutionMode:serial?'sequential':'parallel',id:call.id,name:call.name,
      input:sealPreparedInput({input:structuredClone(prepared.args),PreparedBatchContractError})});
  }
  /** Native execution owns conversion, awaited updates, and the after hook. */
  async function run(record){
    if(record.failure!==undefined)throw record.failure.error;
    if(record.outcome!==undefined)return record.outcome;
    if(state.decision.block)return await publish({record,outcome:withheld(record.call)});
    /** Original selected definitions remain intact during preparation. */
    const original=record.prepared.tool;
    /** Adapt context carriage without replacing original native phase bodies. */
    async function execute(...args){
      try{
        active('member-execute');
        if(state.executionGuardFailed)throw new PreparedBatchContractError('An execution context guard failed; remaining group members cannot start');
      }catch(error){failures.push(error);throw error;}
      try{return await executeWithOwnedContext({judgment:executionJudgment,tool:original,args});}
      catch(error){
        if(error instanceof NativeExecutionGuardError){state.executionGuardFailed=true;failures.push(error);}
        throw error;
      }
    }
    /** Preserve actual native call association for partial updates. */
    function update(partial){return onUpdate?.(partial,record.call);}
    return await publish({record,outcome:await nativePhases.run({prepared:record.prepared,execute,onUpdate:update,after})});
  }

  for(const call of scheduled){
    /** Preparation and completion share a record, including callback failures. */
    const record={call,prepared:undefined,member:undefined,outcome:undefined,failure:undefined};
    try{
      await onStart?.(call);
      /** Hook blocking differs from validation failure before hook entry. */
      const hookState={blocked:false};
      /** Native argument preparation precedes the original callback exactly once. */
      async function before(hook){
        active('prepare-entry');
        const result=await prepare(hook);
        hookState.blocked=Boolean(result?.block);
        if(hookState.blocked){
          state.decision??=Object.freeze({block:true,reason:result.reason||'A member preparation blocked this complete group'});
          await finishWithheld();
        }else if(state.decision?.block){
          await finishWithheld();
          return state.decision;
        }
        return result;
      }
      const prepared=await nativePhases.prepare({call,before});
      record.prepared=prepared;
      if(prepared.kind==='immediate'){
        state.decision??=Object.freeze({block:true,reason:hookState.blocked
          ?prepared.result.content?.[0]?.text||'A member preparation blocked this complete group'
          :'A member failed native preparation before group admission'});
        await publish({record,outcome:{toolCall:call,result:prepared.result,isError:prepared.isError}});
        records.push(record);
      }else{
        if(prepared.kind!=='prepared')throw new PreparedBatchContractError('Original native preparation returned no prepared member');
        record.member=manifest({call,prepared});
        records.push(record);
      }
    }catch(error){
      l.debug('native preparation or callback failed; withholding complete group');
      l.debug(error);
      record.failure={error};failures.push(error);
      state.decision??=Object.freeze({block:true,reason:'Complete group preparation or assessment failed'});
      if(!records.includes(record))records.push(record);
    }
  }
  if(state.decision!==undefined)await finishWithheld();
  if(state.decision===undefined){
    try{
      active('input-prepared');
      const members=Object.freeze(records.map(record=>record.member));
      snapshots.push(members);
      const decision=await assess({members,signal});
      active('assessment-returned');
      if(!decision||typeof decision.block!=='boolean'
        ||(decision.block&&(typeof decision.reason!=='string'||!decision.reason))){
        throw new PreparedBatchContractError('Combined assessment returned an invalid decision');
      }
      state.decision=Object.freeze(decision.block?{block:true,reason:decision.reason}:{block:false});
    }catch(error){
      l.debug('complete native group review failed');l.debug(error);
      failures.push(error);
      state.decision=Object.freeze({block:true,reason:'Complete group preparation or assessment failed'});
    }
  }
  /** Sequential execution needs no deferred member-turn protocol. */
  const settled=[];
  if(serial){
    for(const record of records){
      try{settled.push({status:'fulfilled',value:await run(record)});}
      catch(reason){settled.push({status:'rejected',reason});}
    }
  }else settled.push(...await Promise.allSettled(records.map(run)));
  l.debug('all issued native members settled');
  return completePreparedBatch({batchState:state,failures,settled,snapshots,PreparedBatchContractError,PreparedBatchExecutionError});
}
//endregion
