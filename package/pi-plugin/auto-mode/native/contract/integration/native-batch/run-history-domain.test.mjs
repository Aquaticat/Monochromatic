import assert from 'node:assert/strict';
import {createEnvironment} from './environment.mjs';
import {createRootSessionFactory} from './session-root.ts';
import {bindPolicySessionCollector} from '../policy-source/system-slot.mjs';

const original='Original instruction from an earlier run within this same native root.';
let originalSource;
  let requests=0;
  let runs=0;
const env=await createEnvironment({extensionFactories:[function registerHistoricalPromptHandler(pi) {
 pi.on(
   'before_agent_start',
   function varyOriginalPromptInput(event) {
  runs++;
  if(runs===1)event.systemPromptOptions
    .sections
    .retained_marker=original;
  else delete event.systemPromptOptions
    .sections
    .retained_marker;
 }
 );
}]});
const {session}=await createRootSessionFactory(env)
  .create({options:{
    ...env.options,
    tools:[],
    customTools:[]
  }});
const collector=bindPolicySessionCollector({
  input:env.policyInput,
  session
});
session.agent
  .streamFunction=async function observeHistoricalRunStream(model) {
 requests++;
 const snapshot=collector.capture();collector.assertObservedFresh(snapshot);
 if(requests===1){
  originalSource=snapshot.governingSources
    .find(function matchesOriginalMappedPrompt(source) { return ((source.kind==='native-run-mapped-prompt-input')&&(source.content===original)); });
  assert.ok(
    originalSource,
    'Positive control: the first run must collect its original mapped prompt source'
  );
 }else{
  assert.equal(
    snapshot.nativeRunComposition
      .options
      .sections
      .retained_marker,
    undefined
  );
  assert.ok(
    snapshot.governingSources
      .includes(originalSource),
    'An earlier original run instruction must retain its own source occurrence when a later run omits it'
  );
 }
 const message={
   role:'assistant',
   api:model.api,
   provider:model.provider,
   model:model.id,
   content:[{
     type:'text',
     text:'done'
   }],
   stopReason:'stop',
   timestamp:Date.now(),
   usage:{
     input:0,
     output:0,
     cacheRead:0,
     cacheWrite:0,
     totalTokens:0,
     cost:{
       input:0,
       output:0,
       cacheRead:0,
       cacheWrite:0,
       total:0
     }
   }
 };
 return {
   async *[Symbol.asyncIterator](){yield {
     type:'done',
     reason:'stop',
     message
   };},
   async result(){return message;}
 };
};
try{
 await session.prompt('Receive the original run instruction.');
 assert.equal(
   session.messages
     .at(-1)
     .stopReason,
   'stop',
   session.messages
     .at(-1)
     .errorMessage
 );
 await session.prompt('Retain the original instruction after replacing the active run.');
 assert.equal(
   session.messages
     .at(-1)
     .stopReason,
   'stop',
   session.messages
     .at(-1)
     .errorMessage
 );
 assert.equal(
   requests,
   2
 );
 console.log(JSON.stringify({
   complete:true,
   originalRunOccurrenceRetained:true,
   providerRequests:0
 }));
}finally{session.dispose();await session.agent
  .waitForIdle();await env.drain();}
