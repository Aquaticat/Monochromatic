/** Retain genuine manager inputs without assembling their aggregate into one string. @module */
import assert from 'node:assert/strict';
import {constants} from 'node:buffer';
import {captureLoadedInputs} from '../dist/native/contract/collector/run-prompt-custody-v3/loaded-inputs.mjs';
import {createRunPromptOwner} from '../dist/native/contract/collector/run-prompt-custody-v3/owner.mjs';
import {freezePromptOptions} from '../dist/native/contract/collector/base-prompt-custody-v2/copy.mjs';

//region Actual manager origins exceed one engine string while remaining separate immutable inputs.
const pool=captureLoadedInputs([]);
const content='Original retained input.\n'.repeat(44_000);
const blocks=[{type:'text',text:content}];
globalThis.gc();
const initialHeap=process.memoryUsage().heapUsed;

/** Original argument frames issue each manager capability independently. */
function appendMessage(message){
  assert.equal(arguments[0],message);
  pool.captureManagerInput({frame:arguments,method:'appendMessage'});
}

for(let index=0;index<600;index++)appendMessage({role:'user',content:blocks});
pool.assertCaptured();
globalThis.gc();
const retainedHeap=process.memoryUsage().heapUsed-initialHeap;
const origins=pool.readConstructedInputs();
assert.equal(origins.length,600);
assert.ok(pool.inputUsage().bytes>constants.MAX_STRING_LENGTH,
  'Positive control: the actual retained source records exceed the engine string limit');
const root={current:Object.freeze({})};
const base=Object.freeze({status:'ready',occurrence:Object.freeze({}),options:freezePromptOptions({
  customPrompt:undefined,forceSystemPrompt:undefined,selectedTools:[],toolSnippets:{},
  toolGuidelines:{},promptGuidelines:[],appendSystemPrompt:'',sections:{},
  cwd:process.cwd(),contextFiles:[],skills:[]
})});
const owner=createRunPromptOwner({
  assertLive(){return undefined;},
  readBase(){return base;},
  readRoot(){return root.current;},
  readSessionInput(publication){return pool.lookup(publication);},
  readConstructedInputs(){return pool.readConstructedInputs();},
  assertSessionInputs(){pool.assertCaptured();}
});
const options=owner.refresh({compose({base:original}){return {...original};}});
owner.captureContextClone({kind:'request-context',before:[],after:[]});
const view=owner.read({options});
assert.equal(view.retainedMessageOrigins.length,origins.length);
for(const [index,origin] of origins.entries())assert.equal(view.retainedMessageOrigins[index],origin);
assert.equal(new Set(origins.map(origin=>origin.source.occurrence)).size,origins.length);
assert.equal(new Set(origins.map(origin=>origin.publication)).size,origins.length);
assert.equal(owner.read({options}),view,'Repeated observation preserves the original immutable view');
appendMessage({role:'user',content:[{type:'text',text:'A different retained input.'}]});
const changed=owner.read({options});
assert.equal(changed.retainedMessageOrigins.length,origins.length+1);
assert.notEqual(changed.retainedMessageOrigins.at(-1).source.sha256,origins[0].source.sha256);
root.current=Object.freeze({});
assert.throws(function retiredRoot(){owner.read({options});});
console.log(JSON.stringify({complete:true,inputs:origins.length,bytes:pool.inputUsage().bytes,
  retainedHeapBytes:retainedHeap,engineStringLimit:constants.MAX_STRING_LENGTH,
  originalOccurrences:true,distinctPublications:true,changedInput:true,retiredRootRejected:true}));
//endregion
