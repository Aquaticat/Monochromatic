import assert from 'node:assert/strict';
import {captureAuthorizationInputs,captureAuthorizationOwnerFactory,AuthorizationEvidenceError,MISSING_AUTHORIZATION_EVIDENCE} from './authorization-inputs.mjs';

function fixture(){
 const rule={},request={},judgment={},source={sourceOccurrence:{},request};
 let current=true,ownerCurrent=true,captures=0;
 const authorization={satisfaction:'unsatisfied',channel:'incumbent-approval'};
 const evidence={judgment,rule,source,request,authorization};
 const inputs={instructionCandidates:[rule],instructionSources:[source],requestObservation:request,
  readRule(handle){assert.equal(handle,rule);return {sourceOccurrence:source.sourceOccurrence};},
  assertCurrent(){assert(current,'Original inputs changed');}};
 const owner={async capture(){captures++;return evidence;},assertCurrent(value){assert.equal(value,evidence);assert(ownerCurrent,'Original owner retired');}};
 return {rule,request,judgment,source,authorization,evidence,inputs,owner,
  args:{judgment,inputs,ownerFor:()=>owner},
  captureCount:()=>captures,retireInputs(){current=false;},retireOwner(){ownerCurrent=false;},restoreOwner(){ownerCurrent=true;}};
}
const valid=fixture(),captured=await captureAuthorizationInputs(valid.args);
assert.equal(valid.captureCount(),1);
assert.deepEqual(captured.forClause(valid.rule),valid.authorization);
assert(Object.isFrozen(captured.forClause(valid.rule)));
assert(Object.isFrozen(captured.records));
assert.equal(captured.records[0].evidence,valid.evidence);
assert(!Object.isFrozen(valid.evidence));assert(!Object.isFrozen(valid.owner));
captured.assertCurrent();
assert.throws(()=>captured.forClause({}),AuthorizationEvidenceError);
const missing=fixture(),absent=await captureAuthorizationInputs({...missing.args,ownerFor:undefined});
assert.equal(absent.forClause(missing.rule),MISSING_AUTHORIZATION_EVIDENCE);assert.equal(missing.captureCount(),0);
for(const field of ['judgment','rule','source','request']){
 const input=fixture();input.evidence[field]={};
 await assert.rejects(()=>captureAuthorizationInputs(input.args),/differs from the original/);
}
for(const authorization of [
 {satisfaction:true,channel:'incumbent-approval'},
 {satisfaction:'unsatisfied',channel:'allow-button'},
 {satisfaction:'satisfied',channel:'incumbent-approval',permission:true}
]){
 const input=fixture();input.evidence.authorization=authorization;
 await assert.rejects(()=>captureAuthorizationInputs(input.args));
}
for(const mutation of [
 value=>{value.evidence.permission=true;},
 value=>{delete value.evidence.source;},
 value=>{value.owner.capture=false;},
 value=>{value.owner.modelSays=true;}
]){
 const input=fixture();mutation(input);
 await assert.rejects(()=>captureAuthorizationInputs(input.args),AuthorizationEvidenceError);
}
let getters=0;
const accessor=fixture();
Object.defineProperty(accessor.evidence,'authorization',{enumerable:true,get(){getters++;return accessor.authorization;}});
await assert.rejects(()=>captureAuthorizationInputs(accessor.args),/data properties/);
const methodAccessor=fixture();
Object.defineProperty(methodAccessor.owner,'capture',{enumerable:true,get(){getters++;return async()=>methodAccessor.evidence;}});
await assert.rejects(()=>captureAuthorizationInputs(methodAccessor.args),/data properties/);
assert.equal(getters,0);
for(const input of [undefined,null,{},true,1,'owner'])assert.throws(()=>captureAuthorizationOwnerFactory(input),AuthorizationEvidenceError);

const factory=()=>undefined;assert.equal(captureAuthorizationOwnerFactory(factory),factory);
const asynchronous=fixture();
asynchronous.owner.capture=async()=>{asynchronous.retireInputs();return asynchronous.evidence;};
await assert.rejects(()=>captureAuthorizationInputs(asynchronous.args),/Original inputs changed/);
const copied=fixture();copied.owner.capture=async()=>({...copied.evidence});
await assert.rejects(()=>captureAuthorizationInputs(copied.args));
for(const change of ['owner','facts','capability']){
 const input=fixture(),binding=await captureAuthorizationInputs(input.args),method=input.owner.capture;
 if(change==='owner')input.retireOwner();
 if(change==='facts')input.authorization.satisfaction='satisfied';
 if(change==='capability')input.owner.capture=async()=>input.evidence;
 assert.throws(binding.assertCurrent);
 input.restoreOwner();input.authorization.satisfaction='unsatisfied';input.owner.capture=method;
 assert.throws(binding.assertCurrent,/lost eligibility/);
}
console.log(JSON.stringify({complete:true,originalBindingsChecked:true,staleEvidenceDoesNotRevive:true,borrowedInputsNotFrozen:true,providerRequests:0}));
