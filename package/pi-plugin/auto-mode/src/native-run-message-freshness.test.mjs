import assert from 'node:assert/strict';
import {bindRunMessageSources} from '../dist/native/contract/integration/policy-source/run-messages.mjs';
import {GoverningPolicyBindingError} from '../dist/native/contract/integration/policy-source/governing-source.mjs';

//region Catalog growth must not multiply complete parent dependency scans.
/** Retained native descriptions share one original parent observation. */
function createFixture(count){
 const state={checks:0,current:true,sourceReads:0};
 const origins=Object.freeze(Array.from({length:count},function createDescription(_,index){
  const sessionInputOccurrence=Object.freeze({});
  const occurrence=Object.freeze({});
  const source=Object.freeze({kind:'native-tool-description-input',content:`Catalog tool ${index}`,occurrence,sessionInputOccurrence});
  const publication=Object.freeze({sessionInputOccurrence,sourceOccurrence:occurrence});
  return Object.freeze({get source(){state.sourceReads++;return source;},publication,sessionInputOccurrence});
 }));
 const sources=Object.freeze({nativeConstructedInputs:origins,runMessageInputs:Object.freeze(origins.map(function readSource(origin){return origin.source;}))});
 const request=Object.freeze({sources});
 const view=Object.freeze({request,sources});
 const governing=Object.freeze({view,assertCurrent(value){
  state.checks++;
  assert.equal(value,view);
  if(!state.current)throw new GoverningPolicyBindingError('Fixture parent observation retired');
 }});
 return {state,governing,origins};
}

const small=createFixture(1);
const smallBindings=bindRunMessageSources({governing:small.governing});
assert.equal(smallBindings.length,1);
const catalog=createFixture(256);
const bindings=bindRunMessageSources({governing:catalog.governing});
assert.equal(bindings.length,256);
assert.equal(catalog.state.checks,small.state.checks,'Catalog growth must not multiply full parent scans');
assert.ok(catalog.state.checks>=2,'Construction must check its parent before and after reading the collection');
assert.ok(catalog.state.sourceReads<=bindings.length*4,'Catalog source identity reads must grow linearly');
for(const [index,binding] of bindings.entries())assert.equal(binding.view.source,catalog.origins[index].source);
assert.throws(function foreignView(){bindings[0].assertCurrent(Object.freeze({}));},GoverningPolicyBindingError);
catalog.state.current=false;
assert.throws(function retiredBinding(){bindings[0].assertCurrent(bindings[0].view);},GoverningPolicyBindingError);
assert.throws(function retiredConstruction(){bindRunMessageSources({governing:catalog.governing});},GoverningPolicyBindingError);

const changed=createFixture(1);
const original=changed.origins[0].source;
const changedSource=Object.freeze({...original,get kind(){changed.state.current=false;return original.kind;}});
const changedOrigin=Object.freeze({...changed.origins[0],source:changedSource});
const changedSources=Object.freeze({nativeConstructedInputs:Object.freeze([changedOrigin]),runMessageInputs:Object.freeze([changedSource])});
const changedView=Object.freeze({request:Object.freeze({sources:changedSources}),sources:changedSources});
const changedGoverning=Object.freeze({view:changedView,assertCurrent(value){assert.equal(value,changedView);if(!changed.state.current)throw new GoverningPolicyBindingError('Fixture parent changed during binding');}});
assert.throws(function changedDuringConstruction(){bindRunMessageSources({governing:changedGoverning});},GoverningPolicyBindingError);
console.log(JSON.stringify({complete:true,catalogSize:bindings.length,parentChecks:small.state.checks,retiredBindingsRejected:true,constructionChangesRejected:true}));
//endregion
