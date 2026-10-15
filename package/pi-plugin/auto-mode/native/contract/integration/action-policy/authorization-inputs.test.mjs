import assert from 'node:assert/strict';
import {
  captureAuthorizationInputs,
  captureAuthorizationOwnerFactory,
  AuthorizationEvidenceError,
  MISSING_AUTHORIZATION_EVIDENCE
} from './authorization-inputs.mjs';

function fixture(){
 const rule={};
   const request={};
   const judgment={};
   const source={
   sourceOccurrence:{},
   request
 };
 const state={captures:0,current:true,ownerCurrent:true};
 const authorization={
   satisfaction:'unsatisfied',
   channel:'incumbent-approval'
 };
 const evidence={
   judgment,
   rule,
   source,
   request,
   authorization
 };
 const inputs={
   instructionCandidates:[rule],
   instructionSources:[source],
   requestObservation:request,
   readRule(handle){assert.equal(
     handle,
     rule
   );return {sourceOccurrence:source.sourceOccurrence};},
   assertCurrent(){assert.ok(
     state.current,
     'Original inputs changed'
   );}
 };
 const owner={
   capture: function captureOriginalEvidence(){state.captures++;return Promise.resolve(evidence);},
   assertCurrent(value){assert.equal(
     value,
     evidence
   );assert.ok(
     state.ownerCurrent,
     'Original owner retired'
   );}
 };
 return {
   rule,
   request,
   judgment,
   source,
   authorization,
   evidence,
   inputs,
   owner,
   args:{
     judgment,
     inputs,
     ownerFor:function returnAuthorizationOwner() { return (owner); }
   },
   captureCount:function readCaptureCount() { return (state.captures); },
   retireInputs(){state.current=false;},
   retireOwner(){state.ownerCurrent=false;},
   restoreOwner(){state.ownerCurrent=true;}
 };
}
const valid=fixture();
const captured=await captureAuthorizationInputs(valid.args);
assert.equal(
  valid.captureCount(),
  1
);
assert.deepEqual(
  captured.forClause(valid.rule),
  valid.authorization
);
assert.ok(
  Object.isFrozen(captured.forClause(valid.rule)),
);
assert.ok(Object.isFrozen(captured.records));
assert.equal(
  captured.records[0]
    .evidence,
  valid.evidence
);
assert.ok(!Object.isFrozen(valid.evidence));assert.ok(!Object.isFrozen(valid.owner));
captured.assertCurrent();
assert.throws(
  function rejectForeignClause() { return (captured.forClause({})); },
  AuthorizationEvidenceError
);
const missing=fixture();
  const absent=await captureAuthorizationInputs({
  ...missing.args,
  ownerFor:undefined
});
assert.equal(
  absent.forClause(missing.rule),
  MISSING_AUTHORIZATION_EVIDENCE
);assert.equal(
  missing.captureCount(),
  0
);
for(const field of [
  'judgment',
  'rule',
  'source',
  'request'
]){
 const input=fixture();input.evidence[field]={};
 await assert.rejects(
   function captureAuthoredInputs() { return (captureAuthorizationInputs(input.args)); },
   function matchesOriginalBindingFailure(error) {
     return Error.isError(error) && error.message.includes('differs from the original');
   }
 );
}
for(const authorization of [
 {
   satisfaction:true,
   channel:'incumbent-approval'
 },
 {
   satisfaction:'unsatisfied',
   channel:'allow-button'
 },
 {
   satisfaction:'satisfied',
   channel:'incumbent-approval',
   permission:true
 }
]){
 const input=fixture();input.evidence
   .authorization=authorization;
 await assert.rejects(function captureRetiredInputs() { return (captureAuthorizationInputs(input.args)); });
}
for(const mutation of [
 function injectPermissionField(value) {value.evidence
   .permission=true;},
 function removeSourceBinding(value) {delete value.evidence
   .source;},
 function replaceCaptureCapability(value) {value.owner
   .capture=false;},
 function injectModelEvidence(value) {value.owner
   .modelSays=true;}
]){
 const input=fixture();mutation(input);
 await assert.rejects(
   function captureModifiedInputs() { return (captureAuthorizationInputs(input.args)); },
   AuthorizationEvidenceError
 );
}
const accessorObservations={getters:0};
const accessor=fixture();
Object.defineProperty(
  accessor.evidence,
  'authorization',
  {
    enumerable:true,
    get(){accessorObservations.getters++;return accessor.authorization;}
  }
);
await assert.rejects(
  function captureAccessorEvidence() { return (captureAuthorizationInputs(accessor.args)); },
  function matchesEvidenceAccessor(error) {
    return Error.isError(error) && error.message.includes('data properties');
  }
);
const methodAccessor=fixture();
Object.defineProperty(
  methodAccessor.owner,
  'capture',
  {
    enumerable:true,
    get(){accessorObservations.getters++;return function returnAccessorEvidence() { return Promise.resolve(methodAccessor.evidence); };}
  }
);
await assert.rejects(
  function captureMethodAccessorEvidence() { return (captureAuthorizationInputs(methodAccessor.args)); },
  function matchesCapabilityAccessor(error) {
    return Error.isError(error) && error.message.includes('data properties');
  }
);
assert.equal(
  accessorObservations.getters,
  0
);
for(const input of [
  undefined,
  null,
  {},
  true,
  1,
  'owner'
])assert.throws(
  function captureInvalidOwnerFactory() { return (captureAuthorizationOwnerFactory(input)); },
  AuthorizationEvidenceError
);

function factory() { return undefined; }assert.equal(
  captureAuthorizationOwnerFactory(factory),
  factory
);
const asynchronous=fixture();
asynchronous.owner
  .capture=async function retireDuringCapture() {asynchronous.retireInputs();return asynchronous.evidence;};
await assert.rejects(
  function captureAsynchronousRetirement() { return (captureAuthorizationInputs(asynchronous.args)); },
  function matchesRetiredInputs(error) {
    return Error.isError(error) && error.message.includes('Original inputs changed');
  }
);
const copied=fixture();copied.owner
  .capture=async function returnCopiedEvidence() { return (({...copied.evidence})); };
await assert.rejects(function captureCopiedEvidence() { return (captureAuthorizationInputs(copied.args)); });
for(const change of [
  'owner',
  'facts',
  'capability'
]){
 const input=fixture();
   const binding=await captureAuthorizationInputs(input.args);
   const method=input.owner
     .capture;
 if(change==='owner')input.retireOwner();
 if(change==='facts')input.authorization
   .satisfaction='satisfied';
 if(change==='capability')input.owner
   .capture=async function returnOriginalEvidence() { return (input.evidence); };
 assert.throws(binding.assertCurrent);
 input.restoreOwner();input.authorization
   .satisfaction='unsatisfied';input.owner
     .capture=method;
 assert.throws(
   binding.assertCurrent,
   function matchesLostEligibility(error) {
     return Error.isError(error) && error.message.includes('lost eligibility');
   }
 );
}
console.log(JSON.stringify({
  complete:true,
  originalBindingsChecked:true,
  staleEvidenceDoesNotRevive:true,
  borrowedInputsNotFrozen:true,
  providerRequests:0
}));
