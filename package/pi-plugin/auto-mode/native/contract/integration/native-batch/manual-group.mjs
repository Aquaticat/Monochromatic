import {createHash} from 'node:crypto';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {caughtValueText} from '@monochromatic-dev/module-caught-value/ts';
import {bindPreparedTuiApproval} from '../../lifecycle/incumbent-tui-group/approval-presentation.mjs';

//region Manual approval owns prepared execution independently of automatic evidence.
export class ManualGroupError extends Error {}

/** Keep one manual decision bound to the complete original prepared group and native cancellation. */
export function createManualGroup({response,stream,signal,assertOperationCurrent,captureHost,origins}){
 const l=tagged({tag:createManualGroup.name,l:tagged({tag:'auto-mode-manual-group'})});
 const parentJSON=JSON.stringify(response.content);
 const byId=new Map();
 const records=new WeakMap();
 const executions=new WeakMap();
 const state={prepared:false,approval:undefined,answer:undefined,closed:false};
 function current(){
  if(state.closed)throw new ManualGroupError('The manually reviewed operation has ended');
  signal.throwIfAborted();
  assertOperationCurrent();
  if(JSON.stringify(response.content)!==parentJSON)throw new ManualGroupError('The proposed operation changed during manual review');
 }
 function knownMember(member){
  const record=records.get(member);
  if(!record)throw new ManualGroupError('The prepared member belongs to another manual operation');
  return record;
 }
 function prepare(members){
  current();
  if(state.prepared)throw new ManualGroupError('The manual operation was already prepared');
  for(const prepared of members){
   const handle=Object.freeze({});
   if(byId.has(prepared.id))throw new ManualGroupError('The prepared group repeats a tool call');
   byId.set(prepared.id,handle);
   records.set(handle,{prepared,entered:false});
  }
  state.prepared=true;
 }
 function memberFor(id){
  const member=byId.get(id);
  if(!member)throw new ManualGroupError('The tool call is absent from the manually reviewed group');
  return member;
 }
 function assertAllowed(){
  current();
  if(!state.approval||!state.answer)throw new ManualGroupError('The prepared operation has no manual Allow response');
  state.approval.assertOriginalAllow(state.answer);
 }
 function executionFor(token){
  const execution=executions.get(token);
  if(!execution?.active)throw new ManualGroupError('The manual execution is absent or has returned');
  assertAllowed();
  return execution.origin;
 }
 function beginExecution(member){
  assertAllowed();
  const record=knownMember(member);
  if(record.entered)throw new ManualGroupError('The manually approved member has already entered execution');
  record.entered=true;
  const token=Object.freeze({});
  const origin=Object.freeze({response,stream,signal,member,prepared:record.prepared,manualApproval:true});
  executions.set(token,{active:true,origin});
  origins.set(token,function readManualOrigin(carrier){
   if(carrier.response!==response||carrier.stream!==stream)throw new ManualGroupError('The manual execution carrier belongs to another response');
   return executionFor(token);
  });
  return token;
 }
 function finishExecution(token){
  const execution=executions.get(token);
  if(!execution)throw new ManualGroupError('The manual execution token belongs to another operation');
  execution.active=false;
  origins.delete(token);
 }
 async function request(error){
  tagged({tag:request.name,l}).debug('automatic assessment unavailable; requesting manual approval');
  current();
  if(!state.prepared||state.approval)throw new ManualGroupError('Manual approval requires one complete unreviewed group');
  const host=captureHost();
  if(!host)throw new ManualGroupError('Automatic assessment is unavailable and this session has no manual approval interface',{cause:error});
  const members=[...byId.values()].map(function readPrepared(member){return knownMember(member).prepared;});
  const scope=JSON.stringify({parentProgram:JSON.parse(parentJSON),preparedGroup:members});
  const action=`Complete prepared group:\n${scope}`;
  const approvalFingerprint=createHash('sha256').update(scope).digest('hex');
  const closure=Object.freeze({kind:'manual-prepared-group'});
  const detail=caughtValueText(error);
  state.approval=bindPreparedTuiApproval({
   ...host,action,approvalFingerprint,closure,signal,assertPreparedCurrent:current,
   explanation:`Auto-mode could not assess this operation: ${detail}. Review the complete prepared operation and choose Allow or Stop.`
  });
  state.answer=await state.approval.request();
  if(!state.answer.decision.block)assertAllowed();
  return Object.freeze({
   manualFallback:true,
   approval:state.answer,
   outcome:Object.freeze({state:'resolved',verdict:state.answer.decision.block?'deny':'approve',reason:state.answer.decision.reason}),
   assertCurrent:state.answer.decision.block?current:assertAllowed
  });
 }
 function close(){state.closed=true;}
 return Object.freeze({prepare,request,current,memberFor,beginExecution,executionFor,finishExecution,close});
}
//endregion
