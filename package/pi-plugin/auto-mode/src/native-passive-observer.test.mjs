import assert from 'node:assert/strict';
import {createRequestObservationOwner,RequestObservationUnavailableError} from '../dist/native/contract/lifecycle/root-lifecycle-retirement-entry/observer.mjs';

//region Passive observation preserves callback ownership, retries and transport failures.
const nativeFailure=new Error('Native callback failure');
const transportFailure=new Error('Native transport failure');
for(const failure of ['none','capture','prepare','before-callback','after-callback','seal','native-callback','transport','changed-retry']){
 const counts={payload:0,transport:0};
 const bodies=[];
 const selected={messages:[{role:'user',content:'callback replacement'}]};
 const response={role:'assistant',content:[]};
 const root={session:{},manager:{}};
 const collector={
  capture(){if(failure==='capture')throw new Error('Evidence capture failed');return Object.freeze({});},
  assertObservedFresh(){}
 };
 const owner=createRequestObservationOwner({
  root,lifecycle:{capture(){return Object.freeze({});},assertActive(){}},collector,
  terminalFetch(){throw new Error('Caller fetch must remain selected');},
  prepareSourceAssociation({options}){
   if(failure==='prepare')throw new Error('Evidence preparation failed');
   return {
    async onPayload(payload,model){
     if(failure==='before-callback')throw new Error('Evidence failed before native callback');
     const result=await options.onPayload(payload,model);
     if(failure==='after-callback')throw new Error('Evidence failed after native callback');
     return result;
    },
    seal(){if(failure==='seal')throw new Error('Evidence sealing failed');return [];}
   };
  },
  async originalStream(model,context,options){
   assert.equal(options.maxRetries,2);
   const payload=await options.onPayload({messages:[]},model);
   assert.equal(payload,selected);
   const body=JSON.stringify(payload);
   await options.fetch('https://current.invalid/v1/chat/completions',{method:'POST',body});
   await options.fetch('https://current.invalid/v1/chat/completions',{method:'POST',body:failure==='changed-retry'?JSON.stringify({messages:[]}):body});
   return {async result(){return response;},async *[Symbol.asyncIterator](){yield response;}};
  }
 });
 const options={maxRetries:2,
  onPayload(){counts.payload++;if(failure==='native-callback')throw nativeFailure;return selected;},
  fetch(input,init){counts.transport++;bodies.push(init.body);if(failure==='transport')throw transportFailure;return new Response('{}');}
 };
 if(failure==='native-callback'||failure==='transport'){
  await assert.rejects(function nativeRejection(){return owner.streamFunction({api:'openai-completions',id:'fixture'},{},options);},function original(error){return error===(failure==='native-callback'?nativeFailure:transportFailure);});
  assert.equal(counts.payload,1);
  assert.equal(counts.transport,failure==='native-callback'?0:1);
  continue;
 }
 const stream=await owner.streamFunction({api:'openai-completions',id:'fixture'},{},options);
 assert.equal(await stream.result(),response);
 assert.equal(counts.payload,1);
 assert.equal(counts.transport,2);
 assert.equal(bodies[0],JSON.stringify(selected));
 if(failure==='none')assert.equal(owner.observationFor(response).request.body,bodies[0]);
 else assert.throws(function evidenceUnavailable(){owner.observationFor(response);},RequestObservationUnavailableError);
}
console.log(JSON.stringify({complete:true,callbackOnce:true,nativeFailureIdentity:true,callerTransportPreserved:true,unchangedRetryObserved:true,changedRetryWithheld:true}));
//endregion
