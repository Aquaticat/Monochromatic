/** Preserve request-bound source identities without per-source checking closures. @module */
import assert from 'node:assert/strict';
import {captureLoadedInputs} from '../dist/native/contract/collector/run-prompt-custody-v3/loaded-inputs.mjs';
import {collectNativeMessageInputs} from '../dist/native/contract/collector/run-prompt-custody-v3/message-inputs.mjs';
import {bindRunMessageSources} from '../dist/native/contract/integration/policy-source/run-messages.mjs';
import {GoverningPolicyBindingError} from '../dist/native/contract/integration/policy-source/governing-source.mjs';

//region Genuine manager capabilities retain distinct request-bound views.
const pool=captureLoadedInputs([]);
/** Issue the original manager argument frame for each occurrence. */
function appendMessage(message){
  assert.equal(arguments[0],message);
  pool.captureManagerInput({frame:arguments,method:'appendMessage'});
}
for(let index=0;index<10_000;index++)appendMessage({role:'user',content:'Original manager input.'});
pool.assertCaptured();
const captured={nativeConstructedInputs:pool.readConstructedInputs()};
const snapshot=Object.freeze({...captured,runMessageInputs:collectNativeMessageInputs(captured)});
const request=Object.freeze({sources:snapshot});
const state={current:true,checks:0};
/** The fixture parent isolates binding ownership from the independently tested governance issuer. */
function createGoverning(sources){
  const view=Object.freeze({sources,request});
  return Object.freeze({view,assertCurrent(value){
    state.checks++;
    assert.equal(value,view);
    if(!state.current)throw new GoverningPolicyBindingError('Fixture governing snapshot retired');
  }});
}
globalThis.gc();
const initialHeap=process.memoryUsage().heapUsed;
const groups=Array.from({length:12},function bindOriginalSources(){
  return bindRunMessageSources({governing:createGoverning(snapshot)});
});
globalThis.gc();
const retainedHeap=process.memoryUsage().heapUsed-initialHeap;
assert.equal(groups.length,12);
assert.equal(snapshot.runMessageInputs.length,10_000);
assert.ok(retainedHeap<36*1024*1024,`Original source bindings retain ${retainedHeap} bytes, exceeding 36 MiB`);
for(const group of groups){
  assert.equal(group.length,snapshot.runMessageInputs.length);
  for(const [index,binding] of group.entries()){
    assert.equal(Object.getPrototypeOf(binding),Object.prototype);
    assert.ok(Object.isFrozen(binding));
    assert.ok(Object.isFrozen(binding.view));
    assert.equal(binding.view.request,request);
    assert.equal(binding.view.source,snapshot.runMessageInputs[index]);
    assert.equal(binding.view.sourceOccurrence,snapshot.runMessageInputs[index].occurrence);
    binding.assertBindingIdentity(binding.view);
  }
  group[0].assertCurrent(group[0].view);
  assert.throws(function wrongMember(){group[0].assertCurrent(group[1].view);},GoverningPolicyBindingError);
}
assert.notEqual(groups[0][0],groups[1][0]);
assert.notEqual(groups[0][0].view,groups[1][0].view);
//endregion

//region Shared checks authenticate their original receiver before inspecting its view.
const first=groups[0][0];
const other=groups[1][0];
const checksBefore=state.checks;
for(const name of ['assertBindingIdentity','assertCurrent']){
  const check=first[name];
  assert.throws(function detachedCheck(){check(first.view);},GoverningPolicyBindingError);
  assert.throws(function forgedReceiver(){check.call({...first},first.view);},GoverningPolicyBindingError);
  assert.throws(function foreignGroup(){check.call(other,other.view);},GoverningPolicyBindingError);
  assert.throws(function accessorReceiver(){check.call({get view(){assert.fail('Unissued receiver accessed');}},first.view);},GoverningPolicyBindingError);
}
assert.equal(state.checks,checksBefore,'Unissued receivers must not reach governing checks');
const replaced=Object.freeze({...snapshot,runMessageInputs:[Object.freeze({...snapshot.runMessageInputs[0]})]});
assert.throws(function substitutedSource(){bindRunMessageSources({governing:createGoverning(replaced)});},GoverningPolicyBindingError);
state.current=false;
assert.throws(function retiredParent(){first.assertCurrent(first.view);},GoverningPolicyBindingError);
assert.throws(function retiredConstruction(){bindRunMessageSources({governing:createGoverning(snapshot)});},GoverningPolicyBindingError);
console.log(JSON.stringify({complete:true,groups:groups.length,originalSources:snapshot.runMessageInputs.length,
  bindings:groups.length*snapshot.runMessageInputs.length,retainedHeapBytes:retainedHeap,
  originalMembership:true,wrongMemberRejected:true,forgedReceiversRejected:true,
  crossSnapshotRejected:true,substitutedSourceRejected:true,retiredParentRejected:true}));
//endregion
