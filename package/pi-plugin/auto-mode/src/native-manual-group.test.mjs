import assert from 'node:assert/strict';
import {createManualGroup,ManualGroupError} from '../dist/native/contract/integration/native-batch/manual-group.mjs';
import {maintainedPolicyEntry} from '../dist/native/contract/integration/maintained-policy.mjs';

//region Exact manual approval remains bound to one operation and execution lifetime.
const {askUser,VERDICT_ENTRY_TYPE}=await import(maintainedPolicyEntry);

/** Each fixture supplies its own native capabilities and records actual askUser verdicts. */
function createFixture(mode){
 const state={current:true,selections:0,entries:[]};
 const controller=new AbortController();
 const response={content:[{type:'toolCall',id:'one',name:'read',arguments:{path:'proof.txt'}}]};
 const stream=Object.freeze({});
 const origins=new WeakMap();
 const prepared=Object.freeze({id:'one',name:'read',input:Object.freeze({path:'proof.txt'}),groupExecutionMode:'parallel'});
 const pi={appendEntry(type,data){assert.equal(type,VERDICT_ENTRY_TYPE);state.entries.push(data);}};
 const ctx={hasUI:true,abort(){controller.abort();},ui:{async select(title,options){
  state.selections++;
  assert.deepEqual(options,['Allow','Stop']);
  assert.ok(title.includes('proof.txt'));
  if(mode==='changed-parent')response.content[0].arguments.path='another.txt';
  if(mode==='stale')state.current=false;
  if(mode==='aborted')controller.abort();
  if(mode==='changed-host')pi.appendEntry=function replacementAppend(){assert.fail('Replacement must not execute');};
  return 'Allow';
 }}};
 const group=createManualGroup({response,stream,signal:controller.signal,origins,
  assertOperationCurrent(){if(!state.current)throw new ManualGroupError('Fixture operation retired');},
  captureHost(){return {pi,ctx,askUser,verdictEntryType:VERDICT_ENTRY_TYPE,
   trace(value){assert.equal(typeof value,'string');},
   notificationInvoker:async function retainNotification(){return {exitCode:0,stdout:'',stderr:''};}
  };}
 });
 return {group,state,response,stream,origins,prepared};
}

const allowed=createFixture('allow');
allowed.group.prepare([allowed.prepared]);
assert.throws(function duplicatePreparation(){allowed.group.prepare([allowed.prepared]);},ManualGroupError);
assert.throws(function unknownMember(){allowed.group.memberFor('unknown');},ManualGroupError);
const member=allowed.group.memberFor('one');
assert.throws(function executionBeforeApproval(){allowed.group.beginExecution(member);},ManualGroupError);
const decision=await allowed.group.request(new Error('Fixture automatic assessment unavailable'));
assert.equal(decision.outcome.verdict,'approve');
assert.equal(allowed.state.selections,1);
assert.equal(allowed.state.entries.length,1);
assert.throws(function foreignMember(){allowed.group.beginExecution(Object.freeze({}));},ManualGroupError);
const token=allowed.group.beginExecution(member);
const readOrigin=allowed.origins.get(token);
assert.equal(typeof readOrigin,'function');
const carrier={response:allowed.response,stream:allowed.stream};
const origin=readOrigin(carrier);
assert.equal(origin.prepared,allowed.prepared);
assert.equal(origin.manualApproval,true);
assert.equal(allowed.group.executionFor(token),origin);
assert.throws(function anotherResponse(){readOrigin({...carrier,response:{}});},ManualGroupError);
assert.throws(function anotherStream(){readOrigin({...carrier,stream:{}});},ManualGroupError);
assert.throws(function duplicateExecution(){allowed.group.beginExecution(member);},ManualGroupError);
assert.throws(function foreignToken(){allowed.group.finishExecution(Object.freeze({}));},ManualGroupError);
allowed.group.finishExecution(token);
assert.equal(allowed.origins.has(token),false);
assert.throws(function returnedExecution(){allowed.group.executionFor(token);},ManualGroupError);
assert.throws(function retainedOriginReader(){readOrigin(carrier);},ManualGroupError);
allowed.group.close();
assert.throws(function closedOperation(){allowed.group.current();},ManualGroupError);

for(const mode of ['changed-parent','stale','aborted','changed-host']){
 const fixture=createFixture(mode);
 fixture.group.prepare([fixture.prepared]);
 let failure;
 try{await fixture.group.request(new Error('Fixture evidence unavailable'));}
 catch(error){failure=error;}
 assert.ok(Error.isError(failure),`${mode} must reject its stale Allow response`);
 assert.equal(fixture.state.selections,1);
 assert.throws(function rejectedExecution(){fixture.group.beginExecution(fixture.group.memberFor('one'));});
 fixture.group.close();
}
console.log(JSON.stringify({complete:true,originalAllow:true,parentChanges:true,nativeRetirement:true,cancellation:true,hostChanges:true,oneShot:true,returnedTokens:true}));
//endregion
