import { sealPreparedInput } from './prepared-input-seal.ts';
import { schedulePreparedCalls } from './prepared-schedule.ts';
import { completePreparedBatch } from './prepared-completion.ts';
import { wrapPreparedTools } from './prepared-executable.ts';
import { preparePreparedMember } from './prepared-member.ts';
import { runPreparedLifecycle } from './prepared-lifecycle.ts';

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
  function waitForTurn(ordinal) { return turns[ordinal].promise; }
  const executableTools = wrapPreparedTools({ tools, ordinalByID, serial, waitForTurn, active, failures, batchState, executionJudgment, executeWithOwnedContext, NativeExecutionGuardError, PreparedBatchContractError });
  function onAbort() {  block('Prepared group cancelled before execution'); }
  signal.addEventListener(
    'abort',
    onAbort,
    {once:true}
  );
  if(signal.aborted)onAbort();
  function waitForPreparation(ordinal) { return preparationTurns[ordinal].promise; }
  function releaseNextPreparation(ordinal) { return preparationTurns[ordinal+1]?.resolve(); }
  function releaseNextExecution(ordinal) { return turns[ordinal+1]?.resolve(); }
  /** {@inheritDoc preparePreparedMember} */
  function prepareNativeMember({hook,call,memberState,releasePreparation}) {
    return preparePreparedMember({hook,call,memberState,batchState,ready,scheduled,snapshots,failures,serial,signal,gate,active,prepare,block,sealInput,releasePreparation,assess,PreparedBatchContractError});
  }
  /** {@inheritDoc runPreparedLifecycle} */
  function runMember(call){
    return runPreparedLifecycle({call,ordinalByID,waitForPreparation,releaseNextPreparation,releaseNextExecution,onStart,onFinish,onUpdate,runToolCall,executableTools,assistantMessage,context,signal,after,prepareNativeMember,failures,block,PreparedBatchContractError});
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
  return completePreparedBatch({ batchState, failures, settled, snapshots, PreparedBatchContractError, PreparedBatchExecutionError });
}
//endregion
