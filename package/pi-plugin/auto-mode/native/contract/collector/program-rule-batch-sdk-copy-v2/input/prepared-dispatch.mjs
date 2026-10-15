import {
  executeWithOwnedContext,
  NativeExecutionGuardError
} from "../../../lifecycle/execution-context-carrier/execute.mjs";
//region Private prepared-group dispatcher; all executable members wait for one combined judgment.
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

/** Seal ordinary JSON-like input trees only after the supplied preparation hooks finish. */
function sealInput(input) {
  const pending=[input];
  const seen=new Set();
  while(pending.length > 0){
    const value=pending.pop();
    if((value===null) || (value===undefined)
      || ((typeof value)==='string')
      || ((typeof value)==='boolean'))continue;
    if(((typeof value)==='number') && Number.isFinite(value))continue;
    if(((typeof value)!=='object') || seen.has(value))throw new PreparedBatchContractError('Prepared input must be a non-aliased JSON-like tree');
    seen.add(value);
    if(seen.size>10_000)throw new PreparedBatchContractError('Prepared input exceeds the declared tree bound');
    const prototype=Object.getPrototypeOf(value);
    if(Array.isArray(value) ? prototype!==Array.prototype : (prototype!==Object.prototype) && (prototype!==null))throw new PreparedBatchContractError('Prepared input has an unsupported prototype');
    if(Array.isArray(value) && (Reflect.ownKeys(value)
      .length
      !==(value.length
      +1)))throw new PreparedBatchContractError('Prepared input array is sparse or has extra properties');
    for(const key of Reflect.ownKeys(value)){
      if((typeof key)!=='string')throw new PreparedBatchContractError('Prepared input has a symbol key');
      const property=Object.getOwnPropertyDescriptor(
        value,
        key
      );
      if((property===undefined) || (!Object.hasOwn(
        property,
        'value'
      )))throw new PreparedBatchContractError('Prepared input has an accessor');
      if((!property.enumerable) && (!(Array.isArray(value) && (key==='length'))))throw new PreparedBatchContractError('Prepared input has hidden properties');
      pending.push(property.value);
    }
    Object.freeze(value);
  }
  return input;
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
  if((!Array.isArray(calls)) || (calls.length===0)
    || (calls.length>64)
    || calls.some(call=>(call.type!=='toolCall') || ((typeof call.id)!=='string')
      || (!call.id)
      || ((typeof call.name)!=='string')
      || (!call.name))
    || (new Set(calls.map(call=>call.id)).size!==calls.length))throw new PreparedBatchContractError('Prepared batch requires one to64 unique named members');
  const scheduled=Object.freeze(calls.map(call=>Object.freeze(structuredClone(call))));
  if((executionMode!=='parallel') && (executionMode!=='sequential'))throw new PreparedBatchContractError('Unknown batch execution mode');
  if((!executionJudgment)||[
    'memberFor',
    'beginExecution',
    'executionFor',
    'finishExecution'
  ].some(name=>(typeof executionJudgment[name])!=='function'))throw new PreparedBatchContractError('Enclosing judgment lacks required native execution occurrence support');
  for(const call of scheduled){const tool=tools.find(value=>value.name===call.name);if(tool&&((typeof tool.createExecutionContext)!=='function'))throw new PreparedBatchContractError(`Tool ${JSON.stringify(call.name)
    } lacks required native context support; the complete group was not started`);}
  const serial=(executionMode==='sequential') || scheduled.some(call=>tools.find(tool=>tool.name===call.name)
    ?.executionMode
    ==='sequential');
  const turns=scheduled.map(()=>Promise.withResolvers());
  const preparationTurns=scheduled.map(()=>Promise.withResolvers());
  turns[0]
    .resolve();
  preparationTurns[0]
    .resolve();
  const ordinalByID=new Map(scheduled.map((
    call,
    index
  )=>[
    call.id,
    index
  ]));
  const gate=Promise.withResolvers();
  const ready=new Map();
    const failures=[];
    const snapshots=[];
  let assessmentStarted=false;
    let decision;
    let executionGuardFailed=false;
  function block(reason){
    if(decision===undefined){decision=Object.freeze({
      block:true,
      reason
    });gate.resolve(decision);}
  }
  function active(stage){if(signal.aborted)throw new PreparedBatchContractError(
    'Prepared group cancelled',
    {cause:signal.reason}
  );assertFresh({stage});}
  const executableTools=tools.map(original=>({
    ...original,
    async execute(...args){
    const ordinal=ordinalByID.get(args[0]);
    if(ordinal===undefined)throw new PreparedBatchContractError('Execution has no declared member ordinal');
    if(serial)await turns[ordinal]
      .promise;
    try{active('member-execute');}catch(error){failures.push(error);throw error;}
    if(executionGuardFailed){const error=new PreparedBatchContractError('An execution context guard failed; remaining group members cannot start');failures.push(error);throw error;}
    try{return await executeWithOwnedContext({
      judgment:executionJudgment,
      tool:original,
      args
    });}
    catch(error){if(error instanceof NativeExecutionGuardError){executionGuardFailed=true;failures.push(error);}throw error;}
  }
  }));
  function onAbort() {  block('Prepared group cancelled before execution'); }
  signal.addEventListener(
    'abort',
    onAbort,
    {once:true}
  );
  if(signal.aborted)onAbort();
  async function runMember(call){
    let entered=false;
    let preparationReleased=false;
    const ordinal=ordinalByID.get(call.id);
    if(ordinal===undefined)throw new PreparedBatchContractError('Preparation has no declared member ordinal');
    function releasePreparation(){
      if(preparationReleased)return;
      preparationReleased=true;
      preparationTurns[ordinal+1]
        ?.resolve();
    }
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
          onUpdate:onUpdate===undefined?undefined:partial=>onUpdate(
            partial,
            call
          ),
          beforeToolCall:async hook=>{
        entered=true;
        try{
          active('prepare-entry');
          const prepared=await prepare(hook);
          if(prepared?.block){block(prepared.reason || 'A member preparation blocked this complete group');return await gate.promise;}
          active('input-prepared');
          if(ready.has(call.id))throw new PreparedBatchContractError('Member reached preparation twice');
          const sealed=sealInput(hook.args);
          const member=Object.freeze({
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
          if((ready.size===scheduled.length) && (decision===undefined)
            && (!assessmentStarted)){
            assessmentStarted=true;
            const manifest=Object.freeze(scheduled.map(value=>ready.get(value.id)));
            snapshots.push(manifest);
            const assessed=await assess({
              members:manifest,
              signal
            });
            active('assessment-returned');
            if((assessed===null) || ((typeof assessed)!=='object')
              || ((typeof assessed.block)!=='boolean')
              || (assessed.block && (((typeof assessed.reason)!=='string') || (!assessed.reason))))throw new PreparedBatchContractError('Combined assessment returned an invalid decision');
            if(decision===undefined){decision=Object.freeze(assessed.block?{
              block:true,
              reason:assessed.reason
            }:{block:false});gate.resolve(decision);}
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
      if(!entered)block('A member failed native preparation before group admission');
      await onFinish?.(result);
      return result;
    }catch(error){failures.push(error);block('Native member lifecycle failed');throw error;}
    finally{releasePreparation();turns[ordinal+1]
      ?.resolve();}
  }
  let settled;
  try{settled=await Promise.allSettled(scheduled.map(runMember));}
  finally{signal.removeEventListener(
    'abort',
    onAbort
  );}
  if(decision===undefined)throw new PreparedBatchContractError('Prepared batch completed without admission outcome');
  if(failures.length > 0)throw new PreparedBatchExecutionError(
    'Prepared batch retained lifecycle failures',
    {
      failures,
      outcomes:settled,
      assessmentDecision:decision
    }
  );
  const rejected=settled.filter(result=>result.status==='rejected');
  if(rejected.length > 0)throw new PreparedBatchExecutionError(
    'Prepared batch has unhandled native outcomes',
    {
      failures:rejected.map(result=>result.reason),
      outcomes:settled,
      assessmentDecision:decision
    }
  );
  return Object.freeze({
    decision,
    assessmentCount:snapshots.length,
    members:snapshots[0]??Object.freeze([]),
    outcomes:Object.freeze(settled.map(result=>result.value))
  });
}
//endregion
