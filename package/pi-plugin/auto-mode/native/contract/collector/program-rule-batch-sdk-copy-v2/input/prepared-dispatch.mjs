import { sealPreparedInput } from './prepared-input-seal.ts';
import { schedulePreparedCalls } from './prepared-schedule.ts';

export class PreparedBatchContractError extends Error {}
export class PreparedBatchExecutionError extends Error {
  constructor(
    message,
    {
      failures,
      outcomes,
      assessmentDecision
    }
  ) {
    super(
      message,
      {cause:new AggregateError(failures)}
    );
    this.diagnosticRecord={
      outcomes,
      assessmentDecision
    };
  }
}


import {
  executeWithOwnedContext,
  NativeExecutionGuardError
} from "../../../lifecycle/execution-context-carrier/execute.mjs";
//region Private prepared-group dispatcher; all executable members wait for one combined judgment.



/** {@inheritDoc sealPreparedInput} */
function sealInput(input) {
  return sealPreparedInput({ input, PreparedBatchContractError });
}

/** Caller owns the complete explicit group and actual SDK runToolCall function. */
export async function dispatchPreparedBatch({
  calls,
  tools,
  assistantMessage,
  context,
  runToolCall,
  prepare,
  after,
  onUpdate,
  onStart,
  onFinish,
  assess,
  assertFresh,
  signal,
  executionJudgment,
  executionMode='parallel'
}) {
  const { scheduled, serial } = schedulePreparedCalls({ calls, tools, executionJudgment, executionMode, PreparedBatchContractError });
  const turns=scheduled.map(function createExecutionTurn() { return (Promise.withResolvers()); });
  const preparationTurns=scheduled.map(function createPreparationTurn() { return (Promise.withResolvers()); });
  turns[0]
    .resolve();
  preparationTurns[0]
    .resolve();
  const ordinalByID=new Map(scheduled.map(function indexNativeCall(call,
    index) { return ([
    call.id,
    index
  ]); }));
  const gate=Promise.withResolvers();
  const ready=new Map();
    const failures=[];
    const snapshots=[];
  const batchState={assessmentStarted:false,decision:undefined,executionGuardFailed:false};
    
    
  function block(reason){
    if(batchState.decision===undefined){batchState.decision=Object.freeze({
      block:true,
      reason
    });gate.resolve(batchState.decision);}
  }
  function active(stage){if(signal.aborted)throw new PreparedBatchContractError(
    'Prepared group cancelled',
    {cause:signal.reason}
  );assertFresh({stage});}
  const executableTools=tools.map(function wrapOwnedTool(original) { return (({
    ...original,
    async execute(toolCallId,params,nativeSignal,nativeOnUpdate){
    const args=[toolCallId,params,nativeSignal,nativeOnUpdate];
    const ordinal=ordinalByID.get(args[0]);
    if(ordinal===undefined)throw new PreparedBatchContractError('Execution has no declared member ordinal');
    if(serial)await turns[ordinal]
      .promise;
    try{active('member-execute');}catch(error){failures.push(error);throw error;}
    if(batchState.executionGuardFailed){const error=new PreparedBatchContractError('An execution context guard failed; remaining group members cannot start');failures.push(error);throw error;}
    try{return await executeWithOwnedContext({
      judgment:executionJudgment,
      tool:original,
      args
    });}
    catch(error){if(error instanceof NativeExecutionGuardError){batchState.executionGuardFailed=true;failures.push(error);}throw error;}
  }
  })); });
  function onAbort() {  block('Prepared group cancelled before execution'); }
  signal.addEventListener(
    'abort',
    onAbort,
    {once:true}
  );
  if(signal.aborted)onAbort();
  async function runMember(call){
    const memberState={entered:false,preparationReleased:false};
    
    const ordinal=ordinalByID.get(call.id);
    if(ordinal===undefined)throw new PreparedBatchContractError('Preparation has no declared member ordinal');
    function releasePreparation(){
      if(memberState.preparationReleased)return;
      memberState.preparationReleased=true;
      preparationTurns[ordinal+1]
        ?.resolve();
    }
    using memberTurn={ [Symbol.dispose]() {releasePreparation();turns[ordinal+1]
      ?.resolve();} };
    try{
      await preparationTurns[ordinal]
        .promise;
      await onStart?.(call);
      const result=await runToolCall(
        call,
        {
          tools:executableTools,
          assistantMessage,
          context,
          signal,
          afterToolCall:after,
          onUpdate:onUpdate===undefined?undefined:function forwardPartialUpdate(partial) { return (onUpdate(
            partial,
            call
          )); },
          beforeToolCall:async function prepareNativeMember(hook) {
        memberState.entered=true;
        try{
          active('prepare-entry');
          const prepared=await prepare(hook);
          if(prepared?.block){block(prepared.reason || 'A member preparation blocked this complete group');return await gate.promise;}
          active('input-prepared');
          if(ready.has(call.id))throw new PreparedBatchContractError('Member reached preparation twice');
          const sealed=sealInput(hook.args);
          const member=Object.freeze({groupExecutionMode:serial?"sequential":"parallel",
            id:call.id,
            name:call.name,
            input:sealInput(structuredClone(sealed))
          });
          ready.set(
            call.id,
            member
          );
          // The next native preparation may start now; execution still waits for complete admission.
          releasePreparation();
          if((ready.size===scheduled.length) && (batchState.decision===undefined)
            && (!batchState.assessmentStarted)){
            batchState.assessmentStarted=true;
            const manifest=Object.freeze(scheduled.map(function readPreparedManifest(value) { return (ready.get(value.id)); }));
            snapshots.push(manifest);
            const assessed=await assess({
              members:manifest,
              signal
            });
            active('assessment-returned');
            if((assessed===null) || ((typeof assessed)!=='object')
              || ((typeof assessed.block)!=='boolean')
              || (assessed.block && (((typeof assessed.reason)!=='string') || (!assessed.reason))))throw new PreparedBatchContractError('Combined assessment returned an invalid decision');
            if(batchState.decision===undefined){batchState.decision=Object.freeze(assessed.block?{
              block:true,
              reason:assessed.reason
            }:{block:false});gate.resolve(batchState.decision);}
          }
          const selected=await gate.promise;
          active('member-release');
          return selected.block?selected:undefined;
        }catch(error){failures.push(error);block('Complete group preparation or assessment failed');return {
          block:true,
          reason:'Complete group preparation or assessment failed'
        };}
      }
        }
      );
      if(!memberState.entered)block('A member failed native preparation before group admission');
      await onFinish?.(result);
      return result;
    }catch(error){failures.push(error);block('Native member lifecycle failed');throw error;}
  }
  const completion={settled:undefined};
  {
    using abortSubscription={ [Symbol.dispose]() {signal.removeEventListener(
    'abort',
    onAbort
  );} };
    completion.settled=await Promise.allSettled(scheduled.map(runMember));
  }
  const {settled}=completion;
  if(batchState.decision===undefined)throw new PreparedBatchContractError('Prepared batch completed without admission outcome');
  if(failures.length > 0)throw new PreparedBatchExecutionError(
    'Prepared batch retained lifecycle failures',
    {
      failures,
      outcomes:settled,
      assessmentDecision:batchState.decision
    }
  );
  const rejected=settled.filter(function isRejectedResult(result) { return (result.status==='rejected'); });
  if(rejected.length > 0)throw new PreparedBatchExecutionError(
    'Prepared batch has unhandled native outcomes',
    {
      failures:rejected.map(function readRejection(result) { return (result.reason); }),
      outcomes:settled,
      assessmentDecision:batchState.decision
    }
  );
  return Object.freeze({
    decision:batchState.decision,
    assessmentCount:snapshots.length,
    members:snapshots[0]??Object.freeze([]),
    outcomes:Object.freeze(settled.map(function readCompletedValue(result) { return (result.value); }))
  });
}
//endregion
